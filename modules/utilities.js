var Discord = require("discord.js")
var errors = require("../handler/errors.js")
var config = require('../config.json')
var help = require("../help.json")

module.exports = (bot, message) => {
  return {
    help: (args) => {
      if (help[args]) {
        message.reply(help[args].replace("{0}", config.prefix))
      } else {
        message.reply("Cannot find command")
      }
    },
    ping: () => {
      message.reply('Pong! Your ping is `' + `${Date.now() - message.createdTimestamp}` + ' ms`');
    }
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

      message.channel.send(`Congrats to <@${rMember.id}>, they have been given the role ${gRole.name}. We tried to DM them, but their DMs are locked.`)
    },
    ban: (args) => {
      message.delete()
      if (!message.member.hasPermission("BAN_MEMBERS")) return errors.noPerms(message, "BAN_MEMBERS")

      var bUser = message.guild.member(message.mentions.users.first() || message.guild.members.get(args[0]))

      if (!bUser) return errors.cantfindUser(message.channel)

      if (bUser.id === bot.user.id) return errors.botuser(message)

      var bReason = args.join(" ")
        .slice(22)

      if (!bReason) return errors.noReason(message.channel)

      if (bUser.hasPermission("MANAGE_MESSAGES")) return errors.equalPerms(message, bUser, "MANAGE_MESSAGES")

      var banEmbed = new Discord.RichEmbed()
        .setDescription("~Ban~")
        .setColor("#bc0000")
        .addField("Banned User", `${bUser} with ID ${bUser.id}`)
        .addField("Banned By", `<@${message.author.id}> with ID ${message.author.id}`)
        .addField("Banned In", message.channel)
        .addField("Time", message.createdAt)
        .addField("Reason", bReason)

      message.guild.member(bUser)
        .ban(bReason)
      message.send(banEmbed)
    },
    botinfo: () => {
      var botembed = new Discord.RichEmbed()
        .setDescription("Bot Information")
        .setColor("#15f153")
        .setThumbnail(bot.user.displayAvatarURL)
        .addField("Bot Name", bot.user.username)
        .addField("Created On", bot.user.createdAt)

      message.channel.send(botembed)
    },
    clear: (args) => {
      if (!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES")

      if (!args[0]) return message.channel.send("oof")

      message.channel.bulkDelete(args[0])
        .then(() => {
          message.channel.send(`Cleared ${args[0]} messages.`)
            .then(msg => msg.delete(5000))
        })
    },
    kick: (args) => {
      if (!message.member.hasPermission("KICK_MEMBERS")) return errors.noPerms(message, "KICK_MEMBERS")

      var kUser = message.guild.member(message.mentions.users.first() || message.guild.members.get(args[0]))

      if (!kUser) return errors.cantfindUser(message.channel)

      var kReason = args.join(" ")
        .slice(22)

      if (kUser.hasPermission("MANAGE_MESSAGES")) return errors.equalPerms(message, kUser, "MANAGE_MESSAGES")

      var kickEmbed = new Discord.RichEmbed()
        .setDescription("~Kick~")
        .setColor("#e56b00")
        .addField("Kicked User", `${kUser} with ID ${kUser.id}`)
        .addField("Kicked By", `<@${message.author.id}> with ID ${message.author.id}`)
        .addField("Kicked In", message.channel)
        .addField("Tiime", message.createdAt)
        .addField("Reason", kReason)

      message.guild.member(kUser)
        .kick(kReason)
      message.send(kickEmbed)
    },
    prefix: (args) => {
      if (!message.member.hasPermission("MANAGE_SERVER")) return message.reply("No no no.")
      if (!args[0] || args[0] == "help") return message.reply(`Usage: ${config.prefix}prefix <desired prefix here>`)

      config.prefix = args[0]

      fs.writeFile("./config.json", JSON.stringify(config), (err) => {
        if (err) console.log(err)
      })

      var embed = new Discord.RichEmbed()
        .setColor("#FF9900")
        .setTitle("Prefix Set!")
        .setDescription(`Set to ${args[0]}`)

      message.channel.send(embed)
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

      message.channel.send(`<@${rMember.id}>, We removed ${gRole.name} from them.`)
    },
    say: (args) => {
      if (!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES")
      message.delete()
        .catch(console.error)
      var botmessage = args.join(" ")
      message.channel.send(botmessage)
    },
    serverinfo: () => {
      var sicon = message.guild.iconURL
      var serverembed = new Discord.RichEmbed()
        .setDescription("Server Information")
        .setColor("#15f153")
        .setThumbnail(sicon)
        .addField("Server Name", message.guild.name)
        .addField("Created On", message.guild.createdAt)
        .addField("You Joined", message.member.joinedAt)
        .addField("Total Members", message.guild.memberCount)

      message.channel.send(serverembed)
    }
  }
}