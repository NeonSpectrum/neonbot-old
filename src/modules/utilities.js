const moment = require('moment')
const bot = require('../bot')
const reload = require('require-reload')(require)
const help = reload('../assets/help')
const $ = require('../assets/functions')

class Utilities {
  constructor (message) {
    if (typeof message === 'object') {
      var server = {
        config: $.getServerConfig(message.guild.id)
      }
      this.server = server
      this.message = message
      this.log = (content) => {
        $.log(content, message)
      }
    }
  }
}

Utilities.prototype.help = function (args) {
  const message = this.message
  const server = this.server

  if (help[args[0]]) {
    message.channel.send($.embed().addField(`${args[0]} - ${help[args[0]].info}`, `\`Usage:\` \`${help[args[0]].usage.replace(/\{0\}/g, server.config.prefix)}\``))
  } else {
    message.channel.send($.embed('Cannot find command'))
  }
}

Utilities.prototype.cmds = function (args) {
  const message = this.message
  const server = this.server

  if (!bot.modules[args[0]]) return message.channel.send($.embed(`Invalid Module. (${Object.keys(bot.modules).join(' | ')})`))

  var command = bot.modules[args[0]]
  var modules
  switch (args[0].toLowerCase()) {
    case 'admin':
      modules = 'Administration'
      break
    case 'music':
      modules = 'Music'
      break
    case 'util':
      modules = 'Utilities'
      break
    case 'search':
      modules = 'Searches'
      break
    case 'games':
      modules = 'Games'
      break
  }
  var temp = $.embed().setTitle('📘 Command list for ' + modules)
  for (var i = 0; i < command.length; i++) {
    temp.addField(`${command[i]} - ${(help[command[i]] && help[command[i]].info) || 'N/A'}`, `\`Usage:\` \`${(help[command[i]] && help[command[i]].usage.replace(/\{0\}/g, server.config.prefix)) || 'N/A'}\``)
  }
  message.channel.send(temp)
}

Utilities.prototype.ping = function () {
  const message = this.message

  message.channel.send($.embed()
    .setDescription('Pong!')
    .addField('Your ping is', Date.now() - message.createdTimestamp + ' ms')
  )
}

Utilities.prototype.stats = function () {
  const message = this.message

  var guilds = Array.from(bot.guilds.keys())
  var channelsize = 0
  var usersize = 0

  for (let i = 0; i < guilds.length; i++) {
    channelsize += bot.guilds.get(guilds[i]).channels.filter(s => s.type !== 'category').size
    usersize += bot.guilds.get(guilds[i]).members.size
  }

  message.channel.send($.embed()
    .setAuthor(`${bot.package.name} v${bot.package.version}`, bot.user.displayAvatarURL())
    .addField('Username', bot.user.tag, true)
    .addField('Created On', moment(bot.user.createdAt).format('MMM DD, YYYY hh:mm:ss A'), true)
    .addField('Created By', 'NeonSpectrum', true)
    .addField('Guilds', guilds.length, true)
    .addField('Channels', channelsize, true)
    .addField('Users', usersize, true)
    .addField('Command Executed', bot.commandExecuted, true)
    .addField('Ram Usage', `Approximately ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`, true)
    .addField('Uptime', $.formatSeconds(Math.floor(bot.uptime / 1000)), true)
  )
}

Utilities.prototype.say = function (args) {
  const message = this.message

  message.channel.send(args.join(' '))
}

Utilities.prototype.speak = function (args) {
  const message = this.message

  message.channel.send(args.join(' '), {
    tts: true
  })
}

Utilities.prototype.serverinfo = function () {
  const message = this.message

  message.channel.send($.embed()
    .setThumbnail(message.guild.iconURL())
    .addField('Server Name', message.guild.name)
    .addField('Created On', message.guild.createdAt)
    .addField('You Joined', message.member.joinedAt)
    .addField('Total Channels', message.guild.channels.filter(s => s.type !== 'category').size)
    .addField('Total Members', message.guild.memberCount)
  )
}

module.exports = Utilities
