var fs = require('fs')
var glob = require('glob')

var config = require('./config.json')
var Discord = require("discord.js")
var bot = new Discord.Client()

var util_module = require('./modules/utilities')
var music_module = require('./modules/music')

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
  var util = util_module(bot, message)

  var messageArray = message.content.split(" ")
  var cmd = messageArray[0].substring(config.prefix.length)
  var args = messageArray.slice(1)

  switch (cmd) {
    case 'help':
      util.help(args)
      break
    case "addrole":
      util.addrole(args)
      break
    case "ban":
      util.ban(args)
      break
    case "botinfo":
      util.botinfo()
      break
    case "clear":
      util.clear(args)
      break
    case "kick":
      util.kick(args)
      break
    case "prefix":
      util.prefix(args)
      break
    case "removerole":
      util.removerole(args)
      break
    case "say":
      util.say(args)
      break
    case "serverinfo":
      util.serverinfo()
      break
    case 'play':
      music.play(args)
      break
    case 'stop':
      music.stop()
      break
    case 'skip':
      music.skip()
      break
    case 'list':
      music.list()
      break
    case 'volume':
      music.volume(args)
      break
    case 'repeat':
      music.repeat()
      break
    case 'pause':
      music.pause()
      break
    case 'resume':
      music.resume()
      break
    default:
      message.reply("Unknown Command")
      break
  }
})

bot.login(config.token)