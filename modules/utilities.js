const bot = require('../bot')
const errors = require("../handler/errors.js")
const help = require("../help.json")
const $ = require('../handler/functions')
const config = $.getConfig()

class Utilities {
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

Utilities.prototype.help = function(args) {
  var message = this.message,
    server = this.server

  var ser
  if (help[args]) {
    message.reply(help[args[0]].replace("{0}", server.config.prefix))
  } else {
    message.reply("Cannot find command")
  }
}

Utilities.prototype.speak = function(args) {
  var message = this.message

  if (!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES")
    .catch(console.error)
  message.channel.send(args.join(" "), {
    tts: true
  })
}

Utilities.prototype.ping = function() {
  var message = this.message

  message.channel.send($.embed()
    .setDescription("Pong!")
    .addField("Your ping is", Date.now() - message.createdTimestamp + " ms")
  )
}

Utilities.prototype.stats = function() {
  var message = this.message

  message.channel.send($.embed()
    .setThumbnail(bot.user.displayAvatarURL)
    .addField("Bot Name", bot.user.tag)
    .addField("Created On", bot.user.createdAt)
    .addField("Created By", bot.users.get("260397381856526337").tag)
    .addField("Server Count", Array.from(bot.guilds.keys()).length)
    .addField("Ram Usage", `Approximately ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`)
    .addField("Uptime", $.formatSeconds(Math.floor(bot.uptime)))
  )
}

Utilities.prototype.say = function(args) {
  var message = this.message

  if (!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES")
    .catch(console.error)
  message.channel.send(args.join(" "))
}

Utilities.prototype.serverinfo = function() {
  var message = this.message

  message.channel.send($.embed()
    .setThumbnail(message.guild.iconURL)
    .addField("Server Name", message.guild.name)
    .addField("Created On", message.guild.createdAt)
    .addField("You Joined", message.member.joinedAt)
    .addField("Total Members", message.guild.memberCount)
  )
}

module.exports = Utilities