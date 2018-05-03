require('dotenv').config()
const fs = require('fs')
const moment = require('moment')
const colors = require('colors/safe');
const Discord = require("discord.js")
const bot = new Discord.Client()
const MongoClient = require('mongodb').MongoClient;
const $ = require('./handler/functions');

const {
  Embeds: EmbedsMode
} = require('discord-paginationembed')

var Admin, Util, Music, Search, Games;
var db, guildlist, config

var loaded = false,
  settingsTime

displayAscii()
MongoClient.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, (err, client) => {
  if (!err) {
    $.log(`MongoDB connection established on ${process.env.DB_HOST}\n`);
    db = client.db(process.env.DB_NAME);
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
    throw `${err}\nFailed to establish connection to ${process.env.DB_HOST}`;
  }
})

bot.on('ready', async () => {
  var guilds = Array.from(bot.guilds.keys())
  await $.processDatabase(guilds, guildlist)

  $.log(`Loaded Settings in ${((Date.now() - settingsTime) / 1000).toFixed(2)} secs.`)

  var modulesTime = new Date()
  try {
    Administration = require('./modules/administration')
    Utilities = require('./modules/utilities')
    Music = require('./modules/music')
    Searches = require('./modules/searches')
    Games = require('./modules/games')
  } catch (err) {
    $.log(err)
  }

  $.log(`Loaded Modules in ${((Date.now() - modulesTime) / 1000).toFixed(2)} secs.\n`)

  $.log(`Logged in as ${bot.user.tag}\n`)

  for (var i = 0; i < bot.guilds.size; i++) {
    var channelsize = bot.guilds.get(guilds[i]).channels.filter(s => s.type != "category").size
    var usersize = bot.guilds.get(guilds[i]).members.size
    $.log(`Connected to "${bot.guilds.get(guilds[i]).name}" with ${channelsize} ${channelsize == 1 ? "channel" : "channels"} and ${usersize} ${usersize == 1 ? "user" : "users"}${i == bot.guilds.size - 1 ? "\n" : ""}`)
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
          message.reply(`Generated bot invite link: ${link}`);
        });
    }
    return
  }
  var server = await $.getServerConfig(message.guild.id)
  if (!message.content.startsWith(server.prefix)) return

  var messageArray = message.content.trim().split(/\s/g)
  var cmd = messageArray[0].substring(server.prefix.length).toLowerCase()
  var args = messageArray.slice(1)

  if (server.deleteoncmd) {
    message.delete()
  }

  switch (getModule(cmd)) {
    case 'admin':
      var admin = new Administration(message)
      admin[cmd](args)
      break
    case 'music':
      var music = new Music(message)
      music[cmd](args)
      break
    case "util":
      var utils = new Utilities(message)
      utils[cmd](args)
      break
    case "search":
      var search = new Searches(message)
      search[cmd](args)
      break
    case "games":
      var games = new Games(message)
      games[cmd](args)
      break
  }
})

bot.on('voiceStateUpdate', (oldMember, newMember) => {
  if (newMember.user.bot) return

  var msg

  if (oldMember.voiceChannelID != null && newMember.voiceChannelID == null) {
    var music = new Music(oldMember)
    var config = $.getServerConfig(oldMember.guild.id)

    msg = `**${oldMember.user.username}** has disconnected from **${bot.channels.get(oldMember.voiceChannelID).name}**`

    if (newMember.guild.channels.get(oldMember.voiceChannelID).members.filter(s => !s.user.bot).size == 0) music.pause()
  } else if (oldMember.voiceChannelID == null && newMember.voiceChannelID != null) {
    var music = new Music(newMember)
    var config = $.getServerConfig(newMember.guild.id)

    msg = `**${newMember.user.username}** has connected to **${bot.channels.get(newMember.voiceChannelID).name}**`

    if (newMember.guild.channels.get(newMember.voiceChannelID).members.filter(s => !s.user.bot).size > 0) music.resume()
  }
  if (msg) {
    if (config.voicetts) {
      bot.channels.get(config.voicettsch).send(msg, {
        tts: true
      }).then(msg => msg.delete({
        timeout: 5000
      }))
    }
    if (config.logchannel != "") {
      bot.channels.get(config.logchannel).send($.embed()
        .setAuthor("Voice Presence Update", `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
        .setDescription(`\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\` ${msg}.`)
      )
    }
  }
})

bot.on('presenceUpdate', (oldMember, newMember) => {
  if (newMember.user.bot) return
  var config = $.getServerConfig(newMember.guild.id)
  if (config.logchannel == "" || config.logchannel == undefined) return

  var msg
  if (oldMember.presence.status != newMember.presence.status) {
    msg = `**${newMember.user.username}** is now **${newMember.presence.status}**`
  } else if (oldMember.presence.activity.name != newMember.presence.activity.name) {
    msg = `**${newMember.user.username}** is now ${newMember.presence.activity.type.toLowerCase()} **${newMember.presence.activity.name == "" ? "nothing" : newMember.presence.activity.name}**`
  }
  if (msg) {
    bot.channels.get(config.logchannel).send($.embed()
      .setAuthor("User Presence Update", `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
      .setDescription(`\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\` ${msg}.`)
    )
  }
})

bot.on('error', (err) => {
  $.log("Bot Error: " + err)
})

process.on('uncaughtException', (err) => {
  $.log("Uncaught Exception: " + (err.stack || err))
});

function getModule(command) {
  var modules = {
    "admin": getAllFuncs(new Administration()),
    "music": getAllFuncs(new Music()),
    "util": getAllFuncs(new Utilities()),
    "search": getAllFuncs(new Searches()),
    "games": getAllFuncs(new Games())
  }

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
  let methods = new Set();
  while (obj = Reflect.getPrototypeOf(obj)) {
    let keys = Reflect.ownKeys(obj)
    keys.forEach((k) => methods.add(k));
  }
  return Array.from(methods);
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