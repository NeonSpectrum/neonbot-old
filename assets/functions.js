const fs = require('fs-extra')
const Discord = require('discord.js')
const moment = require('moment')
const bot = require("../bot")
const fetch = require('node-fetch')
const colors = require('colors/safe')

var servers, config = bot.config,
  db = bot.db

var spotify = {
  token: null,
  expiration: null
}

var $ = {}

$.log = (content, message) => {
  if (message) {
    console.log(`${colors.yellow("------ " + moment().format('YYYY-MM-DD hh:mm:ss A') + " ------")}
   ${colors.cyan("Guild")}: ${message.channel.guild.name}
   ${colors.cyan("Channel")}: ${message.channel.name}
   ${colors.cyan("User")}: ${message.author.tag}
   ${colors.cyan("Message")}: ${content}
`)
  } else {
    console.log(`${colors.yellow(moment().format('YYYY-MM-DD hh:mm:ss A'))} | ${colors.cyan(content)}`)
  }
}

$.warn = (message, send = true) => {
  const bot = require('../bot')
  console.log(`${colors.yellow(moment().format('YYYY-MM-DD hh:mm:ss A'))}${typeof message == "object" ? ` | ${message.channel.guild.name}` : ""} | ${colors.red(message)}`)
  if (send) {
    var guilds = Array.from(bot.guilds.keys())
    for (var i = 0; i < guilds.length; i++) {
      var conf = $.getServerConfig(guilds[i])
      if (conf.channel.debug) {
        bot.channels.get(conf.channel.debug).send($.embed()
          .setAuthor("Error", "https://i.imgur.com/1vOMHlr.png")
          .setDescription(message)
          .setFooter(bot.user.tag, `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
        )
      }
    }
  }
}

$.embed = (message) => {
  var e = new Discord.MessageEmbed().setColor("#59ABE3")
  if (message)
    e.setDescription(message)
  return e
}

$.isOwner = (id) => {
  return process.env.OWNER_ID.split(",").indexOf(id) > -1
}

$.processDatabase = (guilds) => {
  return new Promise(async (resolve, reject) => {
    var items = await db.collection("servers").find({}).toArray()
    for (var i = 0; i < guilds.length; i++) {
      if (!items.find((x) => x.server_id == guilds[i])) {
        await db.collection("servers").insert({
          server_id: guilds[i],
          prefix: process.env.PREFIX,
          deleteoncmd: false,
          strictmode: false,
          aliases: [],
          channel: {},
          music: {
            volume: 100,
            autoplay: false,
            repeat: "off",
            autoresume: false,
            roles: {}
          }
        })
      }
    }
    $.refreshServerConfig().then(() => {
      resolve()
    })
  })
}

$.refreshConfig = () => {
  return new Promise((resolve, reject) => {
    db.collection("settings").find({}).toArray((err, items) => {
      config = items[0]
      resolve()
    })
  })
}

$.getServerConfig = (id) => {
  for (var i = 0; i < servers.length; i++) {
    if (servers[i].server_id == id) {
      return servers[i]
    }
  }
}

$.refreshServerConfig = () => {
  return new Promise((resolve, reject) => {
    db.collection("servers").find({}).toArray((err, items) => {
      servers = items
      resolve()
    })
  })
}

$.updateConfig = (options) => {
  return new Promise((resolve, reject) => {
    db.collection("settings").update({}, {
      $set: options
    }, async (err, res) => {
      if (err) $.log("Updating to database: " + err)
      await $.refreshConfig()
      resolve($.getConfig())
    })
  })
}

$.updateServerConfig = (id, options) => {
  return new Promise((resolve, reject) => {
    db.collection("servers").update({
      server_id: id
    }, {
      $set: options
    }, async (err, res) => {
      if (err) $.log("Updating to database: " + err)
      await $.refreshServerConfig()
      resolve($.getServerConfig(id))
    })
  })
}

$.addAlias = (id, owner, args) => {
  return new Promise((resolve, reject) => {
    db.collection("servers").update({
      server_id: id
    }, {
      $push: {
        aliases: {
          name: args[0],
          cmd: args.slice(1).join(" "),
          owner: owner
        }
      }
    }, async (err, res) => {
      if (err) $.log("Updating to database: " + err)
      await $.refreshServerConfig()
      resolve($.getServerConfig(id))
    })
  })
}

$.editAlias = (id, alias) => {
  return new Promise((resolve, reject) => {
    db.collection("servers").update({
      server_id: id,
      "aliases.name": alias.name
    }, {
      $set: {
        "aliases.$": alias
      }
    }, async (err, res) => {
      if (err) $.log("Updating to database: " + err)
      await $.refreshServerConfig()
      resolve($.getServerConfig(id))
    })
  })
}

$.deleteAlias = (id, name) => {
  return new Promise((resolve, reject) => {
    db.collection("servers").update({
      server_id: id
    }, {
      $pull: {
        aliases: {
          name: name
        }
      }
    }, async (err, res) => {
      if (err) $.log("Updating to database: " + err)
      await $.refreshServerConfig()
      resolve($.getServerConfig(id))
    })
  })
}

$.storeMusicPlaylist = (id, arr) => {
  var content = [id.voice, id.msg].concat(arr)
  fs.outputFile(`musiclist/${id.guild}.txt`, content.join("\r\n"), function() {})
}

$.getMusicPlaylist = (id) => {
  return new Promise((resolve, reject) => {
    var file = `musiclist/${id}.txt`
    if (fs.existsSync(file)) {
      fs.readFile(file, 'utf8', function(err, data) {
        resolve(data.split("\r\n"))
      })
    } else {
      resolve(null)
    }
  })
}

$.removeMusicPlaylist = (id) => {
  var file = `musiclist/${id}.txt`
  if (fs.existsSync(file)) {
    fs.unlink(file, function() {})
  }
}

$.fetchJSON = (url, obj) => {
  return new Promise(async resolve => {
    resolve(await (await fetch(url, obj)).json())
  })
}

$.fetchHTML = (url, obj) => {
  return new Promise(async resolve => {
    resolve(await (await fetch(url, obj)).text())
  })
}

$.getSpotifyToken = () => {
  return new Promise(async resolve => {
    if (moment() > spotify.expiration) {
      var json = await $.fetchJSON('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${new Buffer(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')}`,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: "grant_type=client_credentials"
      })
      spotify.token = json.access_token
      spotify.expiration = moment().add(json.expires_in - 600, 'seconds')
    }
    resolve(spotify.token)
  })
}

$.formatSeconds = (secs, format) => {
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

  if (!format) {
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

$.convertToSeconds = (str) => {
  var arr = str.split(":")
  if (arr.length == 3) {
    arr[0] = arr[0] * 3600
    arr[1] = arr[1] * 60
  } else if (arr.length == 2) {
    arr[0] = arr[0] * 60
  }
  return +arr.reduce((x, y) => +x + +y)
}

$.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

module.exports = $