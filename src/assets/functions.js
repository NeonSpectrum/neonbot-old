const fs = require('fs-extra')
const Discord = require('discord.js')
const moment = require('moment')
const bot = require('../bot')
const colors = require('colors/safe')
const axios = require('axios')

const { db } = bot

var spotify = {
  token: null,
  expiration: null
}

var servers = []
var $ = {}

$.log = (content, message) => {
  if (message) {
    console.log(`${colors.yellow('------ ' + moment().format('YYYY-MM-DD hh:mm:ss A') + ' ------')}
   ${colors.cyan('Guild')}: ${message.channel.guild.name}
   ${colors.cyan('Channel')}: ${message.channel.name}
   ${colors.cyan('User')}: ${message.author.tag}
   ${colors.cyan('Message')}: ${content}
`)
  } else {
    console.log(`${colors.yellow(moment().format('YYYY-MM-DD hh:mm:ss A'))} | ${colors.cyan(content)}`)
  }
}

$.warn = (title = '', message, send = true) => {
  console.log(`${colors.yellow(moment().format('YYYY-MM-DD hh:mm:ss A'))} | ${colors.red(title)}
   ${colors.red(message)}`)
  if (send) {
    var guilds = Array.from(bot.guilds.keys())
    for (var i = 0; i < guilds.length; i++) {
      var conf = $.getServerConfig(guilds[i])
      if (conf.channel.debug) {
        bot.channels.get(conf.channel.debug).send(
          $.embed()
            .setAuthor('Error', 'https://i.imgur.com/1vOMHlr.png')
            .setTitle(title)
            .setDescription(message)
            .setFooter(bot.user.tag, bot.user.displayAvatarURL())
        )
      }
    }
  }
}

$.embed = message => {
  var e = new Discord.MessageEmbed().setColor('#59ABE3')
  if (message) {
    e.setDescription(message)
  }
  return e
}

$.isOwner = id => {
  return bot.env.OWNER_ID.split(',').indexOf(id) > -1
}

$.processDatabase = async guilds => {
  const items = await db
    .collection('servers')
    .find({})
    .toArray()

  for (let guild of guilds) {
    if (!items.find(x => x.server_id === guild)) {
      await db.collection('servers').insertOne({
        server_id: guilds[i],
        prefix: bot.env.PREFIX,
        deleteoncmd: false,
        strictmode: false,
        aliases: [],
        channel: {},
        music: {
          volume: 100,
          autoplay: false,
          repeat: 'off',
          autoresume: false,
          roles: {}
        }
      })
    }
  }

  await $.refreshServerConfig()
}

$.refreshConfig = async () => {
  try {
    bot.config = await db.collection('settings').findOne()
  } catch (err) {
    $.warn(err)
  }
}

$.getServerConfig = id => {
  for (var i = 0; i < servers.length; i++) {
    if (servers[i].server_id === id) {
      return servers[i]
    }
  }
}

$.refreshServerConfig = async () => {
  try {
    servers = await db
      .collection('servers')
      .find({})
      .toArray()
  } catch (err) {
    $.warn(err)
  }
}

$.updateConfig = async options => {
  try {
    await db.collection('settings').updateOne(
      {},
      {
        $set: options
      }
    )
  } catch (err) {
    $.warn(err)
  }
}

$.updateServerConfig = async (id, options) => {
  try {
    await db.collection('servers').updateOne(
      {
        server_id: id
      },
      {
        $set: options
      }
    )
    await $.refreshServerConfig()
  } catch (err) {
    $.warn(err)
  }
  return $.getServerConfig(id)
}

$.addAlias = async (id, owner, args) => {
  try {
    await db.collection('servers').updateOne(
      {
        server_id: id
      },
      {
        $push: {
          aliases: {
            name: args[0],
            cmd: args.slice(1).join(' '),
            owner: owner
          }
        }
      }
    )
    await $.refreshServerConfig()
  } catch (err) {
    $.warn(err)
  }
  return $.getServerConfig(id)
}

$.editAlias = async (id, alias) => {
  try {
    await db.collection('servers').updateOne(
      {
        server_id: id,
        'aliases.name': alias.name
      },
      {
        $set: {
          'aliases.$': alias
        }
      }
    )

    await $.refreshServerConfig()
  } catch (err) {
    $.warn(err)
  }
  return $.getServerConfig(id)
}

$.deleteAlias = async (id, name) => {
  try {
    await db.collection('servers').updateOne(
      {
        server_id: id
      },
      {
        $pull: {
          aliases: {
            name: name
          }
        }
      },
      async (err, res) => {
        if (err) return $.warn(err)
      }
    )
    await $.refreshServerConfig()
  } catch (err) {
    $.warn(err)
  }
  return $.getServerConfig(id)
}

$.storeMusicPlaylist = (id, arr) => {
  var dir = './tmp/'
  var content = {
    playlist: arr
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
  fs.writeFileSync(`./tmp/${id}.json`, JSON.stringify(content, null, 2))
}

$.getMusicPlaylist = id => {
  return fs.existsSync(`./tmp/${id}.json`) ? require(`../../tmp/${id}.json`).playlist : null
}

$.clearMusicPlaylist = id => {
  fs.writeFileSync(`./tmp/${id}.json`, JSON.stringify({ playlist: [] }, null, 2))
}

$.fetch = async (url, obj = {}) => {
  try {
    var { data } = await axios.get(url, obj)
    return data
  } catch (err) {
    $.warn(err)
  }
}

$.getSpotifyToken = async () => {
  if (moment() > spotify.expiration) {
    var json = await $.fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          bot.env.SPOTIFY_CLIENT_ID + ':' + bot.env.SPOTIFY_CLIENT_SECRET
        ).toString('base64')}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })
    spotify.token = json.access_token
    spotify.expiration = moment().add(json.expires_in - 600, 'seconds')
  }
  return spotify.token
}

$.formatSeconds = (secs, format) => {
  var secNum = parseInt(secs, 10)
  var hours = Math.floor(secNum / 3600)
  var minutes = Math.floor((secNum - hours * 3600) / 60)
  var seconds = secNum - hours * 3600 - minutes * 60

  if (hours < 10) {
    hours = '0' + hours
  }
  if (minutes < 10) {
    minutes = '0' + minutes
  }
  if (seconds < 10) {
    seconds = '0' + seconds
  }

  if (!format) {
    var time = hours + ':' + minutes + ':' + seconds
    if (hours === '00') {
      time = time.substring(3)
    }
    return time
  } else if (format === 3) {
    return hours + ':' + minutes + ':' + seconds
  } else if (format === 2) {
    minutes = parseInt(hours) * 60 + parseInt(minutes)
    return (minutes < 10 ? '0' + minutes : minutes) + ':' + seconds
  } else if (format === 1) {
    seconds = parseInt(hours) * 60 + parseInt(minutes) * 60 + parseInt(seconds)
    return seconds < 10 ? '0' + seconds : seconds
  }
}

$.convertToSeconds = str => {
  var arr = str.split(':')
  if (arr.length === 3) {
    arr[0] = arr[0] * 3600
    arr[1] = arr[1] * 60
  } else if (arr.length === 2) {
    arr[0] = arr[0] * 60
  }
  return +arr.reduce((x, y) => +x + +y)
}

$.wait = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = $
