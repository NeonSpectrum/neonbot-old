const fs = require('fs')
const moment = require('moment')

const bot = require('../bot')
const {
  Embeds: EmbedsMode
} = require('discord-paginationembed')

const ytdl = require('ytdl-core')

const $ = require('../assets/functions')
const config = $.getConfig()

const Youtube = require('simple-youtube-api')
const yt = new Youtube(process.env.GOOGLE_API)

const spotifyUri = require('spotify-uri');

var spotify = {
  token: null,
  expiration: null
}
var servers = []

class Music {
  constructor(message) {
    if (typeof message === "object") {
      if (!servers[message.guild.id]) {
        servers[message.guild.id] = {
          queue: [],
          autoplayid: [],
          connection: null,
          currentQueue: 0,
          currentChannel: null,
          previnfo: null,
          config: $.getServerConfig(message.guild.id),
          lastPlayingMessage: null,
          lastFinishedMessage: null,
          lastAutoMessage: null,
          lastPauseMessage: null,
          status: null,
          stopped: false,
          seekTime: 0
        }
      } else {
        servers[message.guild.id].currentChannel = (message.channel && message.channel.id) || servers[message.guild.id].currentChannel
        servers[message.guild.id].config = $.getServerConfig(message.guild.id)
      }
      this.server = servers[message.guild.id]
      this.message = message
      this.log = (content) => {
        $.log(content, message)
      }
    }
  }
}

Music.prototype.play = async function(args) {
  var message = this.message,
    server = this.server,
    self = this

  if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in a voice channel!"))
  if (!args[0]) return message.channel.send($.embed("Please provide a keyword or link."))

  if (Number.isInteger(+args[0]) && server.queue.length != 0) {
    if (!server.queue[+args[0] - 1]) return message.channel.send($.embed(`Error! There are only ${server.queue.length} songs.`))
    if (!$.isOwner(message.author.id) && server.queue[currentQueue].requested.id != message.author.id && !server.queue[currentQueue].requested.bot && !server.stopped) {
      return message.channel.send($.embed("Please respect the one who queued the song."))
    }
    if (server.stopped) {
      server.stopped = false
      server.currentQueue = +args[0] - 1
      this._execute(server.connection)
    } else {
      server.status = +args[0] - 1
      server.dispatcher.end()
    }
  } else if (args[0].match(/^.*(youtu.be\/|list=)([^#\&\?]*).*/g)) {
    try {
      playlist = await yt.getPlaylist(args[0])
      videos = await playlist.getVideos()
    } catch (err) {
      return message.channel.send($.embed(`Invalid Playlist URL`))
    }

    var msg = await message.channel.send($.embed(`Adding ${videos.length} ${videos.length == 1 ? "song" : "songs"} to the queue.`))
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
        connect()
      } catch (err) {
        error++
      }
    }
    msg.edit($.embed(`Done! Loaded ${videos.length} ${videos.length == 1 ? "song" : "songs"}.` + (error > 0 ? ` ${error} failed to load.` : ""))).then(m => m.delete({
      timeout: 10000
    })).catch(() => {})
  } else if (args[0].match(/^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/g)) {
    var info = await ytdl.getInfo(args[0])
    message.channel.send($.embed()
      .setAuthor(`Added song to queue #${server.queue.length + 1}`, "https://i.imgur.com/SBMH84I.png")
      .setTitle(info.title)
      .setURL(info.video_url)
    ).then(m => m.delete({
      timeout: 5000
    }).catch(() => {}))
    server.queue.push({
      title: info.title,
      url: info.video_url,
      requested: message.author,
      info: info
    })
    connect()
  } else if (args[0].match(/^(spotify:|https:\/\/[a-z]+\.spotify\.com\/)/g)) {
    var uri = spotifyUri.parse(args[0])
    var token = await getSpotifyToken()
    if (uri.type == "playlist") {
      async function loop(offset) {
        var json = await $.fetchJSON(`https://api.spotify.com/v1/users/${uri.user}/playlists/${uri.id}/tracks?offset=${offset}&limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (json.items) {
          var msg = await message.channel.send($.embed(`Adding ${json.total} ${json.total == 1 ? "song" : "songs"} to the queue.`))
          var error = 0
          for (var i = 0; i < json.items.length; i++) {
            var videos = await yt.searchVideos(`${json.items[i].track.artists[0].name} ${json.items[i].track.name}`)
            if (videos.length == 0) {
              error++
              continue
            }
            var info = await ytdl.getInfo(videos[0].url)
            server.queue.push({
              title: info.title,
              url: info.video_url,
              requested: message.author,
              info: info
            })
            connect()
          }
          if (json.next) loop(offset + 100)
          else msg.edit($.embed(`Done! Loaded ${json.total} ${json.total == 1 ? "song" : "songs"}.` + (error > 0 ? ` ${error} failed to load.` : ""))).then(m => m.delete({
            timeout: 10000
          })).catch(() => {})
        } else {
          message.channel.send($.embed("I can't play this song."))
        }
      }
      loop(0)
    } else if (uri.type == "track") {
      var json = await $.fetchJSON(`https://api.spotify.com/v1/tracks/${uri.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      var videos = await yt.searchVideos(`${json.artists[0].name} ${json.name}`)
      if (videos.length == 0) {
        return message.channel.send($.embed("I can't find a song from that spotify link."))
      }
      var info = await ytdl.getInfo(videos[0].url)
      server.queue.push({
        title: info.title,
        url: info.video_url,
        requested: message.author,
        info: info
      })
      message.channel.send($.embed()
        .setAuthor(`Added song to queue #${server.queue.length + 1}`, "https://i.imgur.com/SBMH84I.png")
        .setTitle(info.title)
        .setURL(info.video_url)
      ).then(m => m.delete({
        timeout: 5000
      }).catch(() => {}))
      connect()
    } else {
      message.channel.send($.embed("I can't play that spotify link."))
    }
  } else {
    try {
      var videos = await yt.searchVideos(args.join(" "))
    } catch (err) {
      return message.channel.send($.embed("Cannot find any videos"))
    }
    if (videos.length == 0) {
      return message.channel.send($.embed("Cannot find any videos"))
    }
    var temp = $.embed().setAuthor("Choose 1-5 below.", "https://i.imgur.com/SBMH84I.png")
    var songSearchList = []
    for (var i = 0, j = 1; i < videos.length; i++, j++) {
      temp.addField(`${j}. ${videos[i].title}`, videos[i].url)
      songSearchList.push({
        title: videos[i].title,
        url: videos[i].url,
        requested: message.author
      })
    }

    var reactionlist = ["\u0031\u20E3", "\u0032\u20E3", "\u0033\u20E3", "\u0034\u20E3", "\u0035\u20E3", "🗑"]
    var msg = await message.channel.send(temp)
    msg.awaitReactions((reaction, user) => reactionlist.indexOf(reaction.emoji.name) > -1 && user.id === message.author.id, {
      max: 1,
      time: 15000,
      errors: ['time']
    }).then(async (collected) => {
      collected.first().message.delete().catch(() => {})
      if (collected.first().emoji.name == "🗑") return
      var i = reactionlist.indexOf(collected.first().emoji.name)
      message.channel.send($.embed(songSearchList[i].title).setTitle(`You have selected #${i+1}. Adding song to queue #${server.queue.length+1}`))
        .then(msg => msg.delete({
          timeout: 5000
        }).catch(() => {}))
      var index = server.queue.push({
        title: songSearchList[i].title,
        url: songSearchList[i].url,
        requested: message.author
      })
      server.queue[index - 1].info = await ytdl.getInfo(songSearchList[i].url)
      connect()
    }).catch(() => {
      msg.delete().catch(() => {})
    });
    for (var i = 0; i < reactionlist.length; i++) {
      try {
        await msg.react(reactionlist[i])
      } catch (err) {
        break
      }
    }
  }

  function connect() {
    self._saveplaylist()
    if (!message.guild.voiceConnection || server.status == "clearqueue") {
      server.status = null
      message.member.voiceChannel.join()
        .then((connection) => {
          server.connection = connection
          self.log("Connected to " + message.member.voiceChannel.name)
          self._execute(connection)
        }).catch(() => {
          message.channel.send($.embed("I can't join the voice channel."))
        })
    } else if (server.stopped) {
      server.stopped = false
      server.currentQueue += 1
      self._execute(server.connection)
    }
  }
}

Music.prototype.stop = function() {
  var message = this.message,
    server = this.server

  if (server.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    if (!$.isOwner(message.author.id) && server.queue[server.currentQueue].requested.id != message.author.id && !server.queue[server.currentQueue].requested.bot) {
      return message.channel.send($.embed("Please respect the one who queued the song."))
    }
    server.stopped = true
    server.dispatcher.end()
    message.channel.send($.embed("Player stopped!")).then(s => s.delete({
      timeout: 5000
    })).catch(() => {})
    this.log("Player stopped!")
    $.removeMusicPlaylist(message.guild.id)
  }
}

Music.prototype.skip = function() {
  var message = this.message,
    server = this.server

  if (server.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    if (!$.isOwner(message.author.id) && server.queue[server.currentQueue].requested.id != message.author.id && !server.queue[server.currentQueue].requested.bot) {
      return message.channel.send($.embed("Please respect the one who queued the song."))
    }
    if (server.config.music.repeat == "single") {
      server.status = "skip"
    }
    server.dispatcher.end()
    this.log("Player skipped!")
  }
}

Music.prototype.seek = function(args) {
  var message = this.message,
    server = this.server,
    seconds = $.convertToSeconds(args[0])

  if (!Number.isInteger(seconds)) return message.channel.send("Parameter must be in seconds.")
  if (server.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    if (!$.isOwner(message.author.id) && server.queue[server.currentQueue].requested.id != message.author.id && !server.queue[server.currentQueue].requested.bot) {
      return message.channel.send($.embed("Please respect the one who queued the song."))
    }
    server.status = "seek"
    server.seekTime = seconds
    server.dispatcher.end()
    this._execute(server.connection, seconds)
    message.channel.send($.embed(`Seeking to ${seconds} seconds. Please wait.`))
      .then(m => m.delete({
        timeout: 3000
      }))
  }
}

Music.prototype.removesong = async function(args) {
  var message = this.message,
    server = this.server

  if (server.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    if (!args[0]) return message.channel.send($.embed("Invalid Parameters. (<index> | all)"))
    if (args[0].toLowerCase() == "all") {
      message.channel.send($.embed("Cleared queue.")).then(m => m.delete({
        timeout: 5000
      }))
      server.status = "clearqueue"
      server.stopped = true
      server.dispatcher.end()
      return
    }
    if (+args[0] <= 0 || +args[0] > server.queue.length) return message.channel.send($.embed("There is no song in that index."))
    if (!$.isOwner(message.author.id) && server.queue[+args[0] - 1].requested.id != message.author.id && !server.queue[+args[0] - 1].requested.bot) {
      return message.channel.send($.embed("You cannot remove this song. You're not the one who requested it."))
    }
    await message.channel.send($.embed()
      .setAuthor("Removed Song #" + +args[0], "https://i.imgur.com/SBMH84I.png")
      .setFooter(server.queue[+args[0] - 1].requested.tag, server.queue[+args[0] - 1].requested.displayAvatarURL())
      .setTitle(server.queue[+args[0] - 1].title)
      .setURL(server.queue[+args[0] - 1].url)
    )
    server.queue.splice(+args[0] - 1, 1)
    if (+args[0] >= server.currentQueue) {
      server.currentQueue -= 1
    }
    if (server.config.music.autoresume) {
      $.storeMusicPlaylist({
        guild: message.guild.id,
        voice: message.member.voiceChannel.id,
        msg: message.channel.id
      }, server.queue.map(x => x.url))
    }
  }
}

Music.prototype.list = function() {
  var message = this.message,
    server = this.server

  if (server === undefined || server.queue.length === 0) {
    message.channel.send($.embed("The playlist is empty"))
  } else {
    try {
      var embeds = []
      var temp = []
      var totalseconds = 0
      for (var i = 0; i < server.queue.length && server.queue[i].info; i++) {
        temp.push(`\`${server.currentQueue == i ? "*" : ""}${i+1}.\` [${server.queue[i].title}](${server.queue[i].url})\n\t  \`${$.formatSeconds(server.queue[i].info.length_seconds)} | ${server.queue[i].requested.tag}\``)
        totalseconds += +server.queue[i].info.length_seconds
        if (i != 0 && (i + 1) % 10 == 0 || i == server.queue.length - 1) {
          embeds.push($.embed().setDescription(temp.join("\n")))
          temp = []
        }
      }
      var footer = [`${server.queue.length} ${server.queue.length == 1 ? "song" : "songs"}`, $.formatSeconds(totalseconds), `Volume: ${server.config.music.volume}%`, `Repeat: ${server.config.music.repeat}`, `Shuffle: ${server.config.music.shuffle ? "on" : "off"}`, `Autoplay: ${server.config.music.autoplay ? "on" : "off"}`]
      if (Math.ceil(server.queue.length / 10) == 1 && embeds[0]) {
        message.channel.send(embeds[0]
          .setAuthor('Player Queue', "https://i.imgur.com/SBMH84I.png")
          .setFooter(footer.join(" | "), bot.user.displayAvatarURL())
        )
      } else {
        new EmbedsMode()
          .setArray(embeds)
          .setAuthorizedUser(message.author)
          .setChannel(message.channel)
          .setAuthor('Player Queue', "https://i.imgur.com/SBMH84I.png")
          .setColor("#59ABE3")
          .setFooter(footer.join(" | "), bot.user.displayAvatarURL())
          .build()
      }
    } catch (err) {
      console.log(err)
    }
  }
}

Music.prototype.volume = async function(args) {
  var message = this.message,
    server = this.server

  if (Number.isInteger(+args[0])) {
    if (+args[0] > 200) return message.channel.send($.embed("The volume must be less than or equal to 200."))
    if (server && server.dispatcher) server.dispatcher.setVolume(args / 100)
    server.config = await $.updateServerConfig(message.guild.id, {
      "music.volume": +args[0]
    })
    message.channel.send($.embed(`Volume is now set to ${server.config.music.volume}%`))
  } else {
    message.channel.send($.embed(`Volume is set to ${server.config.music.volume}%`))
  }
}

Music.prototype.repeat = async function(args) {
  var message = this.message,
    server = this.server

  if (args[0] && args[0].toLowerCase() != "off" && args[0].toLowerCase() != "single" && args[0].toLowerCase() != "all") {
    message.channel.send($.embed("Invalid parameters. (off | single | all)"))
  } else if (!args[0]) {
    message.channel.send($.embed(`Repeat is set to ${server.config.music.repeat}.`))
  } else {
    server.config = await $.updateServerConfig(message.guild.id, {
      "music.repeat": args[0]
    })
    message.channel.send($.embed(`Repeat is now set to ${server.config.music.repeat}.`))
  }
}

Music.prototype.shuffle = async function(args) {
  var message = this.message,
    server = this.server

  if (args[0] && args[0].toLowerCase() != "off" && args[0].toLowerCase() != "on") {
    message.channel.send($.embed("Invalid parameters. (off | on)"))
  } else if (!args[0]) {
    message.channel.send($.embed(`Shuffle is set to ${server.config.music.shuffle ? "on" : "off"}.`))
  } else {
    server.config = await $.updateServerConfig(message.guild.id, {
      "music.shuffle": args[0] == "on" ? true : false
    })
    message.channel.send($.embed(`Shuffle is now set to ${server.config.music.shuffle ? "on" : "off"}.`))
  }
}

Music.prototype.pause = async function() {
  var message = this.message,
    server = this.server

  if (server && server.dispatcher && !server.dispatcher.paused && server.queue.length > 0) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    server.dispatcher.pause()
    if (message.channel) {
      server.lastPauseMessage = await message.channel.send($.embed(`Player paused. \`${server.config.prefix}resume\` to resume.`))
      this.log("Player paused!")
    } else {
      if (server.lastAutoMessage) server.lastAutoMessage.delete().catch(() => {})
      server.lastAutoMessage = await bot.channels.get(server.currentChannel).send($.embed(`Player has automatically paused because there are no users connected.`))
      $.log("Player has automatically paused because there are no users connected.", server.lastAutoMessage)
    }
  }
}

Music.prototype.resume = async function() {
  var message = this.message,
    server = this.server

  if (server && server.dispatcher && server.dispatcher.paused && server.queue.length > 0) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    server.dispatcher.resume()
    if (message.channel) {
      if (server.lastPauseMessage) {
        server.lastPauseMessage.delete()
        server.lastPauseMessage = null
      }
      message.channel.send($.embed(`Player resumed.`)).then(s => s.delete({
        timeout: 5000
      }).catch(() => {}))
      this.log("Player resumed!")
    } else {
      if (server.lastAutoMessage) server.lastAutoMessage.delete().catch(() => {})
      server.lastAutoMessage = await bot.channels.get(server.currentChannel).send($.embed(`Player has automatically resumed.`))
      $.log("Player has automatically resumed.", server.lastAutoMessage)
    }
  }
}

Music.prototype.autoplay = async function(args) {
  var message = this.message,
    server = this.server
  if (!args[0]) return message.channel.send($.embed(`Autoplay is set to ${server.config.music.autoplay ? "on" : "off"}.`))
  if (args[0] != "on" && args[0] != "off") return message.channel.send($.embed("Invalid Parameters (on | off)."))
  server.config = await $.updateServerConfig(message.guild.id, {
    "music.autoplay": args[0] == "on" ? true : false
  })
  message.channel.send($.embed("Autoplay is now " + (server.config.music.autoplay ? "enabled" : "disabled") + "."))
  this.log("Autoplay " + (server.config.music.autoplay ? "enabled" : "disabled") + ".")
}

Music.prototype.nowplaying = function() {
  var message = this.message,
    server = this.server

  var temp = $.embed("Nothing playing")
  if (server && server.queue[server.currentQueue]) {
    var requested = server.queue[server.currentQueue].requested
    var info = server.queue[server.currentQueue].info
    var footer = [requested.tag, `Volume: ${server.config.music.volume}%`, `Repeat: ${server.config.music.repeat}`, `Shuffle: ${server.config.music.shuffle ? "on" : "off"}`, `Autoplay: ${server.config.music.autoplay ? "on" : "off"}`]
    temp = $.embed()
      .setTitle("Title")
      .setDescription(server.queue[server.currentQueue].title)
      .setThumbnail(info.thumbnail_url)
      .addField("Time", `${$.formatSeconds(server.dispatcher.streamTime / 1000 + server.seekTime)} - ${$.formatSeconds(info.length_seconds)}`)
      .addField("Description", (info.description.length > 500 ? info.description.substring(0, 500) + "..." : info.description))
      .setFooter(footer.join(" | "), requested.displayAvatarURL())
  }
  message.channel.send(temp)
}

Music.prototype.leave = function() {
  var message = this.message
  if (!$.isOwner(message.member.id)) return message.channel.send($.embed("You don't have a permission to make the bot leave."))
  if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
  if (message.guild.voiceConnection) message.guild.voiceConnection.disconnect()
}

Music.prototype.restartsong = function() {
  var message = this.message,
    server = this.server

  if (message.guild.voiceConnection && server.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    server.status = "restart"
    server.dispatcher.end()
  }
}

Music.prototype.autoresume = async function(args) {
  var message = this.message,
    server = this.server

  if (!$.isOwner(message.member.id)) return message.channel.send($.embed("You don't have a permission to set the autoresume mode."))
  if (!args[0] || (args[0] != "enable" && args[0] != "disable")) return message.channel.send($.embed(`Auto Resume is ${server.config.music.autoresume ? "enabled" : "disabled"} (enable | disable).`))

  server.config = await $.updateServerConfig(message.guild.id, {
    "music.autoresume": args[0] == "enable" ? true : false
  })
  message.channel.send($.embed(`Auto Resume is now ${server.config.music.autoresume ? "enabled" : "disabled"}.`))
}

Music.prototype._execute = function(connection, time) {
  var message = this.message,
    server = this.server

  try {
    server.dispatcher = connection.play(ytdl(server.queue[server.currentQueue].url, process.env.DEVELOPMENT ? {
      filter: "audioonly"
    } : {
      quality: "highestaudio",
      begin: time * 1000
    }), {
      volume: server.config.music.volume / 100,
      highWaterMark: 1,
      bitrate: "auto"
    })

    server.dispatcher.on("start", async () => {
      if (server.status == "seek") {
        server.status = null
        return
      }
      var requested = server.queue[server.currentQueue].requested
      var footer = [requested.tag, $.formatSeconds(server.queue[server.currentQueue].info.length_seconds), `Volume: ${server.config.music.volume}%`, `Repeat: ${server.config.music.repeat}`, `Shuffle: ${server.config.music.shuffle ? "on" : "off"}`, `Autoplay: ${server.config.music.autoplay ? "on" : "off"}`]
      if (server.lastPlayingMessage) server.lastPlayingMessage.delete().catch(() => {})
      server.lastPlayingMessage = await message.channel.send($.embed()
        .setAuthor("Now Playing #" + (server.currentQueue + 1), "https://i.imgur.com/SBMH84I.png")
        .setFooter(footer.join(" | "), requested.displayAvatarURL())
        .setTitle(server.queue[server.currentQueue].title)
        .setURL(server.queue[server.currentQueue].url)
      )
      this.log("Now playing " + server.queue[server.currentQueue].title)
    })

    server.dispatcher.on("finish", async () => {
      if (server.status == "seek") return
      server.seekTime = 0
      var requested = server.queue[server.currentQueue].requested
      var footer = [requested.tag, $.formatSeconds(server.queue[server.currentQueue].info.length_seconds), `Volume: ${server.config.music.volume}%`, `Repeat: ${server.config.music.repeat}`, `Shuffle: ${server.config.music.shuffle ? "on" : "off"}`, `Autoplay: ${server.config.music.autoplay ? "on" : "off"}`]

      if (server.lastFinishedMessage) server.lastFinishedMessage.delete().catch(() => {})
      server.lastFinishedMessage = await message.channel.send($.embed()
        .setAuthor("Finished Playing #" + (server.currentQueue + 1), "https://i.imgur.com/SBMH84I.png")
        .setFooter(footer.join(" | "), requested.displayAvatarURL())
        .setTitle(server.queue[server.currentQueue].title)
        .setURL(server.queue[server.currentQueue].url)
      )

      if (!server.stopped) {
        if (server.config.music.repeat == "off" && !server.config.music.autoplay && server.currentQueue == server.queue.length - 1 && server.status != "skip" && !Number.isInteger(server.status)) {
          server.stopped = true
          return
        } else if (server.currentQueue == server.queue.length - 1 && server.config.music.autoplay && server.config.music.repeat != "all") {
          if (server.autoplayid.indexOf(server.queue[server.currentQueue].info.video_id) == -1) server.autoplayid.push(server.queue[server.currentQueue].info.video_id)
          var info
          for (var i = 0; i < server.queue[server.currentQueue].info.related_videos.length; i++) {
            var id = server.queue[server.currentQueue].info.related_videos[i].id || server.queue[server.currentQueue].info.related_videos[i].video_id
            if (server.autoplayid.indexOf(id) == -1) {
              server.autoplayid.push(id)
              info = await ytdl.getInfo(id)
              break
            }
          }
          server.queue.push({
            id: info.video_id,
            title: info.title,
            url: info.video_url,
            requested: bot.user,
            info: info
          })
          this._saveplaylist()
        } else if (server.config.music.shuffle && (!server.status || server.status == "skip") && server.config.music.repeat != "single") {
          do {
            server.status = Math.floor(Math.random() * server.queue.length)
          } while (server.status == server.currentQueue && server.queue.length > 1)
        } else if (server.config.music.repeat == "all" && server.currentQueue == server.queue.length - 1) {
          server.status = 0
        }

        if (Number.isInteger(server.status)) {
          server.currentQueue = server.status
        } else if (server.status != "restart" && server.config.music.repeat != "single" || server.status == "skip") {
          server.currentQueue += 1
        }
        server.status = null
        this._execute(connection)
      } else {
        if (server.status == "clearqueue") server.queue = []
        else server.status = null
        server.stopped = false
        server.currentQueue = 0
      }
    })
  } catch (err) {
    message.channel.send($.embed(`I can't play this song.`))
    console.log(err)
  }
}

Music.prototype._saveplaylist = function() {
  var message = this.message,
    server = this.server

  if (server.config.music.autoresume) {
    $.storeMusicPlaylist({
      guild: message.guild.id,
      voice: message.member.voiceChannel.id,
      msg: message.channel.id
    }, server.queue.map(x => x.url))
  }
}

function getSpotifyToken() {
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

(async function() {
  var guilds = Array.from(bot.guilds.keys())

  for (var i = 0; i < guilds.length; i++) {
    var config = $.getServerConfig(guilds[i])
    if (config.music.autoresume) {
      var playlist = await $.getMusicPlaylist(guilds[i])
      if (!playlist) continue
      processPlaylist(guilds[i], playlist)
    }
  }
})()

async function processPlaylist(id, playlist) {
  var voiceChannel = playlist[0]
  var message = {
    guild: bot.guilds.get(id),
    channel: bot.channels.get(playlist[1]),
    author: bot.user,
    member: {
      voiceChannel: bot.channels.get(voiceChannel)
    }
  }
  var music = new Music(message)
  var server = servers[id]
  playlist = playlist.slice(2)
  var reqmsg = await message.channel.send($.embed("Auto Resume is enabled. Would you like to add the previous playlist to queue? (y | n)"))
  message.channel.awaitMessages((m) => m.content.toLowerCase() == "y" || m.content.toLowerCase() == "n", {
    max: 1,
    time: 15000,
    errors: ['time']
  }).then(async (m) => {
    if (m.first().content.toLowerCase() == "n") throw "no"
    m.first().delete().catch(() => {})
    reqmsg.delete().catch(() => {})
    $.log(`Auto Resume is enabled. Adding ${playlist.length} ${playlist.length == 1 ? "song" : "songs"} to the queue.`, message)
    var msg = await message.channel.send($.embed(`Auto Resume is enabled. Adding ${playlist.length} ${playlist.length == 1 ? "song" : "songs"} to the queue.`))
    var error = 0
    for (var i = 0; i < playlist.length; i++) {
      try {
        var info = await ytdl.getInfo(playlist[i])
        server.queue.push({
          title: info.title,
          url: info.video_url,
          requested: message.author,
          info: info
        })
        if (!message.guild.voiceConnection) {
          bot.channels.get(voiceChannel).join()
            .then((connection) => {
              server.connection = connection
              music._execute(connection)
            }).catch(() => {
              message.channel.send("I can't join the voice channel.")
            })
        }
      } catch (err) {
        error++
      }
    }
    msg.edit($.embed(`Done! Loaded ${playlist.length} ${playlist.length == 1 ? "song" : "songs"}.` + (error > 0 ? ` ${error} failed to load.` : ""))).then(m => m.delete({
      timeout: 10000
    })).catch(() => {})
  }).catch((err) => {
    if (err == "no") message.channel.send($.embed("Okay.")).then(m => m.delete({
      timeout: 3000
    }).catch(() => {}))
    reqmsg.delete().catch(() => {})
    $.removeMusicPlaylist(message.guild.id)
  })
}

module.exports = Music