var fs = require('fs')
var moment = require('moment')
var Discord = require('discord.js')
var ytdl = require('ytdl-core')
var Youtube = require('simple-youtube-api')
var config = require('../config.json')
var yt = new Youtube(config.googleapi)
var $ = require('../handler/functions')
var embed = $.embed
var log = $.log
var servers = []
var currentQueue = 0
var searchList = []
var server = null
var listofqueuemessageid = ""
var autoplayid = []

module.exports = (bot, message) => {
  if (message !== undefined) server = servers[message.guild.id]
  return {
    play: async (args) => {
      if (!message.member.voiceChannel) return message.reply("You must be in a voice channel!")
      if (!args) return message.reply("Please provide a link!")
      if (!servers[message.guild.id]) servers[message.guild.id] = {
        queue: []
      }
      server = servers[message.guild.id]
      var info
      if (Number.isInteger(+args)) {
        if (searchList.length == 0) return
        listofqueuemessageid.delete()
        listofqueuemessageid = ""
        message.channel.send(embed(searchList[args - 1].title).setTitle(`You have selected #${args}. `))
          .then(msg => msg.delete(5000))
        info = await ytdl.getInfo(searchList[args - 1].url)
        searchList = []
        server.queue.push({
          title: info.title,
          url: info.video_url,
          requested: message.author,
          info: info
        })
      } else {
        if (args[0].match(/^.*(youtu.be\/|list=)([^#\&\?]*).*/g)) {
          try {
            playlist = await yt.getPlaylist(args[0])
            videos = await playlist.getVideos()
          } catch (err) {
            message.channel.send(embed(`Invalid Playlist URL`))
            return
          }

          var msg = await message.channel.send(embed(`Adding ${videos.length} to the queue`))
          var error = 0

          for (var i = 0; i < videos.length; i++) {
            try {
              var info = await ytdl.getInfo(videos[i].id)
              server.queue.push({
                title: info.title,
                url: info.video_url,
                requested: message.author,
                info: info
              })
            } catch (err) {
              error++
            }
          }
          msg.edit(embed(`Done! Loaded ${videos.length} songs.` + (error > 0 ? ` ${error} failed to load.` : "")))
        } else {
          try {
            info = await ytdl.getInfo(args[0])
          } catch (err) {
            try {
              var videos = await yt.searchVideos(args.join(" "))
            } catch (err1) {
              return message.reply("Cannot find any videos")
            }
            var temp = embed(`${config.prefix}play <1-5>`)
            searchList = []
            for (var i = 0, j = 1; i < videos.length; i++, j++) {
              temp.addField(`${j}. ${videos[i].title}`, videos[i].url)
              searchList.push({
                title: videos[i].title,
                url: videos[i].url
              })
            }
            listofqueuemessageid = await message.channel.send(temp)
            return listofqueuemessageid
          }
          server.queue.push({
            title: info.title,
            url: info.video_url,
            requested: message.author,
            info: info
          })
        }
      }
      if (!message.guild.voiceConnection)
        message.member.voiceChannel.join()
        .then((connection) => {
          play(message, connection)
        })
    },
    stop: () => {
      if (server && server.queue) server.queue = []
      if (server.dispatcher) server.dispatcher.end(true)
      if (message.guild.voiceConnection) message.guild.voiceConnection.disconnect()
      autoplayid = []
      message.channel.send(embed("Player stopped!"))
      $.log("Player stopped!")
    },
    skip: () => {
      if (server.dispatcher) server.dispatcher.end()
    },
    list: () => {
      if (server === undefined || server.queue.length === 0) {
        message.channel.send(embed("The playlist is empty"))
      } else {
        var temp = embed("Queue List")
        for (var i = 0, j = 1; i < server.queue.length; i++, j++) {
          temp.addField(`${j}. ${server.queue[i].title}`, server.queue[i].url)
        }
        message.channel.send(temp)
      }
    },
    volume: (args) => {
      if (Number.isInteger(+args)) {
        config.music.volume = +args
        if (server && server.dispatcher) server.dispatcher.setVolume(args / 100)
        message.channel.send(embed(`Volume is now set to ${args}%`))
        $.updateconfig()
      }
    },
    repeat: () => {
      config.music.repeat = !config.music.repeat
      message.channel.send(embed("Repeat is now " + (config.music.repeat ? "enabled" : "disabled") + "."))
      $.updateconfig()
    },
    pause: () => {
      if (server && server.dispatcher) {
        server.dispatcher.pause()
        if (message.channel) {
          message.channel.send(embed(`Player paused ${config.prefix}resume to unpause.`))
        } else {
          message.send(embed(`Player has automatically paused because there are no users connected.`))
        }
        $.log("Player paused!")
      }
    },
    resume: () => {
      if (server && server.dispatcher) {
        server.dispatcher.resume()
        if (message.channel) {
          message.channel.send(embed(`Player resumed ${config.prefix}pause to pause.`))
        } else {
          message.send(embed(`Player has automatically resumed.`))
        }
        $.log("Player resumed!")
      }
    },
    autoplay: () => {
      autoplayid = []
      config.music.autoplay = !config.music.autoplay
      message.channel.send(embed("Autoplay is now " + (config.music.autoplay ? "enabled" : "disabled") + "."))
      $.updateconfig()
      $.log("Autoplay " + (config.music.autoplay ? "enabled" : "disabled") + ".")
    },
    nowplaying: () => {
      var temp
      if (server && server.queue[currentQueue]) {
        var requested = server.queue[currentQueue].requested
        var info = server.queue[currentQueue].info
        temp = embed()
          .setTitle("Title")
          .setDescription(server.queue[currentQueue].title)
          .setThumbnail(info.thumbnail_url)
          .addField("Time", `${moment.utc(server.dispatcher.time).format("mm:ss")} - ${moment.utc(info.length_seconds*1000).format("mm:ss")}`)
          .addField("Description", info.description)
        if (requested.username && requested.avatar)
          temp.setFooter(requested.username, `https://cdn.discordapp.com/avatars/${requested.id}/${requested.avatar}.png?size=32`)
        else
          temp.setFooter(requested)
      } else {
        temp = embed("Nothing playing")
      }
      message.channel.send(temp)
    }
  }
}

var previnfo

async function play(message, connection) {
  var server = servers[message.guild.id]
  if (!server.queue[currentQueue]) {
    currentQueue = 0
    if (!config.music.repeat) {
      server.queue = []
      console.log(previnfo.related_videos)
      if (config.music.autoplay) {
        for (var i = 0; i < previnfo.related_videos.length; i++) {
          if (!$.isInArray(autoplayid, previnfo.related_videos[i].id)) {
            previnfo = await ytdl.getInfo(previnfo.related_videos[i].id)
            autoplayid.push(previnfo.related_videos[i].id)
          }
        }
        server.queue.push({
          title: previnfo.title,
          url: previnfo.video_url,
          requested: "Autoplay",
          info: previnfo
        })
      } else {
        message.guild.voiceConnection.disconnect()
        return
      }
    }
  }

  server.dispatcher = connection.playStream(ytdl(server.queue[currentQueue].url, {
    filter: "audioonly"
  }))
  server.dispatcher.setVolume(config.music.volume / 100)

  message.channel.send(embed(server.queue[currentQueue].title).setTitle("Now Playing #" + (currentQueue + 1)))
  $.log("Now playing " + server.queue[currentQueue].title)

  previnfo = server.queue[currentQueue].info
  server.dispatcher.on("end", (stop) => {
    if (stop === true) return
    currentQueue++
    play(message, connection)
  })
}