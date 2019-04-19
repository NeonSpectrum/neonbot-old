const fs = require('fs')
const exec = require('child_process').exec
const bot = require('../bot')
const { Embeds: EmbedsMode } = require('discord-paginationembed')
const $ = require('../assets/functions')

class Administration {
  constructor(message) {
    if (typeof message === 'object') {
      this.server = {
        config: $.getServerConfig(message.guild.id)
      }
      this.message = message
      this.log = content => {
        $.log(content, message)
      }
    }
  }
}

Administration.prototype.addrole = async function(args) {
  var message = this.message

  if (!message.member.hasPermission('MANAGE_ROLES')) {
    return message.channel.send($.embed('Insufficient Permission.'))
  }

  var user = message.guild.member(message.mentions.users.first()) || message.guild.members.get(args[0])

  if (!user) return message.channel.send($.embed('User not found.'))

  if (!args.slice(1).join(' ')) {
    return message.channel.send($.embed('Specify a role!'))
  }

  var role = message.guild.roles.find(`name`, args.slice(1).join(' '))

  if (!role) return message.channel.send($.embed("Couldn't find that role."))

  if (user.roles.has(role.id)) {
    return message.channel.send($.embed('They already have that role.'))
  }

  await user.roles.add(role.id)

  message.channel.send(
    $.embed()
      .setDescription('✔ Role Added')
      .setField(`${user.toString()}>`, `they have been given the role ${role.name}`)
  )
}

Administration.prototype.removerole = async function(args) {
  var message = this.message

  if (!message.member.hasPermission('MANAGE_ROLES')) {
    return message.channel.send($.embed('Insufficient Permission.'))
  }

  var user = message.guild.member(message.mentions.users.first()) || message.guild.members.get(args[0])

  if (!user) return message.channel.send($.embed("Couldn't find that user."))

  if (!args.slice(1).join(' ')) {
    return message.channel.send($.embed('Specify a role!'))
  }

  var role = message.guild.roles.find(`name`, args.slice(1).join(' '))

  if (!role) return message.channel.send($.embed("Couldn't find that role."))

  if (!user.roles.has(role.id)) {
    return message.channel.send($.embed("They don't have that role."))
  }

  await user.role.remove(role.id)

  message.channel.send(
    $.embed()
      .setTitle('🚫 Removed Role')
      .setDescription(`${user.toString()}, We removed ${role.name} from them.`)
  )
}

Administration.prototype.ban = function(args) {
  var message = this.message

  if (!message.member.hasPermission('BAN_MEMBERS')) {
    return message.channel.send($.embed('Insufficient Permission.'))
  }

  var user = message.guild.member(message.mentions.users.first() || message.guild.members.get(args[0]))

  if (!user) return message.channel.send($.embed('User not found'))

  if (user.id === bot.user.id) {
    return message.channel.send($.embed('You cannot ban me.'))
  }

  message.guild.member(user).ban(args.slice(1).join(' '))

  message.send(
    $.embed()
      .setTitle('🚫 Ban')
      .setThumbnail(user.displayAvatarURL())
      .addField('Banned User', `${user} with ID ${user.id}`)
      .addField('Banned By', `${message.author.toString()} with ID ${message.author.id}`)
      .addField('Banned In', message.channel)
      .addField('Time', message.createdAt)
  )
}

Administration.prototype.prune = async function(args) {
  const message = this.message

  await message.delete().catch(() => {})
  if (message.mentions.users.first()) {
    if (args[1] && args[1] > 100 && args[1] < 1) {
      return message.channel.send($.embed('Parameters must be `1-100`.'))
    }
    let count = +args[1] || 10
    let msg = await message.channel.send(
      $.embed(
        `Please wait while I'm deleting ${count} ${message.mentions.users.first().username}'s ${
          count === 1 ? 'message' : 'messages'
        }...`
      )
    )
    await bulkDeleteMessagesFrom(message.mentions.users.first().id, message.channel, count)
    msg
      .edit(
        $.embed(
          `Done deleting ${message.mentions.users.first().username}'s ${
            args[0] === 1 ? 'message' : 'messages'
          }.`
        )
      )
      .then(s =>
        s
          .delete({
            timeout: 3000
          })
          .catch(() => {})
      )
  } else if (Number.isInteger(+args[0])) {
    if (args[0] > 100 && args[0] < 1) {
      return message.channel.send($.embed('Parameters must be `1-100`.'))
    }
    message.channel.bulkDelete(+args[0]).catch(() => {})
  } else {
    let msg = await message.channel.send($.embed("Please wait while I'm deleting 10 bot messages..."))
    try {
      await bulkDeleteMessagesFrom(bot.user.id, message.channel, 10, {
        filter: msg.id
      })
    } catch (err) {
      console.log(err)
    }
    msg
      .edit($.embed('Done deleting bot messages.'))
      .then(m =>
        m
          .delete({
            timeout: 3000
          })
          .catch(() => {})
      )
      .catch(() => {})
  }

  async function bulkDeleteMessagesFrom(user, channel, length, options) {
    let count = 0
    let temp = null

    do {
      try {
        temp = await channel.messages.fetch({
          limit: 100
        })
        if (temp.size === 0) break
        temp = temp.filter(
          s => s.author.id === user && (options && options.filter ? s.id !== options.filter : true)
        )
        temp = Array.from(temp.keys()).slice(0, length - count)
        await channel.bulkDelete(temp).catch(() => {})
        count += temp.length
      } catch (err) {
        $.warn(err)
        break
      }
    } while (count !== length && temp.length !== 0)

    return count
  }
}

Administration.prototype.kick = function(args) {
  const message = this.message

  if (!message.member.hasPermission('KICK_MEMBERS')) {
    return message.channel.send($.embed('Insufficient Permission.'))
  }

  var user = message.guild.member(message.mentions.users.first() || message.guild.members.get(args[0]))

  if (!user) return message.channel.send($.embed('User not found.'))

  message.guild.member(user).kick()

  message.channel.send(
    $.embed()
      .setDescription('🚫 Kick')
      .setThumbnail(user.displayAvatarURL())
      .addField('Kicked User', `${user} with ID ${user.id}`)
      .addField('Kicked By', `${message.author.toString()} with ID ${message.author.id}`)
      .addField('Kicked In', message.channel)
      .addField('Time', message.createdAt)
  )
}

Administration.prototype.prefix = async function(args) {
  const message = this.message
  const server = this.server

  if (!$.isOwner(message.member.id) || !message.member.hasPermission('MANAGE_GUILD')) {
    return message.channel.send($.embed("You don't have a permission to set prefix."))
  }
  if (!args[0]) {
    return message.channel.send($.embed(`Usage: ${server.config.prefix}prefix <desired prefix here>`))
  }

  server.config = await $.updateServerConfig(message.guild.id, {
    prefix: args[0]
  })

  message.channel.send($.embed(`Set to ${args[0]}`).setTitle('Prefix Set!'))
}

Administration.prototype.setnickname = function(args) {
  const message = this.message

  var member = message.guild.member(message.mentions.users.first()) || message.guild.member(message.author)
  if (member.user.id !== message.author.id && !message.member.hasPermission('MANAGE_NICKNAMES')) {
    return message.channel.send(
      $.embed("You don't have a permission to change the nickname of other members.")
    )
  }
  var name = message.mentions.users.first() ? args.slice(1).join(' ') : args.join(' ')

  member
    .setNickname(name)
    .then(() => {
      message.channel.send(
        $.embed(`${member.toString()}, Your nickname has been set to ${name || 'default'}.`)
      )
      this.log(`${member.user.tag}'s nickname has been set to ${name || 'default'}`)
    })
    .catch(err => {
      $.warn(err)
      if (err.message.indexOf('Privilege is too low') > -1) {
        message.channel.send($.embed("You don't have a permission to set nickname."))
      } else {
        message.channel.send($.embed('There was an error changing the nickname.'))
      }
    })
}

Administration.prototype.setname = function(args) {
  const message = this.message

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set name."))
  }
  if (args.join(' ').length > 32 || args.join(' ').length < 3) {
    return message.channel.send($.embed('Username must be greater than 2 and less than 32'))
  }

  bot.user
    .setUsername(args.join(' '))
    .then(() => {
      message.channel.send($.embed(`Username set to ${args.join(' ')}.`))
      this.log(`Username set to ${args.join(' ')}`)
    })
    .catch(err => {
      $.warn(err)
      message.channel.send($.embed('There was an error changing the username.'))
    })
}

Administration.prototype.setstatus = function(args) {
  const message = this.message

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set status."))
  }
  if (
    !(
      args[0].toLowerCase() === 'online' ||
      args[0].toLowerCase() === 'offline' ||
      args[0].toLowerCase() === 'dnd' ||
      args[0].toLowerCase() === 'idle'
    )
  ) {
    return message.channel.send(
      $.embed('Invalid Parameters. Not a valid status. (online | dnd | idle | offline)')
    )
  }

  bot.user
    .setPresence({
      status: args[0].toLowerCase()
    })
    .then(async () => {
      await $.updateConfig({
        status: args[0].toLowerCase()
      })
      message.channel.send($.embed(`Bot Status set to ${args[0]}`))
      this.log(`Bot Status set to ${args[0]}`)
    })
    .catch(err => {
      $.warn(err)
      message.channel.send($.embed('There was an error changing the status.'))
    })
}

Administration.prototype.setgame = function(args) {
  const message = this.message

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set game."))
  }
  if (
    !(
      args[0].toUpperCase() === 'PLAYING' ||
      args[0].toUpperCase() === 'LISTENING' ||
      args[0].toUpperCase() === 'WATCHING'
    )
  ) {
    return message.channel.send(
      $.embed('Invalid Parameters. Not a valid game type. (PLAYING, WATCHING, LISTENING)')
    )
  }

  bot.user
    .setActivity(args.slice(1).join(' '), {
      type: args[0].toUpperCase()
    })
    .then(async () => {
      await $.updateConfig({
        'game.type': args[0].toUpperCase(),
        'game.name': args.slice(1).join(' ')
      })
      message.channel.send($.embed(`Game set to ${args[0]}, ${args.slice(1).join(' ')}.`))
      this.log(`Game set to ${args.slice(1).join(' ')}`)
    })
    .catch(err => {
      $.warn(err)
      message.channel.send($.embed('There was an error setting the game.'))
    })
}

Administration.prototype.setavatar = function(args) {
  var message = this.message

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set avatar."))
  }
  if (!args[0].match(/[-a-zA-Z0-9@:%_+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_+.~#?&//=]*)?/gi)) {
    return message.channel.send($.embed('Invalid URL.'))
  }

  bot.user
    .setAvatar(args[0])
    .then(() => {
      this.log('Avatar changed.')
      message.channel.send(
        $.embed()
          .setTitle('Avatar changed to')
          .setImage(args[0])
      )
    })
    .catch(err => {
      $.warn(err)
      message.channel.send($.embed('There was an error changing the avatar.'))
    })
}

Administration.prototype.alias = async function(args) {
  const message = this.message
  const server = this.server

  var alias = server.config.aliases.filter(x => x.name === args[0])[0]

  if (args[1].startsWith(server.config.prefix)) {
    args[1].replace(server.config.prefix, '{0}')
  } else {
    return message.channel.send($.embed(`Invalid command. It must starts with \`${server.config.prefix}\``))
  }

  if (alias) {
    if (!$.isOwner(message.author.id) && alias.owner !== message.author.id) {
      return message.channel.send($.embed('You cannot edit this alias.'))
    }
    alias.cmd = args.slice(1).join(' ')
    server.config = await $.editAlias(message.guild.id, alias)
  } else {
    server.config = await $.addAlias(message.guild.id, message.author.id, args)
  }

  message.channel.send(
    $.embed(`Message with exactly \`${args[0]}\` will now execute \`${args.slice(1).join(' ')}\``)
  )
}

Administration.prototype.removealias = async function(args) {
  const message = this.message
  const server = this.server

  var alias = server.config.aliases.filter(x => x.name === args[0])[0]
  if (alias) {
    if (!$.isOwner(message.author.id) && alias.owner !== message.author.id) {
      return message.channel.send($.embed('You cannot delete this alias.'))
    }
    server.config = await $.deleteAlias(message.guild.id, alias.name)
    message.channel.send($.embed(`Alias \`${alias.name}\` deleted.`))
  } else {
    message.channel.send($.embed(`Alias not found.`))
  }
}

Administration.prototype.aliaslist = function() {
  const message = this.message
  const server = this.server
  const aliases = server.config.aliases

  if (aliases.length !== 0) {
    var embeds = []
    var temp = []

    for (var i = 0; i < aliases.length; i++) {
      var alias = aliases[i]
      temp.push(
        `\`${i + 1}\`. \`${alias.name}\` \`(${bot.users.get(alias.owner).tag})\`: \`${alias.cmd.replace(
          '{0}',
          server.config.prefix
        )}\``
      )
      if ((i !== 0 && (i + 1) % 10 === 0) || i === aliases.length - 1) {
        embeds.push($.embed().setDescription(temp.join('\n\n')))
        temp = []
      }
    }
    if (Math.ceil(aliases.length / 10) === 1 && embeds[0]) {
      message.channel.send(embeds[0].setTitle('📘 Alias List'))
    } else {
      new EmbedsMode()
        .setArray(embeds)
        .setAuthorizedUser(message.author)
        .setChannel(message.channel)
        .setTitle('📘 Alias List')
        .setColor('#59ABE3')
        .build()
    }
  } else {
    message.channel.send($.embed('Empty Alias List.'))
  }
}

Administration.prototype.strictmode = async function(args) {
  const message = this.message
  const server = this.server

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set delete on cmd."))
  }
  if (!args[0] || (args[0] !== 'enable' && args[0] !== 'disable')) {
    return message.channel.send(
      $.embed(`Strict Mode is ${server.config.strictmode ? 'enabled' : 'disabled'} (enable | disable).`)
    )
  }

  server.config = await $.updateServerConfig(message.guild.id, {
    strictmode: args[0] === 'enable'
  })
  message.channel.send(
    $.embed(
      'Strict Mode is now ' +
        (server.config.strictmode ? 'enabled' : 'disabled') +
        '. The user must have at least one role to command me.'
    )
  )
}

Administration.prototype.deleteoncmd = async function(args) {
  const message = this.message
  const server = this.server

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set delete on cmd."))
  }
  if (!args[0] || (args[0] !== 'enable' && args[0] !== 'disable')) {
    return message.channel.send(
      $.embed(`Delete On Cmd is ${server.config.deleteoncmd ? 'enabled' : 'disabled'} (enable | disable).`)
    )
  }

  server.config = await $.updateServerConfig(message.guild.id, {
    deleteoncmd: args[0] === 'enable'
  })
  message.channel.send(
    $.embed('Delete On Cmd is now ' + (server.config.deleteoncmd ? 'enabled' : 'disabled') + '.')
  )
}

Administration.prototype.vcrole = async function(args) {
  const message = this.message
  const server = this.server

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set voice channel role."))
  }
  if (args[0] && !message.guild.roles.exists('name', args[0])) {
    return message.channel.send($.embed('Invalid Role Name.'))
  }
  if (!message.member.voiceChannel) {
    return message.channel.send($.embed('You must be in a voice channel.'))
  }

  server.config = await $.updateServerConfig(message.guild.id, {
    ['music.roles.' + message.member.voiceChannel.id]: args[0]
      ? message.guild.roles.find('name', args[0]).id
      : null
  })
  if (args[0]) {
    message.channel.send(
      $.embed(`Connecting to ${message.member.voiceChannel.name} will have a role ${args[0]}.`)
    )
  } else {
    message.channel.send($.embed(`Voice channel role has been removed.`))
  }
}

Administration.prototype.voicetts = async function(args) {
  const message = this.message
  const server = this.server

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set voice tts channel."))
  }
  if (!args[0] || (args[0] !== 'enable' && args[0] !== 'disable')) {
    return message.channel.send(
      $.embed(
        `Voice TTS Channel is ${server.config.channel.voicetts ? 'enabled' : 'disabled'} (enable | disable).`
      )
    )
  }

  server.config = await $.updateServerConfig(message.guild.id, {
    'channel.voicetts': args[0] === 'enable' ? message.channel.id : null
  })
  message.channel.send(
    $.embed(`Voice TTS Channel is now ${args[0] !== 'enable' ? 'disabled' : 'changed to this channel'}.`)
  )
}

Administration.prototype.logchannel = async function(args) {
  const message = this.message
  const server = this.server

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set log channel."))
  }
  if (!args[0] || (args[0] !== 'enable' && args[0] !== 'disable')) {
    return message.channel.send(
      $.embed(`Log Channel is ${server.config.channel.log ? 'enabled' : 'disabled'} (enable | disable).`)
    )
  }

  server.config = await $.updateServerConfig(message.guild.id, {
    'channel.log': args[0] === 'enable' ? message.channel.id : null
  })
  message.channel.send(
    $.embed(`Log Channel is now ${args[0] !== 'enable' ? 'disabled' : 'changed to this channel'}.`)
  )
}

Administration.prototype.logmsgdelete = async function(args) {
  const message = this.message
  const server = this.server

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set message deleted channel."))
  }
  if (!args[0] || (args[0] !== 'enable' && args[0] !== 'disable')) {
    return message.channel.send(
      $.embed(
        `Message Deleted Channel is ${
          server.config.channel.msgdelete ? 'enabled' : 'disabled'
        } (enable | disable).`
      )
    )
  }

  server.config = await $.updateServerConfig(message.guild.id, {
    'channel.msgdelete': args[0] === 'enable' ? message.channel.id : null
  })
  message.channel.send(
    $.embed(
      `Message Deleted Channel is now ${args[0] !== 'enable' ? 'disabled' : 'changed to this channel'}.`
    )
  )
}

Administration.prototype.debug = async function(args) {
  const message = this.message
  const server = this.server

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to set debug channel."))
  }
  if (!args[0] || (args[0] !== 'enable' && args[0] !== 'disable')) {
    return message.channel.send(
      $.embed(`Debug Channel is ${server.config.channel.debug ? 'enabled' : 'disabled'} (enable | disable).`)
    )
  }

  server.config = await $.updateServerConfig(message.guild.id, {
    'channel.debug': args[0] === 'enable' ? message.channel.id : null
  })
  message.channel.send(
    $.embed(`Debug Channel is now ${args[0] !== 'enable' ? 'disabled' : 'changed to this channel'}.`)
  )
}

Administration.prototype.restart = function() {
  var message = this.message

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to restart the bot."))
  }
  process.exit(0)
}

Administration.prototype.reload = function() {
  var message = this.message

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to reload the modules of the bot."))
  }
  message.channel.send($.embed('Reloading all modules...')).then(async m => {
    var time = new Date()
    await bot.loadModules(true)
    m.edit($.embed(`Reloaded all modules in ${((Date.now() - time) / 1000).toFixed(2)} secs.`))
      .then(n =>
        n.delete({
          timeout: 5000
        })
      )
      .catch(() => {})
  })
}

Administration.prototype.update = function() {
  var message = this.message

  if (!$.isOwner(message.member.id)) {
    return message.channel.send($.embed("You don't have a permission to update the bot."))
  }
  var embed = $.embed()
    .setFooter(bot.user.tag, bot.user.displayAvatarURL())
    .setAuthor('GitLab Update', 'https://i.gifer.com/DgvQ.gif')

  exec(`${bot.env.GIT_PATH}git remote show origin`, async (err, stdout, stderr) => {
    if (err) return $.warn(err)
    if (stdout.indexOf('out of date') === -1) {
      message.channel.send(
        $.embed()
          .setFooter(bot.user.tag, bot.user.displayAvatarURL())
          .setAuthor('GitLab Update', 'https://i.gifer.com/DgvQ.gif')
          .setDescription('Already up to date.')
      )
    } else {
      var msg = await message.channel.send(
        embed.setDescription('There is an update available. Update? (y | n)')
      )
      message.channel
        .awaitMessages(
          m =>
            (m.content.toLowerCase() === 'y' || m.content.toLowerCase() === 'n') &&
            m.author.id === message.author.id,
          {
            max: 1,
            time: 15000,
            errors: ['time']
          }
        )
        .then(async m => {
          var ans = m.first().content.toLowerCase()
          m.first()
            .delete()
            .catch(() => {})
          if (ans === 'n') throw new Error('no')
          await msg.edit(embed.setDescription('Updating...')).catch(() => {})

          exec(`${bot.env.GIT_PATH}git pull`, async (err, stdout, stderr) => {
            if (err) return $.warn(err)
            await execute(`export PATH=$PATH:${bot.env.NODE_PATH} && npm i`)
            await msg.edit(embed.setDescription('Would you like to restart the bot? (y | n)')).catch(() => {})
            message.channel
              .awaitMessages(
                m =>
                  (m.content.toLowerCase() === 'y' || m.content.toLowerCase() === 'n') &&
                  m.author.id === message.author.id,
                {
                  max: 1,
                  time: 15000,
                  errors: ['time']
                }
              )
              .then(async m => {
                ans = m.first().content.toLowerCase()
                m.first()
                  .delete()
                  .catch(() => {})
                if (ans === 'n') throw new Error('no')
                await msg.edit(embed.setDescription('Restarting the bot...')).catch(() => {})
                fs.writeFile('updateid.txt', `${message.channel.id}\n${msg.id}`, function() {
                  process.exit(2)
                })
              })
              .catch(async err => {
                await msg.delete().catch(() => {})
                if (err === 'no') {
                  message.channel.send($.embed('Okay.')).then(m =>
                    m.delete({
                      timeout: 3000
                    })
                  )
                }
              })
          })

          function execute(str) {
            return new Promise((resolve, reject) => {
              exec(str, (err, stdout, stderr) => {
                if (err) return $.warn(err)
                resolve()
              })
            })
          }
        })
        .catch(() => {
          msg.delete().catch(() => {})
        })
    }
  })
}

module.exports = Administration
