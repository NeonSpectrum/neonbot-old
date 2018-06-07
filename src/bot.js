require('dotenv').config()
const fs = require('fs')
const reload = require('require-reload')(require)
const moment = require('moment')
const fetch = require('node-fetch')
const colors = require('colors/safe')
const bot = new(require("discord.js")).Client()
const MongoClient = require('mongodb').MongoClient
const package = reload("../package")

var $ = reload('./assets/functions')
var Admin, Util, Music, Search, Games, Events

var loaded = false,
  time = new Date()

if (!process.env.TOKEN || !process.env.PREFIX || !process.env.OWNER_ID) {
  $.warn("Missing Credentials in environment...", false)
  process.exit(10)
}

displayAscii()
$.log(`Starting ${package.name} v${package.version}`)

MongoClient.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, async (err, client) => {
  if (err) {
    $.warn(`${err}\nFailed to establish connection to ${process.env.DB_HOST}`, false)
    process.exit(10)
  }
  $.log(`MongoDB connection established on ${process.env.DB_HOST} in ${((Date.now() - time) / 1000).toFixed(2)} secs.\n`)
  var db = client.db(process.env.DB_NAME)
  bot.db = db

  time = new Date()
  var items = await db.collection("settings").find({}).toArray()
  if (items.length == 0) {
    items = (await db.collection('settings').insert({
      status: "online",
      game: {
        type: "",
        name: ""
      }
    })).ops
  }
  bot.config = items[0]

  $ = reload('./assets/functions')

  bot.login(process.env.TOKEN)
})

bot.on('ready', async () => {
  bot.eventList = []

  var guilds = Array.from(bot.guilds.keys())
  await $.processDatabase(guilds)

  $.log(`Loaded Settings in ${((Date.now() - time) / 1000).toFixed(2)} secs.\n`)

  await bot.loadModules()
  bot.loadEvents()

  $.log(`Logged in as ${bot.user.tag}\n`)

  if (process.env.message == "updated") {
    var temp = $.embed()
      .setFooter(bot.user.tag, bot.user.displayAvatarURL())
      .setAuthor("GitLab Update", "https://i.gifer.com/DgvQ.gif")
      .setDescription("Updated!")
    fs.readFile('updateid.txt', 'utf8', function(err, data) {
      bot.channels.get(data).send(temp)
      fs.unlink('updateid.txt', function() {})
    });
  }

  for (var i = 0; i < bot.guilds.size; i++) {
    var channelsize = bot.guilds.get(guilds[i]).channels.filter(s => s.type != "category").size
    var usersize = bot.guilds.get(guilds[i]).members.size
    $.log(`Connected to "${bot.guilds.get(guilds[i]).name}" with ${channelsize} ${channelsize == 1 ? "channel" : "channels"} and ${usersize} ${usersize == 1 ? "user" : "users"}${i == bot.guilds.size - 1 ? "\n" : ""}`)
    var conf = $.getServerConfig(guilds[i])
    if (conf.channel.debug && process.env.message && process.env.message != "updated") {
      var temp = $.embed().setFooter(bot.user.tag, bot.user.displayAvatarURL())
      if (process.env.message == "crashed") {
        temp.setAuthor("Error", "https://i.imgur.com/1vOMHlr.png")
          .setDescription("Server Crashed. Restarted.")
      } else if (process.env.message == "restarted") {
        temp.setAuthor("Restarted!")
      }
      bot.channels.get(conf.channel.debug).send(temp)
    }
    var playlist = await $.getMusicPlaylist(guilds[i])
    if (!playlist) continue
    var voiceChannel = playlist[0]
    var music = new Music({
      guild: bot.guilds.get(guilds[i]),
      channel: bot.channels.get(playlist[1]),
      author: bot.user,
      member: {
        voiceChannel: bot.channels.get(voiceChannel)
      }
    })
    music._processAutoResume(guilds[i], playlist.slice(2))
  }

  bot.user.setPresence({
    activity: {
      name: bot.config.game.name,
      type: bot.config.game.type.toUpperCase()
    },
    status: bot.config.status
  })

  loaded = true
})

bot.on('message', async message => {
  var server = $.getServerConfig(message.guild.id)
  if (!loaded) return
  if (message.author.bot) return
  if (message.channel.type === "dm") {
    if (message.content.trim() == "invite") {
      bot.generateInvite(['ADMINISTRATOR'])
        .then(link => {
          message.reply(`Generated bot invite link: ${link}`)
        });
    }
    return
  }
  if (!$.isOwner(message.author.id) && message.member.roles.filter(s => s.name != "@everyone").size == 0 && server.strictmode) {
    message.channel.send($.embed("You must have at least one role to command me."))
    return
  }

  if (message.content.startsWith(bot.user.toString().replace("@", "@!"))) {
    var content = message.content.replace(bot.user.toString().replace("@", "@!"), "").trim()
    if (content) {
      const response = await fetch(`https://program-o.com/v3/chat.php?say=${content}`);
      const json = await response.json();
      message.channel.send($.embed(`${message.author.toString()} ${json.conversation.say.bot}`));
    }
  }

  message.content = await alias(message.content)

  if (!message.content.startsWith(server.prefix)) return

  var messageArray = message.content.trim().split(/\s/g)
  var cmd = messageArray[0].substring(server.prefix.length).toLowerCase()
  var args = messageArray.slice(1)

  if (cmd.startsWith("_")) return

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
    case "util":
      processBeforeCommand()
      var utils = new Utilities(message)
      utils[cmd](args)
      break
    case "search":
      processBeforeCommand()
      var search = new Searches(message)
      search[cmd](args)
      break
    case "games":
      processBeforeCommand()
      var games = new Games(message)
      games[cmd](args)
      break
  }

  function processBeforeCommand() {
    if (server.deleteoncmd) {
      message.delete().catch(() => {})
    }
    $.log("Command Executed " + message.content.trim(), message)
  }

  function alias(msg) {
    return new Promise(resolve => {
      var alias = server.aliases.filter(x => x.name == msg)[0]
      if (alias) {
        alias.cmd = alias.cmd.replace("{0}", server.prefix)
        message.channel.send($.embed(`Executing \`${alias.cmd}\``)).then(m => {
          m.delete({
            timeout: 3000
          }).catch(() => {})
          resolve(alias.cmd)
        })
      } else {
        resolve(msg)
      }
    })
  }
})

bot.on('error', (err) => {
  $.warn("Bot Error: " + err)
})

process.on('uncaughtException', (err) => {
  $.warn("Uncaught Exception: " + (err.stack || err))
});

bot.loadModules = (renew) => {
  return new Promise(async resolve => {
    loaded = false
    time = new Date()

    if (!renew) {
      var modules = ["games", "music", "events"]
      for (var i = 0; i < modules.length; i++) {
        bot[modules[i]] = {}
      }
    }

    try {
      if (renew) {
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
      "admin": getAllFuncs(new Administration()),
      "music": getAllFuncs(new Music()),
      "util": getAllFuncs(new Utilities()),
      "search": getAllFuncs(new Searches()),
      "games": getAllFuncs(new Games())
    }

    $.log(`Loaded All Modules in ${((Date.now() - time) / 1000).toFixed(2)} secs.\n`)
    loaded = true
    resolve()
  })
}

bot.loadEvents = () => {
  bot.on("voiceStateUpdate", (x, y) => {
    Events.voiceStateUpdate(x, y)
  })
  bot.on("presenceUpdate", (x, y) => {
    Events.presenceUpdate(x, y)
  })
  bot.on("guildMemberAdd", (x) => {
    Events.guildMemberAdd(x)
  })
  bot.on("guildMemberRemove", (x) => {
    Events.guildMemberRemove(x)
  })
  bot.on("guildCreate", (x) => {
    Events.guildCreate(x)
  })
  bot.on("messageDelete", (x) => {
    Events.messageDelete(x)
  })
}

function getModule(command) {
  var modules = bot.modules
  var modulekeys = Object.keys(modules)
  for (var i = 0; i < modulekeys.length; i++) {
    var commandkeys = modules[Object.keys(modules)[i]]
    for (var j = 0; j < commandkeys.length; j++) {
      if (command === commandkeys[j])
        return Object.keys(modules)[i]
    }
  }
}

function getAllFuncs(obj) {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(obj)).filter((x) => x != "constructor" && !x.startsWith("_"))
}

function displayAscii() {
  console.log(colors.rainbow(`
 __    _  _______  _______  __    _  _______  _______  _______   
|  |  | ||       ||       ||  |  | ||  _    ||       ||       |
|   |_| ||    ___||   _   ||   |_| || |_|   ||   _   ||_     _|
|       ||   |___ |  | |  ||       ||       ||  | |  |  |   |
|  _    ||    ___||  |_|  ||  _    ||  _   | |  |_|  |  |   |
| | |   ||   |___ |       || | |   || |_|   ||       |  |   |
|_|  |__||_______||_______||_|  |__||_______||_______|  |___|
`))
}

module.exports = bot