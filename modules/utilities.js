var Discord = require("discord.js")
var errors = require("../handler/errors.js")
var config = require('../config.json')
var help = require("../help.json")
var $ = require('../handler/functions')
var embed = $.embed
var log = $.log

module.exports = (bot, message) => {
  return {
    help: (args) => {
      if (help[args]) {
        message.reply(help[args[0]].replace("{0}", config.prefix))
      } else {
        message.reply("Cannot find command")
      }
    },
    speak: (args) => {
      if (!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES")
        .catch(console.error)
      message.channel.send(args.join(" "), {
        tts: true
      })
    },
    ping: () => {
      message.channel.send(embed()
        .setDescription("Pong!")
        .addField("Your ping is", Date.now() - message.createdTimestamp + " ms")
      )
    },
    botinfo: () => {
      message.channel.send(embed()
        .setDescription("Bot Information")
        .setThumbnail(bot.user.displayAvatarURL)
        .addField("Bot Name", bot.user.username)
        .addField("Created On", bot.user.createdAt)
      )
    },
    say: (args) => {
      if (!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES")
        .catch(console.error)
      message.channel.send(args.join(" "))
    },
    serverinfo: () => {
      message.channel.send(embed()
        .setDescription("Server Information")
        .setThumbnail(message.guild.iconURL)
        .addField("Server Name", message.guild.name)
        .addField("Created On", message.guild.createdAt)
        .addField("You Joined", message.member.joinedAt)
        .addField("Total Members", message.guild.memberCount)
      )
    }
  }
}