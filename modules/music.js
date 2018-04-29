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
var servers = []
var reaction_numbers = ["\u0030\u20E3", "\u0031\u20E3", "\u0032\u20E3", "\u0033\u20E3", "\u0034\u20E3", "\u0035\u20E3", "\u0036\u20E3", "\u0037\u20E3", "\u0038\u20E3", "\u0039\u20E3"]

var _bot, _server
module.exports = (bot, message) => {
  if (message !== undefined) {
    if (!servers[message.guild.id]) {
      servers[message.guild.id] = {
        queue: [],
        autoplayid: [],
        currentQueue: 0,
        currentChannel: ""
      }
      bot.on('voiceStateUpdate', (oldMember, newMember) => {
        if (newMember.user.bot) return

        var music = music_module(bot, bot.channels.get(_server.currentChannel))

        if (oldMember.voiceChannelID != null && newMember.voiceChannelID == null) {
          if (newMember.guild.channels.get(oldMember.voiceChannelID).members.filter(s => s.user.id != bot.user.id).size == 0) music.pause()
        } else if (oldMember.voiceChannelID == null && newMember.voiceChannelID != null) {
          if (newMember.guild.channels.get(newMember.voiceChannelID).members.filter(s => s.user.id != bot.user.id).size > 0) music.resume()
        }
      })
    }
    _bot = bot
    _server = servers[message.guild.id]
    _server.currentChannel = message.channel.id
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

            _server.queue.push({
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
        _server.queue.push({
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
        var temp = embed(`Click on the react below to choose.`)
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
        var collector = msg.createReactionCollector((reaction, user) => user.id === message.author.id, {
          time: 60 * 1000
        });
        collector.on('collect', async react => {
          react.message.delete()
          var i = reaction_numbers.indexOf(react._emoji.name)
          message.channel.send(embed(songSearchList[i - 1].title).setTitle(`You have selected #${i}. `))
            .then(msg => msg.delete(5000))
          var index = _server.queue.push({
            title: songSearchList[i - 1].title,
            url: songSearchList[i - 1].url,
            requested: message.author
          })
          _server.queue[index - 1].info = await ytdl.getInfo(songSearchList[i - 1].url)
          if (!message.guild.voiceConnection)
            message.member.voiceChannel.join()
            .then((connection) => {
              play(message, connection)
            })
        })
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
      if (_server && _server.queue) _server.queue = []
      if (_server.dispatcher) _server.dispatcher.end("stop")
      if (message.guild.voiceConnection) message.guild.voiceConnection.disconnect()
      _server.autoplayid = []
      message.channel.send(embed("Player stopped!"))
      $.log("Player stopped!")
    },
    skip: () => {
      if (_server.dispatcher) _server.dispatcher.end("skip")
      $.log("Player skipped!")
    },
    list: () => {
      if (_server === undefined || _server.queue.length === 0) {
        message.channel.send(embed("The playlist is empty"))
      } else {
        var embeds = []
        var temp = embed()
        var totalseconds = 0
        for (var i = 0; i < _server.queue.length && _server.queue[i].info; i++) {
          temp.addField(`${_server.currentQueue == i ? "*" : ""}${i+1}. **${_server.queue[i].title}**`, `\`${$.formatSeconds(_server.queue[i].info.length_seconds)} | ${_server.queue[i].requested.username}\``)
          totalseconds += +_server.queue[i].info.length_seconds
          if (i != 0 && i % 9 == 0 || i == _server.queue.length - 1) {
            embeds.push(temp)
            temp = embed()
          }
        }
        var footer = [`${_server.queue.length} ${_server.queue.length == 1 ? "song" : "songs"}`, $.formatSeconds(totalseconds), `Volume: ${config.servers[message.guild.id].music.volume}%`, `Repeat: ${config.servers[message.guild.id].music.repeat}`, `Autoplay: ${config.servers[message.guild.id].music.autoplay ? "on" : "off"}`]
        if (Math.ceil(_server.queue.length / 10) == 1 && embeds[0]) {
          message.channel.send(embeds[0]
            .setAuthor('Player Queue', "https://i.imgur.com/SBMH84I.png")
            .setFooter(footer.join(" | "), `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
          )
        } else {
          new EmbedsMode()
            .setArray(embeds)
            .setAuthorizedUser(message.author)
            .setChannel(message.channel)
            .showPageIndicator(true)
            .setAuthor('Player Queue', "https://i.imgur.com/SBMH84I.png")
            .setColor("#59ABE3")
            .setFooter(footer.join(" | "), `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
            .build();
        }
      }
    },
    volume: args => {
      if (Number.isInteger(+args[0])) {
        config.servers[message.guild.id].music.volume = +args
        if (_server && _server.dispatcher) _server.dispatcher.setVolume(args / 100)
        message.channel.send(embed(`Volume is now set to ${args}%`))
        $.updateconfig()
      } else {
        message.channel.send(embed(`Volume is set to ${config.servers[message.guild.id].music.volume}%`))
      }
    },
    repeat: args => {
      if (args[0] && args[0].toLowerCase() != "off" && args[0].toLowerCase() != "single" && args[0].toLowerCase() != "all") {
        message.channel.send(embed("Invalid parameters. (off | single | all)"))
      } else if (!args[0]) {
        message.channel.send(embed("Repeat is set to " + config.servers[message.guild.id].music.repeat + "."))
      } else {
        config.servers[message.guild.id].music.repeat = args[0]
        message.channel.send(embed("Repeat is now set to " + args[0] + "."))
        $.updateconfig()
      }
    },
    pause: () => {
      if (_server && _server.dispatcher && !_server.dispatcher.paused && _server.queue.length > 0) {
        _server.dispatcher.pause()
        if (message.channel) {
          message.channel.send(embed(`Player paused ${config.prefix}resume to unpause.`))
        } else {
          message.send(embed(`Player has automatically paused because there are no users connected.`))
        }
        $.log("Player paused!")
      }
    },
    resume: () => {
      if (_server && _server.dispatcher && _server.dispatcher.paused && _server.queue.length > 0) {
        _server.dispatcher.resume()
        if (message.channel) {
          message.channel.send(embed(`Player resumed ${config.prefix}pause to pause.`))
        } else {
          message.send(embed(`Player has automatically resumed.`))
        }
        $.log("Player resumed!")
      }
    },
    autoplay: () => {
      _server.autoplayid = []
      config.servers[message.guild.id].music.autoplay = !config.servers[message.guild.id].music.autoplay
      message.channel.send(embed("Autoplay is now " + (config.servers[message.guild.id].music.autoplay ? "enabled" : "disabled") + "."))
      $.updateconfig()
      $.log("Autoplay " + (config.servers[message.guild.id].music.autoplay ? "enabled" : "disabled") + ".")
    },
    nowplaying: () => {
      var temp
      if (_server && _server.queue[_server.currentQueue]) {
        var requested = _server.queue[_server.currentQueue].requested
        var info = _server.queue[_server.currentQueue].info
        var footer = [requested.username, `Volume: ${config.servers[message.guild.id].music.volume}%`, `Repeat: ${config.servers[message.guild.id].music.repeat}`, `Autoplay: ${config.servers[message.guild.id].music.autoplay ? "on" : "off"}`]
        temp = embed()
          .setTitle("Title")
          .setDescription(_server.queue[_server.currentQueue].title)
          .setThumbnail(info.thumbnail_url)
          .addField("Time", `${$.formatSeconds(_server.dispatcher.time / 1000)} - ${$.formatSeconds(info.length_seconds)}`)
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
    lyrics: args => {
      var keyword = args.join(" ")
      request("https://search.azlyrics.com/search.php?q=" + keyword.replace(/\s/g, "+"), async (err, res, body) => {
        var $ = cheerio.load(body)
        var count = 1
        var lyricSearchList = []
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
          var msg = await message.channel.send(temp)
          var collector = msg.createReactionCollector((reaction, user) => user.id === message.author.id, {
            time: 60 * 1000
          });
          collector.on('collect', async react => {
            react.message.delete()
            var i = reaction_numbers.indexOf(react._emoji.name)
            request(lyricSearchList[i - 1].url, async (err, res, body) => {
              lyricSearchList = []
              var $ = cheerio.load(body)
              var string = $("div.col-xs-12.col-lg-8.text-center div").eq(6).text()
              var strings = []
              do {
                var part = string.substring(0, 2001)
                part = part.substring(0, part.lastIndexOf(part.lastIndexOf("\n\n") >= 0 ? "\n\n" : "\n") + 1)
                strings.push(part)
                string = string.replace(part, "")
              } while (string.length > 0)
              for (var i = 0; i < strings.length; i++) {
                var temp = embed(strings[i])
                if (i == 0) temp.setTitle($("div.lyricsh h2 b").text())
                await message.channel.send(temp)
              }
            })
          })
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
}

var previnfo;
async function play(message, connection) {
  if (!_server.queue[_server.currentQueue]) {
    _server.currentQueue = 0
    if (config.servers[message.guild.id].music.repeat == "off") {
      _server.queue = []
      if (config.servers[message.guild.id].music.autoplay) {
        _server.autoplayid = $.addIfNotExists(_server.autoplayid, previnfo.video_id)
        for (var i = 0; i < previnfo.related_videos.length; i++) {
          var id = previnfo.related_videos[i].id || previnfo.related_videos[i].video_id
          if (!$.isInArray(_server.autoplayid, id)) {
            _server.autoplayid.push(id)
            previnfo = await ytdl.getInfo(id)
            break
          }
        }
        _server.queue.push({
          id: previnfo.video_id,
          title: previnfo.title,
          url: previnfo.video_url,
          requested: _bot.user,
          info: previnfo
        })
      } else {
        message.guild.voiceConnection.disconnect()
        return
      }
    }
  }
  _server.dispatcher = connection.playStream(ytdl(_server.queue[_server.currentQueue].url, process.env.HEROKU ? {
    quality: "highestaudio"
  } : {
    filter: "audioonly"
  }))
  _server.dispatcher.setVolume(config.servers[message.guild.id].music.volume / 100)
  var requested = _server.queue[_server.currentQueue].requested
  var footer = [requested.username, $.formatSeconds(_server.queue[_server.currentQueue].info.length_seconds), `Volume: ${config.servers[message.guild.id].music.volume}%`, `Repeat: ${config.servers[message.guild.id].music.repeat}`, `Autoplay: ${config.servers[message.guild.id].music.autoplay ? "on" : "off"}`]
  message.channel.send(embed()
    .setAuthor("Now Playing #" + (_server.currentQueue + 1), "https://i.imgur.com/SBMH84I.png")
    .setFooter(footer.join(" | "), `https://cdn.discordapp.com/avatars/${requested.id}/${requested.avatar}.png?size=16`)
    .setTitle(_server.queue[_server.currentQueue].title)
    .setURL(_server.queue[_server.currentQueue].url)
  )
  $.log("Now playing " + _server.queue[_server.currentQueue].title)

  previnfo = _server.queue[_server.currentQueue].info

  _server.dispatcher.on("end", mode => {
    if (mode === "stop") return
    else if (config.servers[message.guild.id].music.repeat != "single" || mode === "skip") _server.currentQueue += 1
    play(message, connection)
  })
}