require('dotenv').config()
const fs = require('fs')
const moment = require('moment')
const colors = require('colors/safe')
const Discord = require("discord.js")
const bot = new Discord.Client()
const MongoClient = require('mongodb').MongoClient
const $ = require('./assets/functions')

var Admin, Util, Music, Search, Games;
var db, guildlist, config = {
  env: process.env
}

var loaded = false,
  time = new Date()

if (!config.env.TOKEN || !config.env.PREFIX || !config.env.OWNER_ID) {
  console.log(colors.red("Missing Credentials in environment..."))
  process.exit(10)
}

displayAscii()
MongoClient.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, async (err, client) => {
  if (err) {
    console.log(`${err}\nFailed to establish connection to ${process.env.DB_HOST}`)
    process.exit(1)
  }
  $.log(`MongoDB connection established on ${process.env.DB_HOST} in ${((Date.now() - time) / 1000).toFixed(2)} secs.\n`)
  db = client.db(process.env.DB_NAME)
  $.setDB(db)

  var items = await db.collection("settings").find({}).toArray()
  if (items.length == 0) {
    var insert = await db.collection('settings').insert({
      game: {
        type: "",
        name: ""
      }
    })
    items = insert.ops
  }
  guildlist = await db.collection("servers").find({}).toArray()
  config.settings = items[0]

  $.setConfig(config)

  bot.login(config.env.TOKEN)
})

bot.on('ready', async () => {
  var guilds = Array.from(bot.guilds.keys())
  await $.processDatabase(guilds, guildlist)

  $.log(`Loaded Settings in ${((Date.now() - time) / 1000).toFixed(2)} secs.`)

  time = new Date()

  try {
    Administration = require('./modules/administration')
    Utilities = require('./modules/utilities')
    Music = require('./modules/music')
    Searches = require('./modules/searches')
    Games = require('./modules/games')
    require('./modules/events')
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

  $.log(`Loaded Modules in ${((Date.now() - time) / 1000).toFixed(2)} secs.\n`)

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

  bot.user.setActivity(config.settings.game.name, {
    type: config.settings.game.type.toUpperCase()
  })

  loaded = true
})

bot.on('message', message => {
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