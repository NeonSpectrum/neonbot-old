var Discord = require("discord.js")
var errors = require("../handler/errors.js")
var config = require('../config.json')
var $ = require('../handler/functions')
var embed = $.embed
var log = $.log

module.exports = (bot, message) => {
  return {
    addrole: (args) => {
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

      message.channel.send(embed()
        .setDescription("Role Added")
        .setField(`<@${rMember.id}>`, `they have been given the role ${gRole.name}`)
      )
    },
    ban: (args) => {
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

      message.send(embed()
        .setDescription("~Ban~")
        .addField("Banned User", `${bUser} with ID ${bUser.id}`)
        .addField("Banned By", `<@${message.author.id}> with ID ${message.author.id}`)
        .addField("Banned In", message.channel)
        .addField("Time", message.createdAt)
        .addField("Reason", bReason)
      )
    },
    clear: (args) => {
      if (args > 100) return message.reply("Parameters must not be greater than 100.f")
      if (!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES")
      if (!args[0]) args[0] = 1
      if (message.deletable) message.delete()

      message.channel.bulkDelete(args[0])
    },
    kick: (args) => {
      if (!message.member.hasPermission("KICK_MEMBERS")) return errors.noPerms(message, "KICK_MEMBERS")

      var kUser = message.guild.member(message.mentions.users.first() || message.guild.members.get(args[0]))

      if (!kUser) return errors.cantfindUser(message.channel)

      var kReason = args.join(" ").slice(22)

      if (kUser.hasPermission("MANAGE_MESSAGES")) return errors.equalPerms(message, kUser, "MANAGE_MESSAGES")

      message.guild.member(kUser).kick(kReason)

      message.channel.send(embed()
        .setDescription("~Kick~")
        .addField("Kicked User", `${kUser} with ID ${kUser.id}`)
        .addField("Kicked By", `<@${message.author.id}> with ID ${message.author.id}`)
        .addField("Kicked In", message.channel)
        .addField("Tiime", message.createdAt)
        .addField("Reason", kReason)
      )
    },
    prefix: (args) => {
      if (!message.member.hasPermission("MANAGE_SERVER")) return message.reply("No no no.")
      if (!args[0]) return message.reply(`Usage: ${config.prefix}prefix <desired prefix here>`)

      config.prefix = args[0]

      $.updateconfig()

      message.channel.send(embed(`Set to ${args[0]}`)
        .setTitle("Prefix Set!")
      )
    },
    removerole: (args) => {
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

      message.channel.send(embed()
        .setTitle("Removed Role")
        .setDescription(`<@${rMember.id}>, We removed ${gRole.name} from them.`)
      )
    },
    setgame: (args) => {
      if (!$.isOwner(message.member.id)) return
      if (!(args[0].toUpperCase() == "PLAYING" || args[0].toUpperCase() == "LISTENING" || args[0].toUpperCase() == "WATCHING"))
        return message.reply("Invalid Parameters. Not a valid game type. (PLAYING, WATCHING, LISTENING)")

      config.bot.game.type = args[0].toUpperCase()
      config.bot.game.name = args.slice(1).join(" ")

      $.updateconfig()
      bot.user.setActivity(args.slice(1).join(" "), {
        type: args[0].toUpperCase()
      })
    },
    setavatar: (args) => {
      if (!$.isOwner(message.member.id)) return
      if (!args[0].match(/[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi)) return message.reply("Invalid URL.")

      bot.user.setAvatar(args[0])
        .then(() => {
          $.log("Avatar changed.")
          message.channel.send(embed(args[0]).setTitle("Avatar changed to"))
        })
    }
  }
}