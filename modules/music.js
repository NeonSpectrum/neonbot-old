var fs = require('fs')
var moment = require('moment')

var {
  Embeds: EmbedsMode
} = require('discord-paginationembed')

var ytdl = require('ytdl-core')
var cheerio = require('cheerio')
var request = require('request')

var $ = require('../handler/functions')
var db = $.getDB()
var config = $.getConfig()
var embed = $.embed

var Youtube = require('simple-youtube-api')
var yt = new Youtube(config.google_api)

var servers = []
var reaction_numbers = ["\u0030\u20E3", "\u0031\u20E3", "\u0032\u20E3", "\u0033\u20E3", "\u0034\u20E3", "\u0035\u20E3", "\u0036\u20E3", "\u0037\u20E3", "\u0038\u20E3", "\u0039\u20E3"]

module.exports = (bot, message) => {
  var server;
  if (typeof message === "object") {
    if (!servers[message.guild.id]) {
      servers[message.guild.id] = {
        queue: [],
        autoplayid: [],
        currentQueue: 0,
        currentChannel: "",
        previnfo: null,
        config: "XD"
      }
    }
    server = servers[message.guild.id]
    server.currentChannel = message.channel ? message.channel.id : server.currentChannel
    server.config = $.getServerConfig(message.guild.id)
  }
  return {
    play: async args => {
      if (!message.member.voiceChannel) return message.reply("You must be in a voice channel!")
      if (!args[0]) return message.reply("Please provide a keyword or link.")

      if (args[0].match(/^.*(youtu.be\/|list=)([^#\&\?]*).*/g)) {
        try {
          playlist = await yt.getPlaylist(args[0])
          videos = await playlist.getVideos()
        } catch (err) {
          return message.channel.send(embed(`Invalid Playlist URL`))
        }

        var msg = await message.channel.send(embed(`Adding ${videos.length} ${videos.length == 1 ? "song" : "songs"} to the queue`))
        var error = 0

        for (var i = 0; i < videos.length; i++) {
          try {
            $.log("Processing " + "https://www.youtube.com/watch?v=" + videos[i].id)
            var info = await ytdl.getInfo(videos[i].id)
            $.log("Done Processing " + "https://www.youtube.com/watch?v=" + videos[i].id)

            server.queue.push({
              title: info.title,
              url: info.video_url,
              requested: message.author,
              info: info
            })

            if (!message.guild.voiceConnection) {
              message.member.voiceChannel.join()
                .then(connection => {
                  play(message, connection)
                })
            }
          } catch (err) {
            error++
          }
        }
        return msg.edit(embed(`Done! Loaded ${videos.length} songs.` + (error > 0 ? ` ${error} failed to load.` : "")))
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
        if (!message.guild.voiceConnection)
          message.member.voiceChannel.join()
          .then(connection => {
            play(message, connection)
          })
      } else {
        try {
          var videos = await yt.searchVideos(args.join(" "))
        } catch (err) {
          return message.reply("Cannot find any videos")
        }
        var temp = embed().setAuthor("Choose 1-5 below.", "https://i.imgur.com/SBMH84I.png")
        var songSearchList = []
        for (var i = 0, j = 1; i < videos.length; i++, j++) {
          temp.addField(`${j}. ${videos[i].title}`, videos[i].url)
          songSearchList.push({
            title: videos[i].title,
            url: videos[i].url,
            requested: message.author
          })
        }
        var msg = await message.channel.send(temp)
        var collector = msg.createReactionCollector((reaction, user) => user.id === message.author.id);
        collector.on('collect', async react => {
          react.message.delete()
          msg = null;
          var i = reaction_numbers.indexOf(react._emoji.name)
          message.channel.send(embed(songSearchList[i - 1].title).setTitle(`You have selected #${i}. `))
            .then(msg => msg.delete(5000))
          var index = server.queue.push({
            title: songSearchList[i - 1].title,
            url: songSearchList[i - 1].url,
            requested: message.author
          })
          server.queue[index - 1].info = await ytdl.getInfo(songSearchList[i - 1].url)
          if (!message.guild.voiceConnection)
            message.member.voiceChannel.join()
            .then((connection) => {
              play(message, connection)
            })
        })
        setTimeout(() => {
          if (msg != null) msg.delete()
        }, 30000)
        for (var i = 1; i <= 5; i++) {
          try {
            await msg.react(reaction_numbers[i])
          } catch (err) {
            break
          }
        }
      }
    },
    stop: () => {
      if (server && server.queue) server.queue = []
      if (server.dispatcher) server.dispatcher.end("stop")
      if (message.guild.voiceConnection) message.guild.voiceConnection.disconnect()
      server.autoplayid = []
      message.channel.send(embed("Player stopped!"))
      $.log("Player stopped!")
    },
    skip: () => {
      if (server.dispatcher) server.dispatcher.end("skip")
      $.log("Player skipped!")
    },
    list: () => {
      if (server === undefined || server.queue.length === 0) {
        message.channel.send(embed("The playlist is empty"))
      } else {
        var embeds = []
        var temp = []
        var totalseconds = 0
        for (var i = 0; i < server.queue.length && server.queue[i].info; i++) {
          temp.push(`\`${server.currentQueue == i ? "*" : ""}${i+1}.\` [**${server.queue[i].title}**](${server.queue[i].url})\n\t  \`${$.formatSeconds(server.queue[i].info.length_seconds)} | ${server.queue[i].requested.username}\``)
          totalseconds += +server.queue[i].info.length_seconds
          if (i != 0 && i % 9 == 0 || i == server.queue.length - 1) {
            embeds.push(embed().setDescription(temp.join("\n")))
            temp = []
          }
        }
        var footer = [`${server.queue.length} ${server.queue.length == 1 ? "song" : "songs"}`, $.formatSeconds(totalseconds), `Volume: ${server.config.music.volume}%`, `Repeat: ${server.config.music.repeat}`, `Autoplay: ${server.config.music.autoplay ? "on" : "off"}`]
        if (Math.ceil(server.queue.length / 10) == 1 && embeds[0]) {
          message.channel.send(embeds[0]
            .setAuthor('Player Queue', "https://i.imgur.com/SBMH84I.png")
            .setFooter(footer.join(" | "), `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
          )
        } else {
          new EmbedsMode()
            .setArray(embeds)
            .setAuthorizedUser(message.author)
            .setChannel(message.channel)
            .setAuthor('Player Queue', "https://i.imgur.com/SBMH84I.png")
            .setColor("#59ABE3")
            .setFooter(footer.join(" | "), `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
            .build();
        }
      }
    },
    volume: async args => {
      if (Number.isInteger(+args[0])) {
        server.config = await $.updateServerConfig(message.guild.id, {
          "music.volume": +args[0]
        })
        if (server && server.dispatcher) server.dispatcher.setVolume(args / 100)
        message.channel.send(embed(`Volume is now set to ${server.config.music.volume}%`))
      } else {
        message.channel.send(embed(`Volume is set to ${server.config.music.volume}%`))
      }
    },
    repeat: async args => {
      if (args[0] && args[0].toLowerCase() != "off" && args[0].toLowerCase() != "single" && args[0].toLowerCase() != "all") {
        message.channel.send(embed("Invalid parameters. (off | single | all)"))
      } else if (!args[0]) {
        message.channel.send(embed("Repeat is set to " + server.config.music.repeat + "."))
      } else {
        server.config = await $.updateServerConfig(message.guild.id, {
          "music.repeat": args[0]
        })
        message.channel.send(embed("Repeat is now set to " + server.config.music.repeat + "."))
      }
    },
    pause: () => {
      if (server && server.dispatcher && !server.dispatcher.paused && server.queue.length > 0) {
        server.dispatcher.pause()
        if (message.channel) {
          message.channel.send(embed(`Player paused ${config.prefix}resume to unpause.`))
        } else {
          bot.channels.get(servers[message.guild.id].currentChannel).send(embed(`Player has automatically paused because there are no users connected.`))
        }
        $.log("Player paused!")
      }
    },
    resume: () => {
      if (server && server.dispatcher && server.dispatcher.paused && server.queue.length > 0) {
        server.dispatcher.resume()
        if (message.channel) {
          message.channel.send(embed(`Player resumed ${config.prefix}pause to pause.`))
        } else {
          bot.channels.get(servers[message.guild.id].currentChannel).send(embed(`Player has automatically resumed.`))
        }
        $.log("Player resumed!")
      }
    },
    autoplay: async () => {
      server.config = await $.updateServerConfig(message.guild.id, {
        "music.autoplay": !server.config.music.autoplay
      })
      message.channel.send(embed("Autoplay is now " + (server.config.music.autoplay ? "enabled" : "disabled") + "."))
      $.log("Autoplay " + (server.config.music.autoplay ? "enabled" : "disabled") + ".")
    },
    nowplaying: () => {
      var temp
      if (server && server.queue[server.currentQueue]) {
        var requested = server.queue[server.currentQueue].requested
        var info = server.queue[server.currentQueue].info
        var footer = [requested.username, `Volume: ${server.config.music.volume}%`, `Repeat: ${server.config.music.repeat}`, `Autoplay: ${server.config.music.autoplay ? "on" : "off"}`]
        temp = embed()
          .setTitle("Title")
          .setDescription(server.queue[server.currentQueue].title)
          .setThumbnail(info.thumbnail_url)
          .addField("Time", `${$.formatSeconds(server.dispatcher.time / 1000)} - ${$.formatSeconds(info.length_seconds)}`)
          .addField("Description", (info.description.length > 500 ? info.description.substring(0, 500) + "..." : info.description))
          .setFooter(footer.join(" | "), `https://cdn.discordapp.com/avatars/${requested.id}/${requested.avatar}.png?size=32`)
      } else {
        temp = embed("Nothing playing")
      }
      message.channel.send(temp)
    },
    leave: () => {
      if (message.guild.voiceConnection) message.guild.voiceConnection.disconnect()
    },
    restart: () => {
      if (message.guild.voiceConnection) {
        message.guild.voiceConnection.disconnect()
        message.member.voiceChannel.join()
          .then((connection) => {
            play(message, connection)
          })
      }
    },
    lyrics: args => {
      if (false) return message.reply("Disabled temporarily.")
      var keyword = args.join(" ")
      request("https://www.musixmatch.com/search/" + keyword.replace(/\s/g, "+"), async (err, res, body) => {
        console.log(err + res + body)
        var $ = cheerio.load(body)
        var count = 1
        var lyricSearchList = []
        $("a.title").each(function() {
          if (count <= 5) {
            lyricSearchList.push({
              title: $(this).find("span").text(),
              url: "https://www.musixmatch.com" + $(this).attr("href")
            })
            count++
          }
        })
        if (lyricSearchList.length > 0) {
          var temp = embed().setAuthor("Choose 1-5 below.", "https://i.imgur.com/SBMH84I.png")
          for (var i = 0; i < lyricSearchList.length; i++) {
            temp.addField(`${i + 1}. ${lyricSearchList[i].title}`, lyricSearchList[i].url)
          }
          var msg = await message.channel.send(temp)
          var collector = msg.createReactionCollector((reaction, user) => user.id === message.author.id);
          collector.on('collect', async react => {
            react.message.delete()
            msg = null
            var i = reaction_numbers.indexOf(react._emoji.name)
            request(lyricSearchList[i - 1].url, async (err, res, body) => {
              lyricSearchList = []
              var $ = cheerio.load(body)
              var string = $("p.mxm-lyrics__content").text()
              var strings = []
              do {
                var part = string.substring(0, 2001)
                part = part.substring(0, part.lastIndexOf("\n\n") >= 0 ? part.lastIndexOf("\n\n") + 1 : undefined)
                strings.push(part)
                string = string.replace(part, "")
              } while (string.length > 0)
              for (var i = 0; i < strings.length; i++) {
                var temp = embed(strings[i])
                if (i == 0) temp.setTitle($("h1.mxm-track-title__track").text().replace($("h1.mxm-track-title__track small").text(), ""))
                await message.channel.send(temp)
              }
            })
          })
          setTimeout(() => {
            if (msg != null) msg.delete()
          }, 30000)
          for (var i = 1; i <= 5; i++) {
            try {
              await msg.react(reaction_numbers[i])
            } catch (err) {
              break
            }
          }
        } else {
          message.channel.send(embed("No lyrics found."))
        }
      })
    }
  }

  async function play(message, connection) {
    if (!server.queue[server.currentQueue]) {
      server.currentQueue = 0
      if (server.config.music.repeat == "off") {
        server.queue = []
        if (server.config.music.autoplay) {
          server.autoplayid = $.addIfNotExists(server.autoplayid, server.previnfo.video_id)
          for (var i = 0; i < server.previnfo.related_videos.length; i++) {
            var id = server.previnfo.related_videos[i].id || server.previnfo.related_videos[i].video_id
            if (!$.isInArray(server.autoplayid, id)) {
              server.autoplayid.push(id)
              server.previnfo = await ytdl.getInfo(id)
              break
            }
          }
          server.queue.push({
            id: server.previnfo.video_id,
            title: server.previnfo.title,
            url: server.previnfo.video_url,
            requested: bot.user,
            info: server.previnfo
          })
        } else {
          message.guild.voiceConnection.disconnect()
          return
        }
      }
    }
    server.dispatcher = connection.playStream(ytdl(server.queue[server.currentQueue].url, process.env.HEROKU ? {
      quality: "highestaudio",
      highWaterMark: 1024 * 1024 * 10
    } : {
      filter: "audioonly"
    }))
    server.dispatcher.setVolume(server.config.music.volume / 100)
    var requested = server.queue[server.currentQueue].requested
    var footer = [requested.username, $.formatSeconds(server.queue[server.currentQueue].info.length_seconds), `Volume: ${server.config.music.volume}%`, `Repeat: ${server.config.music.repeat}`, `Autoplay: ${server.config.music.autoplay ? "on" : "off"}`]
    message.channel.send(embed()
      .setAuthor("Now Playing #" + (server.currentQueue + 1), "https://i.imgur.com/SBMH84I.png")
      .setFooter(footer.join(" | "), `https://cdn.discordapp.com/avatars/${requested.id}/${requested.avatar}.png?size=16`)
      .setDescription(`[**${server.queue[server.currentQueue].title}**](${server.queue[server.currentQueue].url})`)
    )
    $.log("Now playing " + server.queue[server.currentQueue].title)

    server.previnfo = server.queue[server.currentQueue].info

    server.dispatcher.on("end", mode => {
      if (mode === "stop") return
      else if (server.config.music.repeat != "single" || mode === "skip") server.currentQueue += 1
      play(message, connection)
    })
  }
}