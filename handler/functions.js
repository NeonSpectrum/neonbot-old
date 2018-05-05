const fs = require('fs')
const Discord = require('discord.js')
const moment = require('moment')
const colors = require('colors/safe')

var servers, config, db, currentGuild

module.exports.log = (content, message) => {
  const guild = currentGuild
  if (message) {
    console.log(`${colors.yellow("------ "+moment().format('YYYY-MM-DD hh:mm:ss A')+" ------")}
   ${colors.cyan("Guild")}: ${message.channel.guild.name}
   ${colors.cyan("Channel")}: ${message.channel.name}
   ${colors.cyan("Message")}: ${content}
`)
  } else {
    console.log(`${colors.yellow(moment().format('YYYY-MM-DD hh:mm:ss A'))} | ${colors.cyan(content)}`)
  }
}

module.exports.warn = (message, send = true) => {
  const bot = require('../bot')
  console.log(`${colors.yellow(moment().format('YYYY-MM-DD hh:mm:ss A'))}${typeof message == "object" ? ` | ${message.channel.guild.name}` : ""} | ${colors.red(message)}`)
  if (send) {
    var guilds = Array.from(bot.guilds.keys())
    for (var i = 0; i < guilds.length; i++) {
      var conf = module.exports.getServerConfig(guilds[i])
      if (conf.channel.debug) {
        bot.channels.get(conf.channel.debug).send(module.exports.embed()
          .setAuthor("Error", "https://i.imgur.com/1vOMHlr.png")
          .setDescription(message)
          .setFooter(bot.user.tag, `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
        )
      }
    }
  }
}

module.exports.embed = (message) => {
  var e = new Discord.MessageEmbed().setColor("#59ABE3")
  if (message !== undefined)
    e.setDescription(message)
  return e
}

module.exports.isOwner = (id) => {
  return id == config.ownerid
}

module.exports.isInArray = (arr, value) => {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] == value) return true
  }
  return false
}

module.exports.addIfNotExists = (arr, value) => {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] == value) return arr
  }
  arr.push(value)
  return arr
}

module.exports.processDatabase = (arr, items) => {
  return new Promise((resolve, reject) => {
    var i = 0
    var loop = async () => {
      if (i != arr.length) {
        var isExists = false
        for (var j = 0; j < items.length; j++) {
          if (items[j].server_id == arr[i]) {
            isExists = true
            break
          }
        }
        if (!isExists) {
          db.collection("servers").insert({
            server_id: arr[i],
            prefix: config.default_prefix,
            deleteoncmd: false,
            channel: {
              log: null,
              voicetts: null,
              debug: null
            },
            music: {
              volume: 100,
              autoplay: false,
              repeat: "off"
            }
          }, (err, items) => {
            i++
            loop()
          })
        } else {
          i++
          loop()
        }
      } else {
        await module.exports.refreshServerConfig()
        resolve()
      }
    }
    loop()
  })
}

module.exports.setDB = (x) => {
  db = x
}

module.exports.getDB = () => {
  return db
}
module.exports.setConfig = (x) => {
  config = x
}

module.exports.getConfig = () => {
  return config
}

module.exports.refreshConfig = () => {
  return new Promise((resolve, reject) => {
    db.collection("settings").find({}).toArray(async (err, items) => {
      config = items[0]
      resolve()
    })
  })
}

module.exports.getServerConfig = (id) => {
  for (var i = 0; i < servers.length; i++) {
    if (servers[i].server_id == id) {
      return servers[i]
    }
  }
}

module.exports.refreshServerConfig = () => {
  return new Promise((resolve, reject) => {
    db.collection("servers").find({}).toArray(async (err, items) => {
      servers = items
      resolve()
    })
  })
}

module.exports.updateConfig = (options) => {
  return new Promise((resolve, reject) => {
    db.collection("settings").update({}, {
      $set: options
    }, async (err, res) => {
      if (err) module.exports.log("Updating to database: " + err)
      await module.exports.refreshConfig()
      resolve(module.exports.getConfig())
    })
  })
}

module.exports.updateServerConfig = (id, options) => {
  return new Promise((resolve, reject) => {
    db.collection("servers").update({
      server_id: id
    }, {
      $set: options
    }, async (err, res) => {
      if (err) module.exports.log("Updating to database: " + err)
      await module.exports.refreshServerConfig()
      resolve(module.exports.getServerConfig(id))
    })
  })
}

module.exports.formatSeconds = (secs, format) => {
  var sec_num = parseInt(secs, 10)
  var hours = Math.floor(sec_num / 3600)
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60)
  var seconds = sec_num - (hours * 3600) - (minutes * 60)

  if (hours < 10) {
    hours = "0" + hours
  }
  if (minutes < 10) {
    minutes = "0" + minutes
  }
  if (seconds < 10) {
    seconds = "0" + seconds
  }

  if (format == undefined) {
    var time = hours + ':' + minutes + ':' + seconds
    if (hours == "00") {
      time = time.substring(3)
    }
    return time
  } else if (format == 3) {
    return hours + ':' + minutes + ':' + seconds
  } else if (format == 2) {
    minutes = parseInt(hours) * 60 + parseInt(minutes)
    return (minutes < 10 ? "0" + minutes : minutes) + ':' + seconds
  } else if (format == 1) {
    seconds = parseInt(hours) * 60 + parseInt(minutes) * 60 + parseInt(seconds)
    return seconds < 10 ? "0" + seconds : seconds
  }
}

module.exports.wait = async (ms) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}