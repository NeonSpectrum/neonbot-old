require('dotenv').config()
const fs = require('fs')
const moment = require('moment')
const colors = require('colors/safe')
const Discord = require("discord.js")
const bot = new Discord.Client()
const MongoClient = require('mongodb').MongoClient
const $ = require('./assets/functions')

var Admin, Util, Music, Search, Games;
var db, guildlist, config

var loaded = false,
  settingsTime

displayAscii()
MongoClient.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, (err, client) => {
  if (!err) {
    $.log(`MongoDB connection established on ${process.env.DB_HOST}\n`)
    db = client.db(process.env.DB_NAME)
    $.setDB(db)
    settingsTime = new Date()
    db.collection("settings").find({}).toArray(async (err, items) => {
      if (items.length == 0) {
        items = await require('./setup.js')(db)
      }
      config = items[0]
      $.setConfig(config)

      db.collection("servers").find({}).toArray((err, items) => {
        guildlist = items
        bot.login(config.token)
      })
    })
  } else {
    throw `${err}\nFailed to establish connection to ${process.env.DB_HOST}`
  }
})

bot.on('ready', async () => {
  var guilds = Array.from(bot.guilds.keys())
  await $.processDatabase(guilds, guildlist)

  $.log(`Loaded Settings in ${((Date.now() - settingsTime) / 1000).toFixed(2)} secs.`)

  var modulesTime = new Date()
  try {
    require('./modules/events')
    Administration = require('./modules/administration')
    Utilities = require('./modules/utilities')
    Music = require('./modules/music')
    Searches = require('./modules/searches')
    Games = require('./modules/games')
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

  $.log(`Loaded Modules in ${((Date.now() - modulesTime) / 1000).toFixed(2)} secs.\n`)

  $.log(`Logged in as ${bot.user.tag}\n`)

  for (var i = 0; i < bot.guilds.size; i++) {
    var channelsize = bot.guilds.get(guilds[i]).channels.filter(s => s.type != "category").size
    var usersize = bot.guilds.get(guilds[i]).members.size
    $.log(`Connected to "${bot.guilds.get(guilds[i]).name}" with ${channelsize} ${channelsize == 1 ? "channel" : "channels"} and ${usersize} ${usersize == 1 ? "user" : "users"}${i == bot.guilds.size - 1 ? "\n" : ""}`)
    var conf = $.getServerConfig(guilds[i])
    if (conf.channel.debug && process.env.message) {
      var temp = $.embed().setFooter(bot.user.tag, `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
      if (process.env.message == "crashed") {
        temp.setAuthor("Error", "https://i.imgur.com/1vOMHlr.png")
          .setDescription("Server Crashed. Restarted.")
      } else if (process.env.message == "updated") {
        temp.setAuthor("GitHub Update", "https://assets-cdn.github.com/images/modules/logos_page/GitHub-Mark.png")
          .setDescription("Updated!")
      } else if (process.env.message == "restarted") {
        temp.setAuthor("Restarted!")
      }
      bot.channels.get(conf.channel.debug).send(temp)
    }
  }

  bot.user.setActivity(config.game.name, {
    type: config.game.type.toUpperCase()
  })

  loaded = true
})

bot.on('message', async message => {
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
  var server = $.getServerConfig(message.guild.id)
  if (!message.content.startsWith(server.prefix)) return

  var messageArray = message.content.trim().split(/\s/g)
  var cmd = messageArray[0].substring(server.prefix.length).toLowerCase()
  var args = messageArray.slice(1)

  switch (getModule(cmd)) {
    case 'admin':
      await processBeforeCommand()
      var admin = new Administration(message)
      admin[cmd](args)
      break
    case 'music':
      await processBeforeCommand()
      var music = new Music(message)
      music[cmd](args)
      break
    case "util":
      await processBeforeCommand()
      var utils = new Utilities(message)
      utils[cmd](args)
      break
    case "search":
      await processBeforeCommand()
      var search = new Searches(message)
      search[cmd](args)
      break
    case "games":
      await processBeforeCommand()
      var games = new Games(message)
      games[cmd](args)
      break
  }

  async function processBeforeCommand() {
    return new Promise(async (resolve, reject) => {
      if (server.deleteoncmd) {
        await message.delete()
      }
      $.log("Command Executed " + message.content.trim(), message)
      resolve()
    })
  }
})

bot.on('error', (err) => {
  $.warn("Bot Error: " + err)
})

process.on('uncaughtException', (err) => {
  $.warn("Uncaught Exception: " + (err.stack || err))
});

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
  return Object.getOwnPropertyNames(Object.getPrototypeOf(obj)).filter((x) => x != "constructor")
}

function displayAscii() {
  console.log(colors.rainbow(`
 _______  _______  _______  ___      __   __  _______  _______  __    _  ______   _______   
|       ||       ||       ||   |    |  | |  ||       ||   _   ||  |  | ||      | |   _   |  
|    ___||____   ||    ___||   |    |  |_|  ||    _  ||  |_|  ||   |_| ||  _    ||  |_|  |  
|   | __  ____|  ||   |___ |   |    |       ||   |_| ||       ||       || | |   ||       |  
|   ||  || ______||    ___||   |___ |_     _||    ___||       ||  _    || |_|   ||       |  
|   |_| || |_____ |   |___ |       |  |   |  |   |    |   _   || | |   ||       ||   _   |  
|_______||_______||_______||_______|  |___|  |___|    |__| |__||_|  |__||______| |__| |__|  
`))
}

module.exports = bot