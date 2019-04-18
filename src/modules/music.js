const bot = require('../bot')
const { Embeds: EmbedsMode } = require('discord-paginationembed')

const ytdl = require('ytdl-core')

const $ = require('../assets/functions')

const Youtube = require('simple-youtube-api')
const yt = new Youtube(bot.env.GOOGLE_API)

const spotifyUri = require('spotify-uri')

const Helper = require('./helper')

const servers = bot.music

class Music extends Helper {
  constructor(message) {
    if (!message) return super()

    super(
      message,
      servers[message.guild.id] || {
        config: $.getServerConfig(message.guild.id),
        queue: [],
        autoplayid: [],
        shuffled: [],
        connection: null,
        currentQueue: 0,
        currentChannel: (message && message.channel.id) || null,
        previnfo: null,
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
        isLast: () => this.player.queue.length - 1 === this.player.currentQueue,
        getCurrentQueue: () => this.player.queue[this.player.currentQueue]
      }
    )

    this.player = this.server
  }
}

Music.prototype.play = async function(args) {
  const { message, player } = this

  if (!message.member.voice.channel) {
    return this.send($.embed('You must be in a voice channel!'))
  }
  if (!args[0] && !player.stopped) {
    return this.send($.embed('Please provide a keyword or link.'))
  }

  if (Number.isInteger(+args[0]) || (!args[0] && !player.stopped && player.queue.length !== 0)) {
    this.resume()
    var index = Number.isInteger(+args[0]) ? +args[0] : 1
    if (!player.queue[index - 1]) {
      return this.send($.embed(`Error! There are only ${player.queue.length} songs.`))
    }
    if (
      !$.isOwner(message.author.id) &&
      player.getCurrentQueue().requested.id !== message.author.id &&
      !player.getCurrentQueue().requested.bot &&
      !player.stopped
    ) {
      return this.send($.embed('Please respect the one who queued the song.'))
    }
    if (player.stopped) {
      player.stopped = false
      player.currentQueue = index - 1
      this._execute(player.connection)
    } else {
      player.requestIndex = index - 1
      player.dispatcher.end()
    }
  } else if (args[0].match(/^.*(youtu.be\/|list=)([^#&?]*).*/g)) {
    var videos

    try {
      videos = await (await yt.getPlaylist(args[0])).getVideos()
    } catch (err) {
      return this.send($.embed(`Invalid Playlist URL`))
    }

    if (videos.length === 0) {
      return this.send($.embed('No videos found in the playlist.'))
    }

    let msg = await this.send(
      $.embed(`Adding ${videos.length} ${videos.length === 1 ? 'song' : 'songs'} to the queue.`)
    )

    for (let video of videos) {
      this._addToQueue(await ytdl.getInfo(video.id))
      if (i === 0) this._connect()
    }
    msg
      .edit($.embed(`Done! Loaded ${videos.length} ${videos.length === 1 ? 'song' : 'songs'}.`))
      .then(m =>
        m.delete({
          timeout: 10000
        })
      )
      .catch(() => {})
  } else if (args[0].match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/g)) {
    let info = await ytdl.getInfo(args[0])
    message.channel
      .send(
        $.embed()
          .setAuthor(`Added song to queue #${player.queue.length + 1}`, 'https://i.imgur.com/SBMH84I.png')
          .setTitle(info.title)
          .setURL(info.video_url)
      )
      .then(m =>
        m
          .delete({
            timeout: 5000
          })
          .catch(() => {})
      )
    this._addToQueue(info)
    this._connect()
  } else if (args[0].match(/^(spotify:|https:\/\/[a-z]+\.spotify\.com\/)/g)) {
    var uri = spotifyUri.parse(args[0])
    var token = await $.getSpotifyToken()
    if (uri.type === 'playlist') {
      let msg
      var loop = async offset => {
        var json = await $.fetch(
          `https://api.spotify.com/v1/users/${uri.user}/playlists/${
            uri.id
          }/tracks?offset=${offset}&limit=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )
        if (json.items) {
          msg =
            msg ||
            (await this.send(
              $.embed(`Adding ${json.total} ${json.total === 1 ? 'song' : 'songs'} to the queue.`)
            ))

          var error = 0
          var connected = false

          for (let item of json.items) {
            let videos = await yt.searchVideos(`${item.track.artists[0].name} ${item.track.name}`)
            if (videos.length === 0) {
              error++
              continue
            }
            this._addToQueue(await ytdl.getInfo(videos[0].url))
            if (!connected) {
              connected = true
              this._connect()
            }
          }

          if (json.next) loop(offset + 100)
          else {
            msg
              .edit(
                $.embed(
                  `Done! Loaded ${json.total} ${json.total === 1 ? 'song' : 'songs'}.` +
                    (error > 0 ? ` ${error} failed to load.` : '')
                )
              )
              .then(m =>
                m.delete({
                  timeout: 10000
                })
              )
              .catch(() => {})
          }
        } else {
          this.send($.embed("I can't play this song."))
        }
      }
      loop(0)
    } else if (uri.type === 'track') {
      var json = await $.fetch(`https://api.spotify.com/v1/tracks/${uri.id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      let videos = await yt.searchVideos(`${json.artists[0].name} ${json.name}`)
      if (videos.length === 0) {
        return this.send($.embed("I can't find a song from that spotify link."))
      }
      let info = await ytdl.getInfo(videos[0].url)
      message.channel
        .send(
          $.embed()
            .setAuthor(`Added song to queue #${player.queue.length + 1}`, 'https://i.imgur.com/SBMH84I.png')
            .setTitle(info.title)
            .setURL(info.video_url)
        )
        .then(m =>
          m
            .delete({
              timeout: 5000
            })
            .catch(() => {})
        )
      this._addToQueue(info)
      this._connect()
    } else {
      this.send($.embed("I can't play that spotify link."))
    }
  } else {
    let videos = await yt.searchVideos(args.join(' '))
    if (videos.length === 0) {
      return this.send($.embed('Cannot find any videos'), 5000)
    }

    var temp = $.embed().setAuthor('Choose 1-5 below.', 'https://i.imgur.com/SBMH84I.png')
    var songSearchList = []
    for (let [i, video] of videos.entries()) {
      temp.addField(`${i + 1}. ${video.title}`, video.url)
      songSearchList.push({
        title: video.title,
        url: video.url,
        requested: message.author
      })
    }

    var reactionlist = ['\u0031\u20E3', '\u0032\u20E3', '\u0033\u20E3', '\u0034\u20E3', '\u0035\u20E3', '🗑']
    var msg = await this.send(temp)
    msg
      .awaitReactions(
        (reaction, user) => reactionlist.indexOf(reaction.emoji.name) > -1 && user.id === message.author.id,
        {
          max: 1,
          time: 15000,
          errors: ['time']
        }
      )
      .then(async collected => {
        collected
          .first()
          .message.delete()
          .catch(() => {})
        if (collected.first().emoji.name === '🗑') return
        let index = reactionlist.indexOf(collected.first().emoji.name)
        message.channel
          .send(
            $.embed(songSearchList[index].title).setTitle(
              `You have selected #${index + 1}. Adding song to queue #${player.queue.length + 1}`
            )
          )
          .then(m =>
            m
              .delete({
                timeout: 5000
              })
              .catch(() => {})
          )
        this._addToQueue(await ytdl.getInfo(songSearchList[index].url))
        this._connect()
      })
      .catch(() => {
        msg.delete().catch(() => {})
      })
    for (let reaction of reactionlist) {
      try {
        await msg.react(reaction)
      } catch (err) {
        break
      }
    }
  }
}

Music.prototype._connect = async function() {
  const { message, player } = this

  if (player.dispatcher && player.dispatcher.paused) {
    if (player.lastPauseMessage) {
      player.lastPauseMessage.delete().catch(() => {})
    }
    player.lastPauseMessage = await this.send(
      $.embed(`Player paused. \`${player.config.prefix}resume\` to resume.`)
    )
  }

  if (!message.guild.voiceConnection) {
    try {
      player.connection = await message.member.voice.channel.join()
      this.log('Connected to ' + message.member.voice.channel.name)
      this._execute(player.connection)
    } catch (err) {
      $.warn(err)
      this.send($.embed("I can't join the voice channel."))
    }
  } else if (player.stopped) {
    player.stopped = false
    player.currentQueue = player.queue.length - 1
    this._execute(player.connection)
  }

  return player.connection
}

Music.prototype.stop = function() {
  const { message, player } = this

  if (player.dispatcher) {
    if (!message.member.voice.channel) {
      return this.send($.embed('You must be in the voice channel!'))
    }
    if (
      !$.isOwner(message.author.id) &&
      player.getCurrentQueue().requested.id !== message.author.id &&
      !player.getCurrentQueue().requested.bot
    ) {
      return this.send($.embed('Please respect the one who queued the song.'))
    }

    player.stopped = true
    player.dispatcher.end()

    if (player.status != 'reset') {
      this.send($.embed('Player stopped!'), 5000)
      this.log('Player stopped!')
    }
  }
}

Music.prototype.skip = function() {
  const { message, player } = this

  if (player.dispatcher) {
    if (!message.member.voice.channel) {
      return this.send($.embed('You must be in the voice channel!'))
    }

    if (
      !$.isOwner(message.author.id) &&
      player.getCurrentQueue().requested.id !== message.author.id &&
      !player.getCurrentQueue().requested.bot
    ) {
      return this.send($.embed('Please respect the one who queued the song.'))
    }

    this.resume()

    player.status = 'skip'
    player.dispatcher.end()

    this.log('Player skipped!')
  }
}

Music.prototype.seek = function(args) {
  const { message, player } = this
  const seconds = $.convertToSeconds(args[0] || 0)

  if (!Number.isInteger(seconds) || seconds <= 10) {
    return this.send($.embed('Parameter must be more than 10 seconds.'))
  }
  if (player.dispatcher) {
    if (!message.member.voice.channel) {
      return this.send($.embed('You must be in the voice channel!'))
    }
    if (
      !$.isOwner(message.author.id) &&
      player.getCurrentQueue().requested.id !== message.author.id &&
      !player.getCurrentQueue().requested.bot
    ) {
      return this.send($.embed('Please respect the one who queued the song.'))
    }

    player.disableFinish = true
    player.dispatcher.end()

    this._execute(player.connection, seconds)

    this.send($.embed(`Seeking to ${seconds} seconds. Please wait.`), 3000)
  }
}

Music.prototype.removesong = async function(args) {
  const { message, player } = this

  if (player.dispatcher) {
    if (!message.member.voice.channel) {
      return this.send($.embed('You must be in the voice channel!'))
    }

    if (!args[0] || !Number.isInteger(+args[0])) {
      return this.send($.embed('Invalid Parameters. <index>'))
    }

    if (+args[0] <= 0 || +args[0] > player.queue.length) {
      return this.send($.embed('There is no song in that index.'))
    }

    var index = +args[0] - 1

    if (
      !$.isOwner(message.author.id) &&
      player.queue[index].requested.id !== message.author.id &&
      !player.queue[index].requested.bot
    ) {
      return this.send($.embed("You cannot remove this song. You're not the one who requested it."))
    }

    await this.send(
      $.embed()
        .setAuthor('Removed Song #' + +args[0], 'https://i.imgur.com/SBMH84I.png')
        .setFooter(player.queue[index].requested.tag, player.queue[index].requested.displayAvatarURL())
        .setTitle(player.queue[index].title)
        .setURL(player.queue[index].url)
    )

    player.disableFinish = true
    player.queue.splice(index, 1)

    if (index < player.currentQueue) player.currentQueue -= 1
    else if (index === player.currentQueue) this._execute(player.connection)

    this._savePlaylist()
  }
}

Music.prototype.list = function() {
  const { message, player } = this
  const { music } = player.config

  if (player.queue.length === 0) {
    this.send($.embed('The playlist is empty'))
  } else {
    try {
      var embeds = []
      var temp = []
      var totalseconds = 0
      for (let queue of player.queue) {
        temp.push(
          `\`${player.currentQueue === i ? '*' : ''}${i + 1}.\` [${queue.title}](${
            queue.url
          })\n\t  \`${$.formatSeconds(queue.info.length_seconds)} | ${queue.requested.tag}\``
        )
        totalseconds += +queue.info.length_seconds
        if ((i !== 0 && (i + 1) % 10 === 0) || i === player.queue.length - 1) {
          embeds.push($.embed().setDescription(temp.join('\n')))
          temp = []
        }
      }
      var footer = [
        `${player.queue.length} ${player.queue.length === 1 ? 'song' : 'songs'}`,
        $.formatSeconds(totalseconds),
        `Volume: ${music.volume}%`,
        `Repeat: ${music.repeat}`,
        `Shuffle: ${music.shuffle ? 'on' : 'off'}`,
        `Autoplay: ${music.autoplay ? 'on' : 'off'}`
      ]
      if (Math.ceil(player.queue.length / 10) === 1 && embeds[0]) {
        this.send(
          embeds[0]
            .setAuthor('Player Queue', 'https://i.imgur.com/SBMH84I.png')
            .setFooter(footer.join(' | '), bot.user.displayAvatarURL())
        )
      } else {
        new EmbedsMode()
          .setArray(embeds)
          .setAuthorizedUser(message.author)
          .setChannel(message.channel)
          .setAuthor('Player Queue', 'https://i.imgur.com/SBMH84I.png')
          .setColor('#59ABE3')
          .setFooter(footer.join(' | '), bot.user.displayAvatarURL())
          .build()
      }
    } catch (err) {
      $.warn(err)
    }
  }
}

Music.prototype.volume = async function(args) {
  const { message, player } = this

  if (Number.isInteger(+args[0])) {
    if (+args[0] > 200) {
      return this.send($.embed('The volume must be less than or equal to 200.'))
    }
    if (player && player.dispatcher) player.dispatcher.setVolume(args / 100)
    player.config = await $.updateServerConfig(message.guild.id, {
      'music.volume': +args[0]
    })
    this.send($.embed(`Volume is now set to ${player.dispatcher.volume * 100}%`))
    this.log(`Volume is now set to ${player.dispatcher.volume * 100}%`)
  } else {
    this.send($.embed(`Volume is set to ${player.dispatcher.volume * 100}%`))
  }
}

Music.prototype.repeat = async function(args) {
  const { message, player } = this

  if (
    args[0] &&
    args[0].toLowerCase() !== 'off' &&
    args[0].toLowerCase() !== 'single' &&
    args[0].toLowerCase() !== 'all'
  ) {
    this.send($.embed('Invalid parameters. (off | single | all)'))
  } else if (!args[0]) {
    this.send($.embed(`Repeat is set to ${player.config.music.repeat}.`))
  } else {
    player.config = await $.updateServerConfig(message.guild.id, {
      'music.repeat': args[0]
    })
    this.send($.embed(`Repeat is now set to ${player.config.music.repeat}.`))
    this.log(`Repeat is now set to ${player.config.music.repeat}.`)
  }
}

Music.prototype.shuffle = async function(args) {
  const { message, player } = this

  if (args[0] && args[0].toLowerCase() !== 'off' && args[0].toLowerCase() !== 'on') {
    this.send($.embed('Invalid parameters. (off | on)'))
  } else if (!args[0]) {
    this.send($.embed(`Shuffle is set to ${player.config.music.shuffle ? 'on' : 'off'}.`))
  } else {
    player.config = await $.updateServerConfig(message.guild.id, {
      'music.shuffle': args[0] === 'on'
    })
    this.send($.embed(`Shuffle is now set to ${player.config.music.shuffle ? 'on' : 'off'}.`))
    this.log(`Shuffle is now set to ${player.config.music.shuffle ? 'on' : 'off'}.`)
  }
}

Music.prototype.pause = async function() {
  const { message, player } = this

  if (
    player &&
    player.dispatcher &&
    !player.dispatcher.paused &&
    player.queue.length > 0 &&
    !player.stopped
  ) {
    if (message.member && !message.member.voice.channel) {
      return this.send($.embed('You must be in the voice channel!'))
    }
    player.dispatcher.pause()
    if (message.channel) {
      player.lastPauseMessage = await this.send(
        $.embed(`Player paused. \`${player.config.prefix}resume\` to resume.`)
      )
      this.log('Player paused!')
    } else {
      if (player.lastAutoMessage) {
        player.lastAutoMessage.delete().catch(() => {})
      }
      player.lastAutoMessage = await bot.channels
        .get(player.currentChannel)
        .send($.embed(`Player has automatically paused because there are no users connected.`))
      $.log('Player has automatically paused because there are no users connected.', player.lastAutoMessage)
    }
  }
}

Music.prototype.resume = async function() {
  const { message, player } = this

  if (player && player.dispatcher && player.dispatcher.paused && player.queue.length > 0 && !player.stopped) {
    if (message.member && !message.member.voice.channel) {
      return this.send($.embed('You must be in the voice channel!'))
    }
    if (message.channel) {
      if (player.lastPauseMessage) {
        player.lastPauseMessage.delete()
        player.lastPauseMessage = null
      }
      this.send($.embed(`Player resumed.`), 5000)
      this.log('Player resumed!')
    } else {
      if (player.lastAutoMessage) {
        player.lastAutoMessage.delete().catch(() => {})
      }
      player.lastAutoMessage = await bot.channels
        .get(player.currentChannel)
        .send($.embed(`Player has automatically resumed.`))
        .then(s =>
          s
            .delete({
              timeout: 5000
            })
            .catch(() => {})
        )
      $.log('Player has automatically resumed.', player.lastAutoMessage)
    }
    player.dispatcher.resume()
  }
}

Music.prototype.autoplay = async function(args) {
  const { message, player } = this

  if (!args[0]) {
    return this.send($.embed(`Autoplay is set to ${player.config.music.autoplay ? 'on' : 'off'}.`))
  }
  if (args[0] !== 'on' && args[0] !== 'off') {
    return this.send($.embed('Invalid Parameters (on | off).'))
  }
  player.config = await $.updateServerConfig(message.guild.id, {
    'music.autoplay': args[0] === 'on'
  })
  this.send($.embed('Autoplay is now ' + (player.config.music.autoplay ? 'enabled' : 'disabled') + '.'))
  this.log('Autoplay ' + (player.config.autoplay ? 'enabled' : 'disabled') + '.')
}

Music.prototype.nowplaying = function() {
  const { message, player } = this
  const { music } = player.config

  var temp = $.embed('Nothing playing')
  if (player && player.getCurrentQueue() && !player.stopped) {
    var { requested, info, title } = player.getCurrentQueue()

    var footer = [
      requested.tag,
      `Volume: ${music.volume}%`,
      `Repeat: ${music.repeat}`,
      `Shuffle: ${music.shuffle ? 'on' : 'off'}`,
      `Autoplay: ${music.autoplay ? 'on' : 'off'}`
    ]
    temp = $.embed()
      .setTitle('Title')
      .setDescription(title)
      .setThumbnail(info.thumbnail_url)
      .addField(
        'Time',
        `${$.formatSeconds(player.dispatcher.streamTime / 1000 + player.seek)} - ${$.formatSeconds(
          info.length_seconds
        )}`
      )
      .addField('Description', info.description)
      .setFooter(footer.join(' | '), requested.displayAvatarURL())
  }
  this.send(temp)
}

Music.prototype.reset = async function() {
  const { message, player } = this

  if (!message.member.voice.channel) {
    return this.send($.embed('You must be in the voice channel!'))
  }
  if (message.guild.voiceConnection) {
    if (player.lastPlayingMessage) {
      player.lastPlayingMessage.delete().catch(() => {})
    }
    if (player.lastFinishedMessage) {
      player.lastFinishedMessage.delete().catch(() => {})
    }

    player.status = 'reset'

    this.stop()

    delete servers[message.guild.id]
    $.removeMusicPlaylist(message.guild.id)

    this.send($.embed('Player has been reset.'), 10000)

    message.guild.voiceConnection.disconnect()
  }
}

Music.prototype.restartsong = function() {
  const { message, player } = this

  if (message.guild.voiceConnection && player.dispatcher) {
    if (!message.member.voice.channel) {
      return this.send($.embed('You must be in the voice channel!'))
    }
    player.requestIndex = player.currentQueue
    player.dispatcher.end()
  }
}

Music.prototype._execute = async function(connection, seconds = 0) {
  const { message, player } = this
  const { music } = player.config

  player.seek = seconds

  try {
    player.dispatcher = connection.play(
      ytdl(player.getCurrentQueue().url, {
        quality: 'highestaudio',
        begin: player.seek * 1000
      }),
      {
        volume: music.volume / 100,
        // highWaterMark: 1,
        bitrate: 'auto'
      }
    )

    if (player.seek) player.disableStart = true

    player.dispatcher.on('start', () => {
      if (!player.disableStart) this._processStart()
      else player.disableStart = false
    })

    player.dispatcher.on('finish', () => {
      if (!player.disableFinish) {
        player.dispatcher.destroy()
        this._processFinish(connection)
      } else player.disableFinish = false
    })
  } catch (err) {
    $.warn(err)
    this.send($.embed(`I can't play this song.`))
  }
}

Music.prototype._processStart = async function() {
  const { message, player } = this
  const { music } = player.config

  var { requested, info, title, url } = player.getCurrentQueue()

  var footer = [
    requested.tag,
    $.formatSeconds(info.length_seconds),
    `Volume: ${music.volume}%`,
    `Repeat: ${music.repeat}`,
    `Shuffle: ${music.shuffle ? 'on' : 'off'}`,
    `Autoplay: ${music.autoplay ? 'on' : 'off'}`
  ]

  if (player.lastPlayingMessage) {
    player.lastPlayingMessage.delete().catch(() => {})
  }

  player.lastPlayingMessage = await this.send(
    $.embed()
      .setAuthor('Now Playing #' + (player.currentQueue + 1), 'https://i.imgur.com/SBMH84I.png')
      .setFooter(footer.join(' | '), requested.displayAvatarURL())
      .setTitle(title)
      .setURL(url)
  )

  this.log('Now playing ' + title)
}

Music.prototype._processFinish = async function(connection) {
  const { message, player } = this
  const { music } = player.config

  var { requested, info, title, url } = player.getCurrentQueue()
  var footer = [
    requested.tag,
    $.formatSeconds(info.length_seconds),
    `Volume: ${music.volume}%`,
    `Repeat: ${music.repeat}`,
    `Shuffle: ${music.shuffle ? 'on' : 'off'}`,
    `Autoplay: ${music.autoplay ? 'on' : 'off'}`
  ]

  if (player.lastFinishedMessage) {
    player.lastFinishedMessage.delete().catch(() => {})
  }

  if (player.status != 'reset') {
    player.lastFinishedMessage = await this.send(
      $.embed()
        .setAuthor('Finished Playing #' + (player.currentQueue + 1), 'https://i.imgur.com/SBMH84I.png')
        .setFooter(footer.join(' | '), requested.displayAvatarURL())
        .setTitle(title)
        .setURL(url)
    )
  }

  if (!player.stopped) {
    this._processNext(connection)
  } else {
    player.status = null
    player.requestIndex = null
    player.currentQueue = 0
    player.shuffled = []
  }
}

Music.prototype._processNext = async function(connection) {
  const { player } = this
  const { music } = player.config

  if (
    music.repeat === 'off' &&
    !music.autoplay &&
    (!player.shuffle || player.queue.length === 1) &&
    player.isLast() &&
    player.status !== 'skip' &&
    !Number.isInteger(player.requestIndex)
  ) {
    player.stopped = true
    return
  }

  if (!player.requestIndex) {
    if (player.isLast() && music.autoplay && music.repeat !== 'all' && !music.shuffle) {
      await this._processAutoplay()
    } else if (music.shuffle && (!player.status || player.status === 'skip') && music.repeat !== 'single') {
      this._processShuffle()
    } else if (music.repeat === 'all' && player.isLast()) {
      player.requestIndex = 0
    }
  }

  player.currentQueue =
    player.requestIndex !== null
      ? player.requestIndex
      : player.currentQueue + (music.repeat !== 'single' ? 1 : 0)
  player.status = null
  player.requestIndex = null
  this._execute(connection)
}

Music.prototype._processShuffle = function() {
  const { player } = this

  if (player.shuffled.indexOf(player.currentQueue) === -1) {
    player.shuffled.push(player.currentQueue)
  }
  if (player.shuffled.length === player.queue.length) {
    player.shuffled = [player.currentQueue]
  }
  do {
    player.requestIndex = Math.floor(Math.random() * player.queue.length)
  } while (player.shuffled.indexOf(player.requestIndex) > -1 && player.queue.length > 1)
}

Music.prototype._savePlaylist = function() {
  const { message, player } = this

  if (message.member.voice) {
    $.storeMusicPlaylist(
      {
        guild: message.guild.id,
        voice: message.member.voice.channelID,
        msg: message.channel.id
      },
      player.queue.map(x => x.url)
    )
  }
}

Music.prototype._processAutoplay = async function() {
  const { player } = this

  let { info } = player.getCurrentQueue()

  if (player.autoplayid.indexOf(info.video_id) === -1) {
    player.autoplayid.push(info.video_id)
  }

  for (let related_videos of info.related_videos) {
    var id = related_videos.id || related_videos.video_id
    if (player.autoplayid.indexOf(id) === -1) {
      player.autoplayid.push(id)
      this._addToQueue(await ytdl.getInfo(id), true)
      break
    } else if (i === info.related_videos.length - 1) {
      player.autoplayid = []
      i = -1
    }
  }
}

Music.prototype._processAutoResume = async function(id, playlist) {
  const { message, player } = this

  var msg = await this.send(
    $.embed('Bot Restarted. Would you like to add the previous playlist to queue? (y | n)')
  )
  message.channel
    .awaitMessages(m => m.content.toLowerCase() === 'y' || m.content.toLowerCase() === 'n', {
      max: 1,
      time: 60000,
      errors: ['time']
    })
    .then(async m => {
      var ans = m.first().content.toLowerCase()
      m.first()
        .delete()
        .catch(() => {})
      if (ans === 'n') throw new Error('no')
      $.log(`Adding ${playlist.length} ${playlist.length === 1 ? 'song' : 'songs'} to the queue.`, message)
      msg
        .edit($.embed(`Adding ${playlist.length} ${playlist.length === 1 ? 'song' : 'songs'} to the queue.`))
        .catch(() => {})
      var error = 0
      for (let url of playlist) {
        try {
          this._addToQueue(await ytdl.getInfo(url))
          if (!message.guild.voiceConnection) {
            this._connect()
          }
        } catch (err) {
          $.warn(err)
          error++
        }
      }
      msg
        .edit(
          $.embed(
            `Done! Loaded ${playlist.length} ${playlist.length === 1 ? 'song' : 'songs'}.` +
              (error > 0 ? ` ${error} failed to load.` : '')
          )
        )
        .then(m =>
          m.delete({
            timeout: 30000
          })
        )
        .catch(() => {})
    })
    .catch(async err => {
      await msg.delete().catch(() => {})
      if (err === 'no') {
        this.send($.embed('Okay.')).then(m =>
          m
            .delete({
              timeout: 3000
            })
            .catch(() => {})
        )
      }
      $.removeMusicPlaylist(message.guild.id)
    })
}

Music.prototype._addToQueue = function(info, isBot) {
  const { message, player } = this

  player.queue.push({
    title: info.title,
    url: info.video_url,
    requested: isBot ? bot.user : message.author,
    info: {
      video_id: info.video_id,
      thumbnail_url: info.thumbnail_url,
      description:
        info.description.length > 500 ? info.description.substring(0, 500) + '...' : info.description,
      length_seconds: info.length_seconds,
      related_videos: info.related_videos
    }
  })

  this._savePlaylist()
}

module.exports = Music
