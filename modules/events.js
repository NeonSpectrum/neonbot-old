const bot = require('../bot')
const moment = require('moment')
const $ = require('../handler/functions')
const Music = require('./music')

bot.on('voiceStateUpdate', (oldMember, newMember) => {
  if (newMember.user.bot) return

  var msg, config

  if (oldMember.voiceChannelID != null && newMember.voiceChannelID == null) {
    var music = new Music(oldMember)
    config = $.getServerConfig(oldMember.guild.id)

    msg = `**${oldMember.user.username}** has disconnected from **${bot.channels.get(oldMember.voiceChannelID).name}**`

    if (newMember.guild.channels.get(oldMember.voiceChannelID).members.filter(s => !s.user.bot).size == 0) music.pause()
  } else if (oldMember.voiceChannelID == null && newMember.voiceChannelID != null) {
    var music = new Music(newMember)
    config = $.getServerConfig(newMember.guild.id)

    msg = `**${newMember.user.username}** has connected to **${bot.channels.get(newMember.voiceChannelID).name}**`

    if (newMember.guild.channels.get(newMember.voiceChannelID).members.filter(s => !s.user.bot).size > 0) music.resume()
  }
  if (msg) {
    if (config.channel.voicetts) {
      bot.channels.get(config.channel.voicetts).send(msg, {
        tts: true
      }).then(msg => msg.delete({
        timeout: 5000
      }))
    }
    if (config.channel.log) {
      bot.channels.get(config.channel.log).send($.embed()
        .setAuthor("Voice Presence Update", `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
        .setDescription(`\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\`:bust_in_silhouette:${msg}.`)
      )
    }
  }
})

bot.on('presenceUpdate', (oldMember, newMember) => {
  if (newMember.user.bot) return

  var config = $.getServerConfig(newMember.guild.id),
    msg
  if (oldMember.presence.status != newMember.presence.status) {
    msg = `**${newMember.user.username}** is now **${newMember.presence.status}**`
  } else if (oldMember.presence.activity != newMember.presence.activity) {
    msg = `**${newMember.user.username}** is now ${newMember.presence.activity ? newMember.presence.activity.type.toLowerCase() : "playing"} **${!newMember.presence.activity ? "nothing" : newMember.presence.activity.name}**`
  }
  if (msg && config.channel.log) {
    bot.channels.get(config.channel.log).send($.embed()
      .setAuthor("User Presence Update", `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
      .setDescription(`\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\`:bust_in_silhouette:${msg}.`)
    )
  }
})

bot.on('guildMemberAdd', (member) => {
  var config = $.getServerConfig(member.guild.id)

  guild.channels.first().send($.embed()
    .setAuthor("New Member", `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
    .setDescription(`Welcome to ${member.guild.name}, ${member.user.toString()}!`)
  ).then(s => s.delete({
    timeout: 30000
  }))
  if (config.channel.log) {
    bot.channels.get(config.channel.log).send($.embed()
      .setAuthor("Guild Member Update", `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
      .setDescription(`\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\` ${member.user.username} joined the server.`)
    )
  }
})

bot.on('guildMemberRemove', (member) => {
  var config = $.getServerConfig(member.guild.id)

  guild.channels.first().send($.embed()
    .setAuthor("Member Left", `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
    .setDescription(`${member.user.tag} left the server!`)
  ).then(s => s.delete({
    timeout: 30000
  }))
  if (config.channel.log) {
    bot.channels.get(config.channel.log).send($.embed()
      .setAuthor("Guild Member Update", `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)
      .setDescription(`\`${moment().format('YYYY-MM-DD hh:mm:ss A')}\` ${member.user.username} left the server.`)
    )
  }
})

bot.on('guildCreate', (guild) => {
  var guilds = Array.from(bot.guilds.keys())
  $.processDatabase(guilds, guildlist)
  guild.channels.first().send($.embed(`Thanks for inviting me on this server! <3`))
})

module.exports = bot