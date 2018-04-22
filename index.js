var fs = require('fs')
var colors = require('colors/safe');
var Discord = require("discord.js")
var bot = new Discord.Client()
var config = require('./config.json')
var $ = require('./handler/functions')

var admin_module = require('./modules/administration')
var util_module = require('./modules/utilities')
var music_module = require('./modules/music')

var modules = {
  "admin": Object.keys(admin_module()),
  "music": Object.keys(music_module()),
  "util": Object.keys(util_module())
}

bot.on('ready', () => {
  $.log(`Logged in as ${bot.user.tag}!`)
  bot.user.setActivity("Baby Rina <3", {
    type: "WATCHING"
  })
})

bot.on('message', message => {
  if (message.author.bot) return
  if (message.channel.type === "dm") return
  if (!message.content.startsWith(config.prefix)) return

  var admin = admin_module(bot, message)
  var music = music_module(bot, message)
  var utils = util_module(bot, message)

  var messageArray = message.content.split(" ")
  var cmd = messageArray[0].substring(config.prefix.length)
    .toLowerCase()
  var args = messageArray.slice(1)

  switch (getModule(cmd)) {
    case 'admin':
      admin[cmd](args)
      break
    case 'music':
      music[cmd](args)
      break
    case "util":
      utils[cmd](args)
      break
  }
  if (config.bot.deleteoncmd) {
    message.delete()
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

console.log(colors.rainbow(`
 _______  _______  _______  ___      __   __  _______  _______  __    _  ______   _______   
|       ||       ||       ||   |    |  | |  ||       ||   _   ||  |  | ||      | |   _   |  
|    ___||____   ||    ___||   |    |  |_|  ||    _  ||  |_|  ||   |_| ||  _    ||  |_|  |  
|   | __  ____|  ||   |___ |   |    |       ||   |_| ||       ||       || | |   ||       |  
|   ||  || ______||    ___||   |___ |_     _||    ___||       ||  _    || |_|   ||       |  
|   |_| || |_____ |   |___ |       |  |   |  |   |    |   _   || | |   ||       ||   _   |  
|_______||_______||_______||_______|  |___|  |___|    |__| |__||_|  |__||______| |__| |__|  
`))