const bot = require('../bot')
const moment = require('moment')
const $ = require('../assets/functions')
const Music = require('./music')
const db = bot.db

const members = bot.events

var Events = {}

Events.voiceStateUpdate = async (oldState, newState) => {
  const oldUser = oldState.member.user
  const newUser = newState.member.user

  if (newUser.bot || newUser.id == '348126827186749440') return
  if (!members[newUser.id]) {
    members[newUser.id] = {
      roleid: null
    }
  }
  const config = $.getServerConfig(newState.guild.id)
  const member = members[newUser.id]

  var msg

  if (oldState.channelID !== null && newState.channelID === null) {
    let music = new Music(oldState)

    msg = `**${oldUser.username}** has disconnected from **${bot.channels.get(oldState.channelID).name}**`

    if (bot.channels.get(oldState.channelID).members.filter(s => !s.user.bot).size === 0) {
      music.pause()
    }

    if (member.roleid) {
      oldState.member.roles
        .remove(member.roleid)
        .then(() => {
          member.roleid = null
        })
        .catch(() => {})
    }
  } else if (oldState.channelID === null && newState.channelID !== null) {
    let music = new Music(newState)

    msg = `**${newUser.username}** has connected to **${bot.channels.get(newState.channelID).name}**`

    if (bot.channels.get(newState.channelID).members.filter(s => !s.user.bot).size === 1) {
      music.resume()
    }

    if (config.music.roles[newState.channelID]) {
      newState.member.roles
        .add(config.music.roles[newState.channelID])
        .then(() => {
          member.roleid = config.music.roles[newState.channelID]
        })
        .catch(() => {})
    }
  }

  if (msg) {
    if (bot.channels.get(config.channel.voicetts)) {
      bot.channels
        .get(config.channel.voicetts)
        .send(msg.replace(/\*\*/g, ''), {
          tts: true
        })
        .then(msg =>
          msg
            .delete({
              timeout: 3000
            })
            .catch(() => {})
        )
    }
    if (bot.channels.get(config.channel.log)) {
      bot.channels.get(config.channel.log).send(
        $.embed()
          .setAuthor(
            'Voice Presence Update',
            `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`
          )
          .setDescription(`\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\`:bust_in_silhouette:${msg}.`)
      )
    }
  }
}

Events.presenceUpdate = async (oldMember, newMember) => {
  if (newMember.user.bot) return

  const oldPresence = oldMember.frozenPresence
  const newPresence = newMember.presence

  const oldActivityName = oldPresence.activity && oldPresence.activity.name
  const newActivityName = newPresence.activity && newPresence.activity.name

  const config = $.getServerConfig(newMember.guild.id)

  var msgs = []
  if (oldPresence.status !== newPresence.status) {
    msgs.push(`**${newPresence.user.username}** is now **${newPresence.status}**`)
  } else if (oldActivityName !== newActivityName) {
    if (oldActivityName) {
      msgs.push(
        `**${
          newMember.user.username
        }** is done ${oldPresence.activity.type.toLowerCase()} **${oldActivityName}**`
      )
    }
    if (newActivityName) {
      msgs.push(
        `**${
          newMember.user.username
        }** is now ${newPresence.activity.type.toLowerCase()} **${newActivityName}**`
      )
    }
  }
  if (msgs.length > 0 && bot.channels.get(config.channel.log)) {
    for (let msg of msgs) {
      await bot.channels.get(config.channel.log).send(
        $.embed()
          .setAuthor(
            'User Presence Update',
            `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`
          )
          .setDescription(`\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\`:bust_in_silhouette:${msg}.`)
      )
    }
  }
}

Events.guildMemberAdd = member => {
  var config = $.getServerConfig(member.guild.id)
  var channel = member.guild.channels.find(x => x.rawPosition === 0 && x.type === 'text')

  bot.channels
    .get(channel.id)
    .send(
      $.embed()
        .setAuthor(
          'New Member',
          `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`
        )
        .setDescription(`Welcome to ${member.guild.name}, ${member.user.toString()}!`)
    )
    .then(s =>
      s
        .delete({
          timeout: 30000
        })
        .catch(() => {})
    )
    .catch(() => {})

  if (bot.channels.get(config.channel.log)) {
    bot.channels.get(config.channel.log).send(
      $.embed()
        .setAuthor(
          'Guild Member Update',
          `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`
        )
        .setDescription(
          `\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\` ${member.user.username} joined the server.`
        )
    )
  }
}

Events.guildMemberRemove = member => {
  var config = $.getServerConfig(member.guild.id)
  var channel = member.guild.channels.find(x => x.rawPosition === 0 && x.type === 'text')

  bot.channels
    .get(channel.id)
    .send(
      $.embed()
        .setAuthor(
          'Member Left',
          `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`
        )
        .setDescription(`${member.user.tag} left the server!`)
    )
    .then(s =>
      s
        .delete({
          timeout: 30000
        })
        .catch(() => {})
    )
  if (bot.channels.get(config.channel.log)) {
    bot.channels.get(config.channel.log).send(
      $.embed()
        .setAuthor(
          'Guild Member Update',
          `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`
        )
        .setDescription(
          `\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\` ${member.user.username} left the server.`
        )
    )
  }
}

Events.guildCreate = async guild => {
  var guilds = Array.from(bot.guilds.keys())
  var guildlist = await db
    .collection('servers')
    .find({})
    .toArray()
  $.processDatabase(guilds, guildlist)
}

Events.messageDelete = message => {
  var config = $.getServerConfig(message.guild.id)

  if (config.channel.msgdelete && message.content) {
    bot.channels.get(config.channel.msgdelete).send(
      $.embed()
        .setTitle('✉ Message Deleted')
        .addField('User: ', message.author.tag)
        .addField('Content: ', message.content)
        .setFooter(moment().format('YYYY-MM-DD hh:mm:ss A'))
    )
  }
}

module.exports = Events
