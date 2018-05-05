const fs = require('fs')
const bot = require("../bot")
const errors = require("../handler/errors.js")
const $ = require('../handler/functions')
const config = $.getConfig()

class Administration {
  constructor(message) {
    if (typeof message == "object") {
      var server = {
        config: $.getServerConfig(message.guild.id)
      }
      this.server = server
      this.message = message
    }
    this.log = (content) => {
      $.log(content, message)
    }
  }
}

Administration.prototype.addrole = function(args) {
  var message = this.message

  if (!message.member.hasPermission("MANAGE_ROLES")) return errors.noPerms(message, "MANAGE_ROLES")

  var rMember = message.guild.member(message.mentions.users.first()) || message.guild.members.get(args[0])

  if (!rMember) return errors.cantfindUser(message.channel)

  var role = args.join(" ")
    .slice(22)

  if (!role) return message.reply("Specify a role!")

  var gRole = message.guild.roles.find(`name`, role)

  if (!gRole) return message.reply("Couldn't find that role.")

  if (rMember.roles.has(gRole.id)) return message.reply("They already have that role.")

  await (rMember.addRole(gRole.id))

  message.channel.send($.embed()
    .setDescription("Role Added")
    .setField(`<@${rMember.id}>`, `they have been given the role ${gRole.name}`)
  )
}

Administration.prototype.ban = function(args) {
  var message = this.message

  if (!message.member.hasPermission("BAN_MEMBERS")) return errors.noPerms(message, "BAN_MEMBERS")

  var bUser = message.guild.member(message.mentions.users.first() || message.guild.members.get(args[0]))

  if (!bUser) return errors.cantfindUser(message.channel)

  if (bUser.id === bot.user.id) return errors.botuser(message)

  var bReason = args.join(" ")
    .slice(22)

  if (!bReason) return errors.noReason(message.channel)

  if (bUser.hasPermission("MANAGE_MESSAGES")) return errors.equalPerms(message, bUser, "MANAGE_MESSAGES")

  message.guild.member(bUser)
    .ban(bReason)

  message.send($.embed()
    .setDescription("~Ban~")
    .addField("Banned User", `${bUser} with ID ${bUser.id}`)
    .addField("Banned By", `<@${message.author.id}> with ID ${message.author.id}`)
    .addField("Banned In", message.channel)
    .addField("Time", message.createdAt)
    .addField("Reason", bReason)
  )
}

Administration.prototype.clear = async function(args) {
  var message = this.message,
    server = this.server

  if (!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES")
  if (!server.config.deleteoncmd) message.delete()
  if (message.mentions.users.first()) {
    if (!args[1] || !Number.isInteger(+args[1])) return message.reply(`Invalid Parameters ${server.config.prefix}clear <user> <1-100>`)
    else if (args[1] > 100 && args[1] < 1) return message.reply("Parameters must be `1-100`.")

    var msg = await message.channel.send($.embed(`Please wait while I'm deleting ${args[1]} ${message.mentions.users.first().username}'s ${args[0] == 1 ? "message" : "messages"}...`))
    await bulkDeleteMessagesFrom(message.mentions.users.first().id, message.channel, +args[1])
    msg.edit($.embed(`Done deleting ${message.mentions.users.first().username}'s ${args[0] == 1 ? "message" : "messages"}.`)).then(s => s.delete({
      timeout: 3000
    }))
  } else if (Number.isInteger(+args[0])) {
    if (args[0] > 100 && args[0] < 1) return message.reply("Parameters must be `1-100`.")
    if (args[0] == 1) {
      var arr = await message.channel.messages.fetch({
        limit: 1
      })
      arr.first().delete()
    } else {
      message.channel.bulkDelete(+args[0])
    }
  } else {
    var msg = await message.channel.send($.embed("Please wait while I'm deleting 10 bot messages..."))
    await bulkDeleteMessagesFrom(bot.user.id, message.channel, 10, {
      filter: msg.id
    })
    msg.edit($.embed("Done deleting bot messages.")).then(s => s.delete({
      timeout: 3000
    }))
  }

  async function bulkDeleteMessagesFrom(user, channel, length, options) {
    return new Promise(async (resolve, reject) => {
      var arr = [],
        count = 0
      do {
        var temp = await channel.messages.fetch({
          limit: 100
        })
        temp = temp.filter(s => s.author.id == user && (options && options.filter ? s.id != options.filter : true))
        temp = Array.from(temp.keys()).slice(0, length - count)
        await channel.bulkDelete(temp)
        count += temp.length
      } while (count != length)
      resolve(count)
    })
  }
}

Administration.prototype.kick = function(args) {
  var message = this.message

  if (!message.member.hasPermission("KICK_MEMBERS")) return errors.noPerms(message, "KICK_MEMBERS")

  var kUser = message.guild.member(message.mentions.users.first() || message.guild.members.get(args[0]))

  if (!kUser) return errors.cantfindUser(message.channel)

  var kReason = args.join(" ").slice(22)

  if (kUser.hasPermission("MANAGE_MESSAGES")) return errors.equalPerms(message, kUser, "MANAGE_MESSAGES")

  message.guild.member(kUser).kick(kReason)

  message.channel.send($.embed()
    .setDescription("~Kick~")
    .addField("Kicked User", `${kUser} with ID ${kUser.id}`)
    .addField("Kicked By", `<@${message.author.id}> with ID ${message.author.id}`)
    .addField("Kicked In", message.channel)
    .addField("Tiime", message.createdAt)
    .addField("Reason", kReason)
  )
}

Administration.prototype.prefix = async function(args) {
  var message = this.message,
    server = this.server

  if (!$.isOwner(message.member.id)) return message.reply("You don't have a permission to set prefix.")
  if (!args[0]) return message.reply(`Usage: ${config.prefix}prefix <desired prefix here>`)

  server.config = await $.updateServerConfig(message.guild.id, {
    prefix: args[0]
  })

  message.channel.send($.embed(`Set to ${args[0]}`)
    .setTitle("Prefix Set!")
  )
}

Administration.prototype.removerole = function(args) {
  var message = this.message

  if (!message.member.hasPermission("MANAGE_ROLES")) return errors.noPerms(message, "MANAGE_ROLES")

  var rMember = message.guild.member(message.mentions.users.first()) || message.guild.members.get(args[0])

  if (!rMember) return message.reply("Couldn't find that user, yo.")

  var role = args.join(" ")
    .slice(22)

  if (!role) return message.reply("Specify a role!")

  var gRole = message.guild.roles.find(`name`, role)

  if (!gRole) return message.reply("Couldn't find that role.")

  if (!rMember.roles.has(gRole.id)) return message.reply("They don't have that role.")

  await (rMember.removeRole(gRole.id))

  message.channel.send($.embed()
    .setTitle("Removed Role")
    .setDescription(`<@${rMember.id}>, We removed ${gRole.name} from them.`)
  )
}

Administration.prototype.setname = async function(args) {
  var message = this.message,
    server = this.server

  if (!$.isOwner(message.member.id)) return message.reply("You don't have a permission to set name.")
  if (args.join(" ").length > 32 || args.join(" ").length < 3) return message.reply("Username must be greater than 2 and less than 32")
  await bot.user.setUsername(args.slice(1).join(" "), {
    type: args[0].toUpperCase()
  })

  bot.user.setUsername(args.join(" "))
    .then(() => {
      message.channel.send($.embed(`Username set to ${args.join(" ")}.`))
      this.log(`Username set to ${args.join(" ")}`)
    })
}

Administration.prototype.setgame = function(args) {
  var message = this.message,
    server = this.server

  if (!$.isOwner(message.member.id)) return message.reply("You don't have a permission to set game.")
  if (!(args[0].toUpperCase() == "PLAYING" || args[0].toUpperCase() == "LISTENING" || args[0].toUpperCase() == "WATCHING"))
    return message.reply("Invalid Parameters. Not a valid game type. (PLAYING, WATCHING, LISTENING)")

  bot.user.setActivity(args.slice(1).join(" "), {
    type: args[0].toUpperCase()
  }).then(async () => {
    server.config = await $.updateConfig({
      "game.type": args[0].toUpperCase(),
      "game.name": args.slice(1).join(" ")
    })
    message.channel.send($.embed(`Game set to ${args[0]}, ${args.slice(1).join(" ")}.`))
    this.log(`Game set to ${args.slice(1).join(" ")}`)

  })
}

Administration.prototype.setavatar = function(args) {
  var message = this.message

  if (!$.isOwner(message.member.id)) return message.reply("You don't have a permission to set avatar.")
  if (!args[0].match(/[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi)) return message.reply("Invalid URL.")

  bot.user.setAvatar(args[0])
    .then(() => {
      this.log("Avatar changed.")
      message.channel.send($.embed(args[0]).setTitle("Avatar changed to"))
    })
}

Administration.prototype.deleteoncmd = async function() {
  var message = this.message,
    server = this.server

  if (!$.isOwner(message.member.id)) return message.reply("You don't have a permission to set delete on cmd.")
  if (args[0] != "enable" && args[0] != "disable") return message.reply("Invalid Parameters (enable | disable).")

  server.config = await $.updateServerConfig(message.guild.id, {
    deleteoncmd: args[0] == "enable" ? true : false
  })
  message.channel.send($.embed("Delete On Cmd is now " + (server.config.deleteoncmd ? "enabled" : "disabled") + "."))
}

Administration.prototype.voicetts = async function() {
  var message = this.message,
    server = this.server

  if (!$.isOwner(message.member.id)) return message.reply("You don't have a permission to set voice tts channel.")
  if (args[0] != "enable" && args[0] != "disable") return message.reply("Invalid Parameters (enable | disable).")

  server.config = await $.updateServerConfig(message.guild.id, {
    "channel.voicetts": args[0] == "enable" ? message.channel.id : null
  })
  message.channel.send($.embed(`Voice TTS Channel is now ${args[0] != "enable" ? "disabled" : "changed to this channel"}.`))
}

Administration.prototype.logchannel = async function(args) {
  var message = this.message,
    server = this.server

  if (!$.isOwner(message.member.id)) return message.reply("You don't have a permission to set log channel.")
  if (args[0] != "enable" && args[0] != "disable") return message.reply("Invalid Parameters (enable | disable).")

  server.config = await $.updateServerConfig(message.guild.id, {
    "channel.log": args[0] == "enable" ? message.channel.id : null
  })
  message.channel.send($.embed(`Log Channel is now ${args[0] != "enable" ? "disabled" : "changed to this channel"}.`))
}

Administration.prototype.debug = async function(args) {
  var message = this.message,
    server = this.server

  if (!$.isOwner(message.member.id)) return message.reply("You don't have a permission to set debug channel.")
  if (args[0] != "enable" && args[0] != "disable") return message.reply("Invalid Parameters (enable | disable).")

  server.config = await $.updateServerConfig(message.guild.id, {
    "channel.debug": args[0] == "enable" ? message.channel.id : null
  })
  message.channel.send($.embed(`Debug Channel is now ${args[0] != "enable" ? "disabled" : "changed to this channel"}.`))
}

module.exports = Administration