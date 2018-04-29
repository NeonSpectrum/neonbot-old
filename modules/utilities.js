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
    stats: () => {
      message.channel.send(embed()
        .setThumbnail(bot.user.displayAvatarURL)
        .addField("Bot Name", bot.user.tag)
        .addField("Created On", bot.user.createdAt)
        .addField("Created By", bot.users.get("260397381856526337").tag)
        .addField("Server Count", Array.from(bot.guilds.keys()).length)
        .addField("Ram Usage", `Approximately ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`)
        .addField("Uptime", $.formatSeconds(Math.floor(process.uptime())))
      )
    },
    say: (args) => {
      if (!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES")
        .catch(console.error)
      message.channel.send(args.join(" "))
    },
    serverinfo: () => {
      message.channel.send(embed()
        .setThumbnail(message.guild.iconURL)
        .addField("Server Name", message.guild.name)
        .addField("Created On", message.guild.createdAt)
        .addField("You Joined", message.member.joinedAt)
        .addField("Total Members", message.guild.memberCount)
      )
    }
  }
}