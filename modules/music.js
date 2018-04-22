var fs = require('fs')
var Discord = require('discord.js')
var ytdl = require('ytdl-core')
var Youtube = require('simple-youtube-api')
var config = require('../config.json')
var yt = new Youtube(config.googleapi)
var servers = []
var currentQueue = 0;
var searchList = [];

module.exports = (bot, message) => {
  var server = message !== undefined ? servers[message.guild.id] : null;
  return {
    play: async (args) => {
      if (!message.member.voiceChannel) return message.reply("You must be in a voice channel!")
      if (!args) return message.reply("Please provide a link!")
      if (!servers[message.guild.id]) servers[message.guild.id] = {
        queue: []
      }
      var info;
      if (Number.isInteger(+args)) {
        if (searchList.length == 0) return;
        message.channel.send("You have selected " + searchList[args - 1].title)
        info = await ytdl.getInfo(searchList[args - 1].url)
        searchList = []
      } else {
        try {
          info = await ytdl.getInfo(args[0])
        } catch (err) {
          try {
            var videos = await yt.searchVideos(args.join(" "));
          } catch (err1) {
            // return message.reply("Cannot find any videos")
            return console.log(err)
          }
          var embed = new Discord.RichEmbed()
            .setDescription(`${config.prefix}play <1-5>`)
            .setColor("#15f153")
          searchList = []
          for (var i = 0, j = 1; i < videos.length; i++, j++) {
            embed.addField(`${j}. ${videos[i].title}`, videos[i].url)
            searchList.push({
              "title": videos[i].title,
              "url": videos[i].url
            })
          }
          return message.channel.send(embed)
        }
      }
      servers[message.guild.id].queue.push({
        title: info.title,
        url: info.video_url
      })
      if (!message.guild.voiceConnection)
        message.member.voiceChannel.join()
        .then((connection) => {
          play(message, connection)
        })
    },
    stop: () => {
      server.queue = {}
      if (message.guild.voiceConnection) message.guild.voiceConnection.disconnect()
    },
    skip: () => {
      if (server.dispatcher) server.dispatcher.end()
    },
    list: () => {
      var embed = new Discord.RichEmbed()
        .setDescription(`Queue List`)
        .setColor("#15f153")
      if (server === undefined) {
        message.channel.send("Empty Queue List")
      } else {
        for (var i = 0, j = 1; i < server.queue.length; i++, j++) {
          embed.addField(`${j}. ${server.queue[currentQueue].title}`, server.queue[currentQueue].url)
        }
        message.channel.send(embed)
      }
    },
    volume: (args) => {
      if (Number.isInteger(+args)) {
        config.music.volume = +args
        server.dispatcher.setVolume(args / 100)
        updateConfig()
      }
    },
    repeat: () => {
      config.music.repeat = !config.music.repeat
      message.channel.send("Repeat is now " + (config.music.repeat ? "enabled" : "disabled") + ".")
      updateConfig()
    },
    pause: () => {
      server.dispatcher.pause()
      message.channel.send(`Player paused \`${config.prefix}resume\` to unpause.`)
    },
    resume: () => {
      server.dispatcher.resume()
      message.channel.send(`Player resumed \`${config.prefix}pause\` to pause.`)
    }
  }
}

function play(message, connection) {
  var server = servers[message.guild.id]
  if (!server.queue[currentQueue] && config.music.repeat) {
    currentQueue = 0
  } else if (!server.queue[currentQueue]) {
    message.guild.voiceConnection.disconnect()
    return
  }
  server.dispatcher = connection.playStream(ytdl(server.queue[currentQueue].url, {
    filter: "audioonly"
  }))
  server.dispatcher.setVolume(config.music.volume / 100)
  message.channel.send("Now playing " + server.queue[currentQueue].title)
  server.dispatcher.on("end", () => {
    currentQueue++
    play(message, connection)
  })
}

function updateConfig() {
  fs.writeFile("./config.json", JSON.stringify(config, null, 2), (err) => {
    if (err) console.log(err)
  })
}