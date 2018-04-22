var fs = require('fs')
var glob = require('glob')
var config = require('./config.json')
var Discord = require("discord.js")
var bot = new Discord.Client()

var util_module = require('./modules/utilities')
var music_module = require('./modules/music')

var modules = {
  "music": Object.keys(music_module()),
  "util": Object.keys(util_module())
}

bot.on('ready', () => {
  console.log(`Logged in as ${bot.user.tag}!`)
  bot.user.setActivity("Baby Rina <3", {
    type: "WATCHING"
  })
})

bot.on('message', message => {
  if (message.author.bot) return
  if (message.channel.type === "dm") return
  if (!message.content.startsWith(config.prefix)) return

  var music = music_module(bot, message)
  var utils = util_module(bot, message)

  var messageArray = message.content.split(" ")
  var cmd = messageArray[0].substring(config.prefix.length)
  var args = messageArray.slice(1)

  switch (getModule(cmd)) {
    case 'music':
      music[cmd](args)
      break
    case "util":
      utils[cmd](args)
      break
    default:
      message.reply("Unknown Command")
      break
  }
})

bot.login(config.token)

function getModule(command) {
  var modulekeys = Object.keys(modules)
  for (var i = 0; i < modulekeys.length; i++) {
    var commandkeys = modules[Object.keys(modules)[i]]
    for (var j = 0; j < commandkeys.length; j++) {
      if (command === commandkeys[j])
        return Object.keys(modules)[i]
    }
  }
}