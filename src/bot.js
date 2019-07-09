const fs = require('fs')
const reload = require('require-reload')(require)
const dotenv = require('dotenv')
const fetch = require('node-fetch')
const colors = require('colors/safe')
const bot = new (require('discord.js')).Client()
const MongoClient = require('mongodb').MongoClient

var $ = reload('./assets/functions')
var Administration, Utilities, Music, Searches, Games, Events

var loaded = false
var time = new Date()

if (!fs.existsSync('./.env')) {
  $.log('Creating .env file...')
  fs.copyFileSync('.env.example', '.env')
  $.log('Supply env file and restart the bot.')
  process.exit(10)
}

bot.env = dotenv.parse(fs.readFileSync('./.env'))
bot.package = reload('../package')

if (!bot.env.TOKEN || !bot.env.PREFIX || !bot.env.OWNER_ID) {
  $.warn('Missing Credentials in environment...', false)
  process.exit(10)
}

displayAscii()
$.log(`Starting ${bot.package.displayName} v${bot.package.version}`)

MongoClient.connect(
  `mongodb://${bot.env.DB_USER}:${bot.env.DB_PASS}@${bot.env.DB_HOST}/${bot.env.DB_NAME}`,
  { useNewUrlParser: true },
  async (err, client) => {
    if (err) {
      $.warn(`${err}\nFailed to establish connection to ${bot.env.DB_HOST}`, false)
      process.exit(10)
    }
    $.log(
      `MongoDB connection established on ${bot.env.DB_HOST} in ${((Date.now() - time) / 1000).toFixed(
        2
      )} secs.\n`
    )
    var db = client.db(bot.env.DB_NAME)
    bot.db = db

    time = new Date()
    var items = await db
      .collection('settings')
      .find({})
      .toArray()
    if (items.length === 0) {
      items = (await db.collection('settings').insertOne({
        status: 'online',
        game: {
          type: '',
          name: ''
        }
      })).ops
    }
    bot.config = items[0]

    $ = reload('./assets/functions')

    bot.login(bot.env.TOKEN)
  }
)

bot.once('ready', async () => {
  bot.commandExecuted = 0

  var guilds = Array.from(bot.guilds.keys())
  await $.processDatabase(guilds)

  $.log(`Loaded Settings in ${((Date.now() - time) / 1000).toFixed(2)} secs.\n`)

  await bot.loadModules()
  bot.loadEvents()

  $.log(`Logged in as ${bot.user.tag}\n`)

  if (process.env.message === 'updated' && fs.existsSync('./updateid.txt')) {
    fs.readFile('./updateid.txt', 'utf8', function(err, data) {
      if (err) return $.warn(err)

      bot.channels.get(data).send(
        $.embed()
          .setFooter(bot.user.tag, bot.user.displayAvatarURL())
          .setAuthor('GitLab Update', 'https://i.gifer.com/DgvQ.gif')
          .setDescription('Restarted!')
      )
      fs.unlinkSync('./updateid.txt')
    })
  }

  for (var i = 0; i < bot.guilds.size; i++) {
    var channelsize = bot.guilds.get(guilds[i]).channels.filter(s => s.type !== 'category').size
    var usersize = bot.guilds.get(guilds[i]).members.size
    $.log(
      `Connected to "${bot.guilds.get(guilds[i]).name}" with ${channelsize} ${
        channelsize === 1 ? 'channel' : 'channels'
      } and ${usersize} ${usersize === 1 ? 'user' : 'users'}${i === bot.guilds.size - 1 ? '\n' : ''}`
    )
    var conf = $.getServerConfig(guilds[i])
    if (conf.channel.debug && process.env.message && process.env.message !== 'updated') {
      var temp = $.embed().setFooter(bot.user.tag, bot.user.displayAvatarURL())
      if (process.env.message === 'crashed') {
        temp
          .setAuthor('Error', 'https://i.imgur.com/1vOMHlr.png')
          .setDescription('Server Crashed. Restarted.')
      } else if (process.env.message === 'restarted') {
        temp.setAuthor('Restarted!')
      }
      bot.channels.get(conf.channel.debug).send(temp)
    }
  }

  loaded = true
})

bot.on('ready', function() {
  bot.user.setPresence({
    activity: {
      name: bot.config.game.name,
      type: bot.config.game.type.toUpperCase()
    },
    status: bot.config.status
  })
})

bot.on('message', async message => {
  if (!loaded) return
  if (message.author.bot) return
  if (message.channel.type === 'dm') {
    if (message.content.trim() === 'invite') {
      bot.generateInvite(['ADMINISTRATOR']).then(link => {
        message.reply(`Generated bot invite link: ${link}`)
      })
    }
    return
  }

  if (message.content.startsWith(bot.user.toString())) {
    var content = message.content.replace(bot.user.toString().replace('@', '@!'), '').trim()
    if (content) {
      try {
        const data = await $.fetch(`https://program-o.com/v3/chat.php?say=${content}`)
        message.channel.send($.embed(`${message.author.toString()} ${data.conversation.say.bot}`))
      } catch (err) {
        $.warn(err)
      }
    }
  }

  const server = $.getServerConfig(message.guild.id)

  message.content = await alias(message.content)

  if (!message.content.startsWith(server.prefix)) return

  var messageArray = message.content.trim().split(/\s/g)
  var cmd = messageArray[0].substring(server.prefix.length).toLowerCase()
  var args = messageArray.slice(1)

  if (cmd.startsWith('_')) return

  if (
    !$.isOwner(message.author.id) &&
    message.member.roles.filter(s => s.name !== '@everyone').size === 0 &&
    server.strictmode
  ) {
    message.channel.send($.embed('You must have at least one role to command me.'))
    return
  }

  switch (getModule(cmd)) {
    case 'admin':
      processBeforeCommand()
      var admin = new Administration(message)
      admin[cmd](args)
      break
    case 'music':
      processBeforeCommand()
      var music = new Music(message)
      music[cmd](args)
      break
    case 'util':
      processBeforeCommand()
      var utils = new Utilities(message)
      utils[cmd](args)
      break
    case 'search':
      processBeforeCommand()
      var search = new Searches(message)
      search[cmd](args)
      break
    case 'games':
      processBeforeCommand()
      var games = new Games(message)
      games[cmd](args)
      break
  }

  function processBeforeCommand() {
    if (server.deleteoncmd) {
      message.delete().catch(() => {})
    }
    bot.commandExecuted += 1
    $.log('Command Executed ' + message.content.trim(), message)
  }

  async function alias(msg) {
    var alias = server.aliases.filter(x => x.name === msg)[0]

    if (alias) {
      alias.cmd = alias.cmd.replace('{0}', server.prefix)
      var m = await message.channel.send($.embed(`Executing \`${alias.cmd}\``))
      m.delete({ timeout: 3000 }).catch(() => {})
      return alias.cmd
    } else {
      return msg
    }
  }
})

bot.on('error', err => {
  $.warn('Bot Error: ' + err)
})

process.on('uncaughtException', err => {
  $.warn('Uncaught Exception: ' + (err.stack || err))
})

bot.loadModules = async renew => {
  loaded = false
  time = new Date()

  if (!renew) {
    var modules = ['games', 'music', 'events']
    for (var module of modules) {
      bot[module] = {}
    }
  }

  try {
    if (renew) {
      bot.env = dotenv.parse(fs.readFileSync('./.env'))
      bot.package = reload('../package')
      $.log(`Loading Functions Module...`)
      $ = reload('./assets/functions')
      await $.refreshServerConfig()
    }
    $.log(`Loading Administration Module...`)
    Administration = reload('./modules/administration')
    $.log(`Loading Utilities Module...`)
    Utilities = reload('./modules/utilities')
    $.log(`Loading Music Module...`)
    Music = reload('./modules/music')
    $.log(`Loading Searches Module...`)
    Searches = reload('./modules/searches')
    $.log(`Loading Games Module...`)
    Games = reload('./modules/games')
    $.log(`Loading Events Module...\n`)
    Events = reload('./modules/events')
  } catch (err) {
    $.warn(err)
  }

  bot.modules = {
    admin: getAllFuncs(new Administration()),
    music: getAllFuncs(new Music()),
    util: getAllFuncs(new Utilities()),
    search: getAllFuncs(new Searches()),
    games: getAllFuncs(new Games())
  }

  $.log(`Loaded All Modules in ${((Date.now() - time) / 1000).toFixed(2)} secs.\n`)
  loaded = true
}

bot.loadEvents = () => {
  bot.on('voiceStateUpdate', (x, y) => {
    Events.voiceStateUpdate(x, y)
  })
  bot.on('presenceUpdate', (x, y) => {
    Events.presenceUpdate(x, y)
  })
  bot.on('guildMemberAdd', x => {
    Events.guildMemberAdd(x)
  })
  bot.on('guildMemberRemove', x => {
    Events.guildMemberRemove(x)
  })
  bot.on('guildCreate', x => {
    Events.guildCreate(x)
  })
  bot.on('messageDelete', x => {
    Events.messageDelete(x)
  })
}

function getModule(command) {
  var modules = bot.modules
  var modulekeys = Object.keys(modules)
  for (var i = 0; i < modulekeys.length; i++) {
    var commandkeys = modules[Object.keys(modules)[i]]
    for (var j = 0; j < commandkeys.length; j++) {
      if (command === commandkeys[j]) {
        return Object.keys(modules)[i]
      }
    }
  }
}

function getAllFuncs(obj) {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(obj)).filter(
    x => x !== 'constructor' && !x.startsWith('_')
  )
}

function displayAscii() {
  console.log(
    colors.rainbow(`
 __    _  _______  _______  __    _  _______  _______  _______   
|  |  | ||       ||       ||  |  | ||  _    ||       ||       |
|   |_| ||    ___||   _   ||   |_| || |_|   ||   _   ||_     _|
|       ||   |___ |  | |  ||       ||       ||  | |  |  |   |
|  _    ||    ___||  |_|  ||  _    ||  _   | |  |_|  |  |   |
| | |   ||   |___ |       || | |   || |_|   ||       |  |   |
|_|  |__||_______||_______||_|  |__||_______||_______|  |___|
`)
  )
}

module.exports = bot
