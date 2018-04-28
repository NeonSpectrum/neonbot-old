var fs = require('fs')
var moment = require('moment')
var Discord = require('discord.js')
var {
  Embeds: EmbedsMode
} = require('discord-paginationembed')

var config = require('../config.json')
var ytdl = require('ytdl-core')
var cheerio = require('cheerio')
var request = require('request')
var Youtube = require('simple-youtube-api')
var yt = new Youtube(config.googleapi)

var $ = require('../handler/functions')
var embed = $.embed
var log = $.log
var servers = []
var currentQueue = 0
var songSearchList = []
var lyricSearchList = []
var server = null
var listofqueuemessageid = ""
var autoplayid = []

module.exports = (bot, message) => {
  if (message !== undefined) server = servers[message.guild.id]
  return {
    play: async (args) => {
      if (!message.member.voiceChannel) return message.reply("You must be in a voice channel!")
      if (!args) return message.reply("Please provide a keyword or link.")
      if (!servers[message.guild.id]) servers[message.guild.id] = {
        queue: []
      }
      server = servers[message.guild.id]

      if (Number.isInteger(+args)) {
        if (songSearchList.length == 0) return
        listofqueuemessageid.delete()
        listofqueuemessageid = ""
        message.channel.send(embed(songSearchList[args - 1].title).setTitle(`You have selected #${args}. `))
          .then(msg => msg.delete(5000))
        var index = server.queue.push({
          title: songSearchList[args - 1].title,
          url: songSearchList[args - 1].url,
          requested: message.author
        })
        server.queue[index - 1].info = await ytdl.getInfo(songSearchList[args - 1].url)
        songSearchList = []
      } else if (args[0].match(/^.*(youtu.be\/|list=)([^#\&\?]*).*/g)) {
        try {
          playlist = await yt.getPlaylist(args[0])
          videos = await playlist.getVideos()
        } catch (err) {
          return message.channel.send(embed(`Invalid Playlist URL`))
        }

        var msg = await message.channel.send(embed(`Adding ${videos.length} to the queue`))
        var error = 0

        for (var i = 0; i < videos.length; i++) {
          try {
            $.log("Processing " + args[0])
            var info = await ytdl.getInfo(videos[i].id)
            $.log("Done Processing " + args[0])

            server.queue.push({
              title: info.title,
              url: info.video_url,
              requested: message.author,
              info: info
            })

            if (i == 1 && !message.guild.voiceConnection) {
              message.member.voiceChannel.join()
                .then((connection) => {
                  play(message, connection)
                })
            }
          } catch (err) {
            error++
          }
        }
        msg.edit(embed(`Done! Loaded ${videos.length} songs.` + (error > 0 ? ` ${error} failed to load.` : "")))
        return
      } else if (args[0].match(/^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/g)) {
        $.log("Processing " + args[0])
        var info = await ytdl.getInfo(args[0])
        $.log("Done Processing " + args[0])
        server.queue.push({
          title: info.title,
          url: info.video_url,
          requested: message.author,
          info: info
        })
      } else {
        try {
          var videos = await yt.searchVideos(args.join(" "))
        } catch (err) {
          return message.reply("Cannot find any videos")
        }
        var temp = embed(`${config.prefix}play <1-5>`)
        songSearchList = []
        for (var i = 0, j = 1; i < videos.length; i++, j++) {
          temp.addField(`${j}. ${videos[i].title}`, videos[i].url)
          songSearchList.push({
            title: videos[i].title,
            url: videos[i].url,
            requested: message.author
          })
        }
        listofqueuemessageid = await message.channel.send(temp)
        return listofqueuemessageid
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

        var embeds = []
        for (var i = 1, j = 0; i <= Math.ceil(server.queue.length / 10); i++) {
          var temp = []
          for (; j < server.queue.length; j++) {
            temp.push(`${j+1}. ${server.queue[j].title}`)
          };
          embeds.push(embed(temp.join("\n")))
        }
        if (Math.ceil(server.queue.length / 10) == 1) {
          message.channel.send(embeds[0])
        } else {
          new EmbedsMode()
            .setArray(embeds)
            .setAuthorizedUser(message.author)
            .setChannel(message.channel)
            .showPageIndicator(true)
            .setTitle('Playlist')
            .setColor("#15f153")
            .build();
        }
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
      if (server && server.dispatcher && !server.dispatcher.paused) {
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
      if (server && server.dispatcher && server.dispatcher.paused) {
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
          .addField("Description", (info.description.length > 500 ? info.description.substring(0, 500) + "..." : info.description))
        if (requested.username && requested.avatar)
          temp.setFooter(requested.username, `https://cdn.discordapp.com/avatars/${requested.id}/${requested.avatar}.png?size=32`)
        else
          temp.setFooter(requested)
      } else {
        temp = embed("Nothing playing")
      }
      message.channel.send(temp)
    },
    leave: () => {
      if (message.guild.voiceConnection) message.guild.voiceConnection.disconnect()
    },
    lyrics: (args) => {
      if (Number.isInteger(+args)) {
        request(lyricSearchList[args - 1].url, (err, res, body) => {
          var $ = cheerio.load(body)
          var string = $("div.col-xs-12.col-lg-8.text-center div").eq(6).text()
          var strings = []
          do {
            var part = string.substring(0, 2001)
            part = part.substring(0, part.lastIndexOf("\n\n") + 1)
            strings.push(part)
            string = string.replace(part, "")
          } while (string.length > 0)
          for (var i = 0; i < strings.length; i++) {
            message.channel.send(embed(strings[i]))
          }
          lyricSearchList = []
        })
      } else {
        var keyword = args.join(" ")
        request("https://search.azlyrics.com/search.php?q=" + keyword.replace(/\s/g, "+"), (err, res, body) => {
          var $ = cheerio.load(body)
          var count = 1
          $("td.visitedlyr a").each(function() {
            if (count <= 5 && $(this).attr("href").indexOf("/lyrics/") > -1) {
              lyricSearchList.push({
                title: $(this).text(),
                url: $(this).attr("href")
              })
              count++
            }
          })
          if (lyricSearchList.length > 0) {
            var temp = embed().setTitle(`${config.prefix}lyrics <1-5>`)
            for (var i = 0; i < lyricSearchList.length; i++) {
              temp.addField(`${i + 1}. ${lyricSearchList[i].title}`, lyricSearchList[i].url)
            }
            message.channel.send(temp)
          } else {
            message.channel.send(embed("No lyrics found."))
          }
        })
      }
    }
  }
}

var previnfo;
async function play(message, connection) {
  var server = servers[message.guild.id]
  if (!server.queue[currentQueue]) {
    currentQueue = 0
    if (!config.music.repeat) {
      server.queue = []
      if (config.music.autoplay) {
        autoplayid = $.addIfNotExists(autoplayid, previnfo.video_id)
        for (var i = 0; i < previnfo.related_videos.length; i++) {
          var id = previnfo.related_videos[i].id || previnfo.related_videos[i].video_id
          if (!$.isInArray(autoplayid, id)) {
            autoplayid.push(id)
            previnfo = await ytdl.getInfo(id)
            break
          }
        }
        server.queue.push({
          id: previnfo.video_id,
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

  var option = server.queue[currentQueue].info.live_playback == 1 ? {
    quality: 95
  } : {
    filter: "audioonly"
  }
  server.dispatcher = connection.playStream(ytdl(server.queue[currentQueue].url, option))

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