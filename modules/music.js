const moment = require('moment')

const bot = require('../bot')
const {
  Embeds: EmbedsMode
} = require('discord-paginationembed')

const ytdl = require('ytdl-core')

const $ = require('../assets/functions')

const Youtube = require('simple-youtube-api')
const yt = new Youtube(process.env.GOOGLE_API)

const spotifyUri = require('spotify-uri');

const servers = bot.music

class Music {
  constructor(message) {
    if (typeof message === "object") {
      if (!servers[message.guild.id]) {
        servers[message.guild.id] = {
          queue: [],
          autoplayid: [],
          shuffled: [],
          connection: null,
          currentQueue: 0,
          currentChannel: (message.channel && message.channel.id) || null,
          previnfo: null,
          config: $.getServerConfig(message.guild.id),
          lastPlayingMessage: null,
          lastFinishedMessage: null,
          lastAutoMessage: null,
          lastPauseMessage: null,
          status: null,
          requestIndex: null,
          disableStart: false,
          disableFinish: false,
          stopped: false,
          seek: 0,
          isLast: () => servers[message.guild.id].queue.length - 1 == servers[message.guild.id].currentQueue,
          resendDeleteMessage: async () => {
            var player = servers[message.guild.id]
            if (player.dispatcher && player.dispatcher.paused) {
              if (player.lastPauseMessage) player.lastPauseMessage.delete().catch(() => {})
              player.lastPauseMessage = await message.channel.send($.embed(`Player paused. \`${player.config.prefix}resume\` to resume.`))
            }
          }
        }
      } else {
        servers[message.guild.id].currentChannel = (message.channel && message.channel.id) || servers[message.guild.id].currentChannel
        servers[message.guild.id].config = $.getServerConfig(message.guild.id)
      }
      this.player = servers[message.guild.id]
      this.message = message
      this.log = (content) => {
        $.log(content, message)
      }
    }
  }
}

Music.prototype.play = async function(args) {
  var message = this.message,
    player = this.player,
    self = this

  if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in a voice channel!"))
  if (!args[0] && !player.stopped) return message.channel.send($.embed("Please provide a keyword or link."))

  if (Number.isInteger(+args[0]) || (!args[0] && !player.stopped && player.queue.length != 0)) {
    this.resume()
    var index = Number.isInteger(+args[0]) ? +args[0] : 1
    if (!player.queue[index - 1]) return message.channel.send($.embed(`Error! There are only ${player.queue.length} songs.`))
    if (!$.isOwner(message.author.id) && player.queue[currentQueue].requested.id != message.author.id && !player.queue[currentQueue].requested.bot && !player.stopped) {
      return message.channel.send($.embed("Please respect the one who queued the song."))
    }
    if (player.stopped) {
      player.stopped = false
      player.currentQueue = index - 1
      this._execute(player.connection)
    } else {
      player.requestIndex = index - 1
      player.dispatcher.end()
    }
  } else if (args[0].match(/^.*(youtu.be\/|list=)([^#\&\?]*).*/g)) {
    var videos

    try {
      videos = await (await yt.getPlaylist(args[0])).getVideos()
    } catch (err) {
      return message.channel.send($.embed(`Invalid Playlist URL`))
    }

    if (videos.length == 0) return message.channel.send($.embed("No videos found in the playlist."))

    var msg = await message.channel.send($.embed(`Adding ${videos.length} ${videos.length == 1 ? "song" : "songs"} to the queue.`))
    var error = 0

    for (var i = 0; i < videos.length; i++) {
      this._addToQueue(await ytdl.getInfo(videos[i].id))
      if (i == 0) connect()
    }
    msg.edit($.embed(`Done! Loaded ${videos.length} ${videos.length == 1 ? "song" : "songs"}.`)).then(m => m.delete({
      timeout: 10000
    })).catch(() => {})
  } else if (args[0].match(/^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/g)) {
    var info = await ytdl.getInfo(args[0])
    message.channel.send($.embed()
      .setAuthor(`Added song to queue #${player.queue.length + 1}`, "https://i.imgur.com/SBMH84I.png")
      .setTitle(info.title)
      .setURL(info.video_url)
    ).then(m => m.delete({
      timeout: 5000
    }).catch(() => {}))
    this._addToQueue(info)
    connect()
  } else if (args[0].match(/^(spotify:|https:\/\/[a-z]+\.spotify\.com\/)/g)) {
    var uri = spotifyUri.parse(args[0])
    var token = await $.getSpotifyToken()
    if (uri.type == "playlist") {
      var msg
      async function loop(offset) {
        var json = await $.fetchJSON(`https://api.spotify.com/v1/users/${uri.user}/playlists/${uri.id}/tracks?offset=${offset}&limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (json.items) {
          msg = msg || await message.channel.send($.embed(`Adding ${json.total} ${json.total == 1 ? "song" : "songs"} to the queue.`))
          var error = 0
          for (var i = 0, connected = false; i < json.items.length; i++) {
            var videos = await yt.searchVideos(`${json.items[i].track.artists[0].name} ${json.items[i].track.name}`)
            if (videos.length == 0) {
              error++
              continue
            }
            self._addToQueue(await ytdl.getInfo(videos[0].url))
            if (!connected) {
              connected = true
              connect()
            }
          }
          if (json.next) loop(offset + 100)
          else {
            msg.edit($.embed(`Done! Loaded ${json.total} ${json.total == 1 ? "song" : "songs"}.` + (error > 0 ? ` ${error} failed to load.` : ""))).then(m => m.delete({
              timeout: 10000
            })).catch(() => {})
          }
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
      self._addToQueue(await ytdl.getInfo(videos[0].url))
      message.channel.send($.embed()
        .setAuthor(`Added song to queue #${player.queue.length + 1}`, "https://i.imgur.com/SBMH84I.png")
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
    var videos = await yt.searchVideos(args.join(" "))
    if (videos.length == 0) return message.channel.send($.embed("Cannot find any videos")).then(m => m.delete({
      timeout: 5000
    }).catch(() => {}))

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
      message.channel.send($.embed(songSearchList[i].title).setTitle(`You have selected #${i+1}. Adding song to queue #${player.queue.length+1}`))
        .then(msg => msg.delete({
          timeout: 5000
        }).catch(() => {}))
      this._addToQueue(await ytdl.getInfo(songSearchList[i].url))
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
    player.resendDeleteMessage()
    if (!message.guild.voiceConnection) {
      message.member.voiceChannel.join()
        .then((connection) => {
          player.connection = connection
          self.log("Connected to " + message.member.voiceChannel.name)
          self._execute(connection)
        }).catch(() => {
          message.channel.send($.embed("I can't join the voice channel."))
        })
    } else if (player.stopped) {
      player.stopped = false
      player.currentQueue = player.queue.length - 1
      self._execute(player.connection)
    }
  }
}

Music.prototype.stop = function() {
  var message = this.message,
    player = this.player

  if (player.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    if (!$.isOwner(message.author.id) && player.queue[player.currentQueue].requested.id != message.author.id && !player.queue[player.currentQueue].requested.bot) {
      return message.channel.send($.embed("Please respect the one who queued the song."))
    }
    player.stopped = true
    player.dispatcher.end()
    message.channel.send($.embed("Player stopped!")).then(s => s.delete({
      timeout: 5000
    })).catch(() => {})
    this.log("Player stopped!")
  }
}

Music.prototype.skip = function() {
  var message = this.message,
    player = this.player,
    music = player.config.music

  if (player.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    if (!$.isOwner(message.author.id) && player.queue[player.currentQueue].requested.id != message.author.id && !player.queue[player.currentQueue].requested.bot) {
      return message.channel.send($.embed("Please respect the one who queued the song."))
    }
    this.resume()
    player.status = "skip"
    player.dispatcher.end()
    this.log("Player skipped!")
  }
}

Music.prototype.seek = function(args) {
  var message = this.message,
    player = this.player,
    seconds = $.convertToSeconds(args[0] || 0)

  if (!Number.isInteger(seconds) || seconds <= 10) return message.channel.send($.embed("Parameter must be more than 10 seconds."))
  if (player.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    if (!$.isOwner(message.author.id) && player.queue[player.currentQueue].requested.id != message.author.id && !player.queue[player.currentQueue].requested.bot) {
      return message.channel.send($.embed("Please respect the one who queued the song."))
    }
    player.disableFinish = true
    this._execute(player.connection, seconds)
    message.channel.send($.embed(`Seeking to ${seconds} seconds. Please wait.`))
      .then(m => m.delete({
        timeout: 3000
      }))
  }
}

Music.prototype.removesong = async function(args) {
  var message = this.message,
    player = this.player

  if (player.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    if (!args[0] || !Number.isInteger(args[0])) return message.channel.send($.embed("Invalid Parameters. <index>"))

    if (+args[0] <= 0 || +args[0] > player.queue.length) return message.channel.send($.embed("There is no song in that index."))
    var index = +args[0] - 1
    if (!$.isOwner(message.author.id) && player.queue[index].requested.id != message.author.id && !player.queue[index].requested.bot) {
      return message.channel.send($.embed("You cannot remove this song. You're not the one who requested it."))
    }
    await message.channel.send($.embed()
      .setAuthor("Removed Song #" + +args[0], "https://i.imgur.com/SBMH84I.png")
      .setFooter(player.queue[index].requested.tag, player.queue[index].requested.displayAvatarURL())
      .setTitle(player.queue[index].title)
      .setURL(player.queue[index].url)
    )

    player.disableFinish = true
    player.queue.splice(index, 1)

    if (index < player.currentQueue) player.currentQueue -= 1
    else if (index == player.currentQueue) this._execute(player.connection)

    this._savePlaylist()
  }
}

Music.prototype.list = function() {
  var message = this.message,
    player = this.player,
    music = player.config.music

  if (player.queue.length == 0) {
    message.channel.send($.embed("The playlist is empty"))
  } else {
    try {
      var embeds = []
      var temp = []
      var totalseconds = 0
      for (var i = 0; i < player.queue.length && player.queue[i].info; i++) {
        temp.push(`\`${player.currentQueue == i ? "*" : ""}${i+1}.\` [${player.queue[i].title}](${player.queue[i].url})\n\t  \`${$.formatSeconds(player.queue[i].info.length_seconds)} | ${player.queue[i].requested.tag}\``)
        totalseconds += +player.queue[i].info.length_seconds
        if (i != 0 && (i + 1) % 10 == 0 || i == player.queue.length - 1) {
          embeds.push($.embed().setDescription(temp.join("\n")))
          temp = []
        }
      }
      var footer = [`${player.queue.length} ${player.queue.length == 1 ? "song" : "songs"}`, $.formatSeconds(totalseconds), `Volume: ${music.volume}%`, `Repeat: ${music.repeat}`, `Shuffle: ${music.shuffle ? "on" : "off"}`, `Autoplay: ${music.autoplay ? "on" : "off"}`]
      if (Math.ceil(player.queue.length / 10) == 1 && embeds[0]) {
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
      $.warn(err)
    }
  }
}

Music.prototype.volume = async function(args) {
  var message = this.message,
    player = this.player,
    music = player.config.music

  if (Number.isInteger(+args[0])) {
    if (+args[0] > 200) return message.channel.send($.embed("The volume must be less than or equal to 200."))
    if (player && player.dispatcher) player.dispatcher.setVolume(args / 100)
    player.config = await $.updateServerConfig(message.guild.id, {
      "music.volume": +args[0]
    })
    message.channel.send($.embed(`Volume is now set to ${player.dispatcher.volume * 100}%`))
  } else {
    message.channel.send($.embed(`Volume is set to ${player.dispatcher.volume * 100}%`))
  }
}

Music.prototype.repeat = async function(args) {
  var message = this.message,
    player = this.player,
    music = player.config.music

  if (args[0] && args[0].toLowerCase() != "off" && args[0].toLowerCase() != "single" && args[0].toLowerCase() != "all") {
    message.channel.send($.embed("Invalid parameters. (off | single | all)"))
  } else if (!args[0]) {
    message.channel.send($.embed(`Repeat is set to ${music.repeat}.`))
  } else {
    player.config = await $.updateServerConfig(message.guild.id, {
      "music.repeat": args[0]
    })
    message.channel.send($.embed(`Repeat is now set to ${music.repeat}.`))
  }
}

Music.prototype.shuffle = async function(args) {
  var message = this.message,
    player = this.player,
    music = player.config.music

  if (args[0] && args[0].toLowerCase() != "off" && args[0].toLowerCase() != "on") {
    message.channel.send($.embed("Invalid parameters. (off | on)"))
  } else if (!args[0]) {
    message.channel.send($.embed(`Shuffle is set to ${music.shuffle ? "on" : "off"}.`))
  } else {
    player.config = await $.updateServerConfig(message.guild.id, {
      "music.shuffle": args[0] == "on" ? true : false
    })
    message.channel.send($.embed(`Shuffle is now set to ${music.shuffle ? "on" : "off"}.`))
  }
}

Music.prototype.pause = async function() {
  var message = this.message,
    player = this.player

  if (player && player.dispatcher && !player.dispatcher.paused && player.queue.length > 0) {
    if (message.member && !message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    player.dispatcher.pause()
    if (message.channel) {
      player.lastPauseMessage = await message.channel.send($.embed(`Player paused. \`${player.config.prefix}resume\` to resume.`))
      this.log("Player paused!")
    } else {
      if (player.lastAutoMessage) player.lastAutoMessage.delete().catch(() => {})
      player.lastAutoMessage = await bot.channels.get(player.currentChannel).send($.embed(`Player has automatically paused because there are no users connected.`))
      $.log("Player has automatically paused because there are no users connected.", player.lastAutoMessage)
    }
  }
}

Music.prototype.resume = async function() {
  var message = this.message,
    player = this.player

  if (player && player.dispatcher && player.dispatcher.paused && player.queue.length > 0) {
    if (message.channel) {
      if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
      if (player.lastPauseMessage) {
        player.lastPauseMessage.delete()
        player.lastPauseMessage = null
      }
      message.channel.send($.embed(`Player resumed.`)).then(s => s.delete({
        timeout: 5000
      }).catch(() => {}))
      this.log("Player resumed!")
    } else {
      if (player.lastAutoMessage) player.lastAutoMessage.delete().catch(() => {})
      player.lastAutoMessage = await bot.channels.get(player.currentChannel).send($.embed(`Player has automatically resumed.`)).then(s => s.delete({
        timeout: 5000
      }).catch(() => {}))
      $.log("Player has automatically resumed.", player.lastAutoMessage)
    }
    player.dispatcher.resume()
  }
}

Music.prototype.autoplay = async function(args) {
  var message = this.message,
    player = this.player,
    music = player.config.music

  if (!args[0]) return message.channel.send($.embed(`Autoplay is set to ${music.autoplay ? "on" : "off"}.`))
  if (args[0] != "on" && args[0] != "off") return message.channel.send($.embed("Invalid Parameters (on | off)."))
  player.config = await $.updateServerConfig(message.guild.id, {
    "music.autoplay": args[0] == "on" ? true : false
  })
  message.channel.send($.embed("Autoplay is now " + (music.autoplay ? "enabled" : "disabled") + "."))
  this.log("Autoplay " + (music.autoplay ? "enabled" : "disabled") + ".")
}

Music.prototype.nowplaying = function() {
  var message = this.message,
    player = this.player,
    music = player.config.music

  var temp = $.embed("Nothing playing")
  if (player && player.queue[player.currentQueue] && !player.stopped) {
    var requested = player.queue[player.currentQueue].requested
    var info = player.queue[player.currentQueue].info
    var footer = [requested.tag, `Volume: ${music.volume}%`, `Repeat: ${music.repeat}`, `Shuffle: ${music.shuffle ? "on" : "off"}`, `Autoplay: ${music.autoplay ? "on" : "off"}`]
    temp = $.embed()
      .setTitle("Title")
      .setDescription(player.queue[player.currentQueue].title)
      .setThumbnail(info.thumbnail_url)
      .addField("Time", `${$.formatSeconds(player.dispatcher.streamTime / 1000 + player.seek)} - ${$.formatSeconds(info.length_seconds)}`)
      .addField("Description", (info.description.length > 500 ? info.description.substring(0, 500) + "..." : info.description))
      .setFooter(footer.join(" | "), requested.displayAvatarURL())
  }
  message.channel.send(temp)
}

Music.prototype.reset = function() {
  var message = this.message,
    player = this.player

  if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
  if (message.guild.voiceConnection) {
    if (player.stopped) {
      delete servers[message.guild.id]
      message.channel.send($.embed("Player has been reset."))
    } else player.status = "reset"
    message.guild.voiceConnection.disconnect()
  }
}

Music.prototype.restartsong = function() {
  var message = this.message,
    player = this.player

  if (message.guild.voiceConnection && player.dispatcher) {
    if (!message.member.voiceChannel) return message.channel.send($.embed("You must be in the voice channel!"))
    player.requestIndex = player.currentQueue
    player.dispatcher.end()
  }
}

Music.prototype._execute = async function(connection, seconds = 0) {
  var message = this.message,
    player = this.player,
    music = player.config.music,
    self = this

  player.seek = seconds

  try {
    player.dispatcher = connection.play(ytdl(player.queue[player.currentQueue].url, process.env.DEVELOPMENT ? {
      filter: "audioonly"
    } : {
      quality: "highestaudio",
      begin: player.seek * 1000
    }), {
      volume: music.volume / 100,
      highWaterMark: 1,
      bitrate: "auto"
    })

    if (player.seek) player.disableStart = true

    player.dispatcher.on("start", () => {
      if (!player.disableStart) self._processStart()
      else player.disableStart = false
    })

    player.dispatcher.on("finish", () => {
      player.dispatcher.destroy()
      if (!player.disableFinish) self._processFinish(connection)
      else player.disableFinish = false
    })
  } catch (err) {
    $.warn(err)
    message.channel.send($.embed(`I can't play this song.`))
  }
}

Music.prototype._processStart = async function() {
  var message = this.message,
    player = this.player,
    music = player.config.music

  var requested = player.queue[player.currentQueue].requested
  var footer = [requested.tag, $.formatSeconds(player.queue[player.currentQueue].info.length_seconds), `Volume: ${music.volume}%`, `Repeat: ${music.repeat}`, `Shuffle: ${music.shuffle ? "on" : "off"}`, `Autoplay: ${music.autoplay ? "on" : "off"}`]
  if (player.lastPlayingMessage) player.lastPlayingMessage.delete().catch(() => {})
  player.lastPlayingMessage = await message.channel.send($.embed()
    .setAuthor("Now Playing #" + (player.currentQueue + 1), "https://i.imgur.com/SBMH84I.png")
    .setFooter(footer.join(" | "), requested.displayAvatarURL())
    .setTitle(player.queue[player.currentQueue].title)
    .setURL(player.queue[player.currentQueue].url)
  )
  this.log("Now playing " + player.queue[player.currentQueue].title)
}

Music.prototype._processFinish = async function(connection) {
  var message = this.message,
    player = this.player,
    music = player.config.music

  var requested = player.queue[player.currentQueue].requested
  var footer = [requested.tag, $.formatSeconds(player.queue[player.currentQueue].info.length_seconds), `Volume: ${music.volume}%`, `Repeat: ${music.repeat}`, `Shuffle: ${music.shuffle ? "on" : "off"}`, `Autoplay: ${music.autoplay ? "on" : "off"}`]

  if (player.lastFinishedMessage) player.lastFinishedMessage.delete().catch(() => {})
  player.lastFinishedMessage = await message.channel.send($.embed()
    .setAuthor("Finished Playing #" + (player.currentQueue + 1), "https://i.imgur.com/SBMH84I.png")
    .setFooter(footer.join(" | "), requested.displayAvatarURL())
    .setTitle(player.queue[player.currentQueue].title)
    .setURL(player.queue[player.currentQueue].url)
  )

  if (player.status == "reset") {
    delete servers[message.guild.id]
    return message.channel.send($.embed("Player has been reset."))
  } else if (!player.stopped) {
    this._processNext(connection)
  } else {
    player.status = null
    player.requestIndex = null
    player.currentQueue = 0
    player.shuffled = []
  }
}

Music.prototype._processNext = function(connection) {
  var message = this.message,
    player = this.player,
    music = player.config.music

  if (music.repeat == "off" && !music.autoplay && (!player.shuffle || player.queue.length == 1) && player.isLast() && player.status != "skip" && !Number.isInteger(player.requestIndex)) {
    player.stopped = true
    return
  }

  if (!player.requestIndex) {
    if (player.isLast() && music.autoplay && music.repeat != "all" && !music.shuffle) {
      this._processAutoplay()
    } else if (music.shuffle && (!player.status || player.status == "skip") && music.repeat != "single") {
      this._processShuffle()
    } else if (music.repeat == "all" && player.isLast()) {
      player.requestIndex = 0
    }
  } else if (music.repeat != "single") {
    player.currentQueue += 1
  }

  player.currentQueue = player.requestIndex || player.currentQueue
  player.status = null
  player.requestIndex = null
  this._execute(connection)
}

Music.prototype._processShuffle = function() {
  var player = this.player,
    music = player.config.music

  if (player.shuffled.indexOf(player.currentQueue) == -1) player.shuffled.push(player.currentQueue)
  if (player.shuffled.length == player.queue.length) player.shuffled = [player.currentQueue]
  do {
    player.requestIndex = Math.floor(Math.random() * player.queue.length)
  } while (player.shuffled.indexOf(player.requestIndex) > -1 && player.queue.length > 1)
}

Music.prototype._savePlaylist = function() {
  var message = this.message,
    player = this.player,
    music = player.config.music

  $.storeMusicPlaylist({
    guild: message.guild.id,
    voice: message.member.voiceChannel.id,
    msg: message.channel.id
  }, player.queue.map(x => x.url))
}

Music.prototype._processAutoplay = async function() {
  var message = this.message,
    player = this.player,
    music = player.config.music

  var info = player.queue[player.currentQueue].info
  if (player.autoplayid.indexOf(info.video_id) == -1) player.autoplayid.push(info.video_id)

  for (var i = 0; i < info.related_videos.length; i++) {
    var id = info.related_videos[i].id || info.related_videos[i].video_id
    if (player.autoplayid.indexOf(id) == -1) {
      player.autoplayid.push(id)
      this._addToQueue(await ytdl.getInfo(id), true)
      break
    } else if (i == info.related_videos.length - 1) {
      player.autoplayid = []
      i = -1
    }
  }
  player.currentQueue += 1
}

Music.prototype._processAutoResume = async function(id, playlist) {
  var message = this.message,
    player = this.player,
    self = this

  var msg = await message.channel.send($.embed("Bot Restarted. Would you like to add the previous playlist to queue? (y | n)"))
  message.channel.awaitMessages((m) => m.content.toLowerCase() == "y" || m.content.toLowerCase() == "n", {
    max: 1,
    time: 60000,
    errors: ['time']
  }).then(async (m) => {
    var ans = m.first().content.toLowerCase()
    m.first().delete().catch(() => {})
    if (ans == "n") throw "no"
    $.log(`Adding ${playlist.length} ${playlist.length == 1 ? "song" : "songs"} to the queue.`, message)
    msg.edit($.embed(`Adding ${playlist.length} ${playlist.length == 1 ? "song" : "songs"} to the queue.`)).catch(() => {})
    var error = 0
    for (var i = 0; i < playlist.length; i++) {
      try {
        self._addToQueue(await ytdl.getInfo(playlist[i]))
        if (!message.guild.voiceConnection) {
          message.member.voiceChannel.join()
            .then((connection) => {
              player.connection = connection
              this._execute(connection)
            }).catch(() => {
              message.channel.send("I can't join the voice channel.")
            })
        }
      } catch (err) {
        $.warn(err)
        error++
      }
    }
    msg.edit($.embed(`Done! Loaded ${playlist.length} ${playlist.length == 1 ? "song" : "songs"}.` + (error > 0 ? ` ${error} failed to load.` : ""))).then(m => m.delete({
      timeout: 30000
    })).catch(() => {})
  }).catch(async (err) => {
    await msg.delete().catch(() => {})
    if (err == "no") message.channel.send($.embed("Okay.")).then(m => m.delete({
      timeout: 3000
    }).catch(() => {}))
    $.removeMusicPlaylist(message.guild.id)
  })
}

Music.prototype._addToQueue = function(info, isBot) {
  var message = this.message,
    player = this.player

  player.queue.push({
    title: info.title,
    url: info.video_url,
    requested: isBot ? bot.user : message.author,
    info: info
  })

  this._savePlaylist()
}

module.exports = Music