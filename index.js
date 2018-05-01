require('dotenv').config()
var fs = require('fs')
var colors = require('colors/safe');
var Discord = require("discord.js")
var bot = new Discord.Client()
var MongoClient = require('mongodb').MongoClient;

var {
  Embeds: EmbedsMode
} = require('discord-paginationembed')

var db, guildlist, config;

var $ = require('./handler/functions');
var admin_module, util_module, music_module, modules

displayAscii()
MongoClient.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, (err, client) => {
  if (!err) {
    try {
      $.log(`MongoDB connection established on ${process.env.DB_HOST}`);
      db = client.db(process.env.DB_NAME);
      $.setDB(db)
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
    } catch (err) {
      console.log(err)
    }
  } else {
    throw `${err}\nFailed to establish connection to ${process.env.DB_HOST}`;
  }
})

bot.on('ready', async () => {
  try {
    admin_module = require('./modules/administration')
    util_module = require('./modules/utilities')
    music_module = require('./modules/music')
  } catch (err) {
    $.log(err)
  }
  modules = {
    "admin": Object.keys(admin_module()),
    "music": Object.keys(music_module()),
    "util": Object.keys(util_module())
  }
  await $.processDatabase(Array.from(bot.guilds.keys()), guildlist)
  $.log(`Logged in as ${bot.user.tag} in ${bot.guilds.size} ${bot.guilds.size == 1 ? "guild" : "guilds"}`)
  bot.user.setActivity(config.game.name, {
    type: config.game.type.toUpperCase()
  })
})

bot.on('message', async message => {
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

  var admin = admin_module(bot, message)
  var music = music_module(bot, message)
  var utils = util_module(bot, message)
  var messageArray = message.content.trim().split(/\s/g)
  var cmd = messageArray[0].substring(server.prefix.length).toLowerCase()
  var args = messageArray.slice(1)

  if (config.deleteoncmd) {
    message.delete()
  }

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
})

bot.on('voiceStateUpdate', (oldMember, newMember) => {
  if (newMember.user.bot) return

  if (oldMember.voiceChannelID != null && newMember.voiceChannelID == null) {
    var music = music_module(bot, oldMember)
    if (config.servers[oldMember.guild.id].voicetts)
      bot.channels.get(config.servers[oldMember.guild.id].voicettsch).send(newMember.user.username + " has disconnected", {
        tts: true
      }).then(msg => msg.delete(5000))
    if (newMember.guild.channels.get(oldMember.voiceChannelID).members.filter(s => s.user.id != bot.user.id).size == 0) music.pause()
  } else if (oldMember.voiceChannelID == null && newMember.voiceChannelID != null) {
    var music = music_module(bot, newMember)
    if (config.servers[newMember.guild.id].voicetts)
      bot.channels.get(config.servers[newMember.guild.id].voicettsch).send(newMember.user.username + " has connected", {
        tts: true
      }).then(msg => msg.delete(5000))
    if (newMember.guild.channels.get(newMember.voiceChannelID).members.filter(s => s.user.id != bot.user.id).size > 0) music.resume()
  }
})

bot.on('error', (err) => {
  $.log("Bot Error: " + err)
})

process.on('uncaughtException', (err) => {
  $.log("Uncaught Exception: " + (err.stack || err))
});

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