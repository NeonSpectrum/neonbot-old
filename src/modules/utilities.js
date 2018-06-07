const bot = require('../bot')
const reload = require('require-reload')(require)
const help = reload("../assets/help")
const $ = require('../assets/functions')

class Utilities {
  constructor(message) {
    if (typeof message == "object") {
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

Utilities.prototype.help = function(args) {
  var message = this.message,
    server = this.server

  if (help[args[0]]) {
    message.channel.send($.embed().addField(`${args[0]} - ${help[args[0]].info}`, `\`Usage:\` \`${help[args[0]].usage.replace(/\{0\}/g, server.config.prefix)}\``))
  } else {
    message.channel.send($.embed("Cannot find command"))
  }
}

Utilities.prototype.cmds = function(args) {
  var message = this.message,
    server = this.server

  if (!bot.modules[args[0]]) return message.channel.send($.embed(`Invalid Module. (${Object.keys(bot.modules).join(" | ")})`))

  var command = bot.modules[args[0]],
    modules
  switch (args[0].toLowerCase()) {
    case 'admin':
      modules = "Administration"
      break
    case 'music':
      modules = "Music"
      break
    case "util":
      modules = "Utilities"
      break
    case "search":
      modules = "Searches"
      break
    case "games":
      modules = "Games"
      break
  }
  var temp = $.embed().setTitle("📘 Command list for " + modules)
  for (var i = 0; i < command.length; i++) {
    temp.addField(`${command[i]} - ${help[command[i]] && help[command[i]].info || "N/A"}`, `\`Usage:\` \`${help[command[i]] && help[command[i]].usage.replace(/\{0\}/g, server.config.prefix) || "N/A"}\``)
  }
  message.channel.send(temp)
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
    .setThumbnail(bot.user.displayAvatarURL())
    .addField("Bot Name", bot.user.tag)
    .addField("Version", reload("../package.json").version)
    .addField("Created On", bot.user.createdAt)
    .addField("Created By", "NeonSpectrum")
    .addField("Server Count", Array.from(bot.guilds.keys()).length)
    .addField("Ram Usage", `Approximately ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`)
    .addField("Uptime", $.formatSeconds(Math.floor(bot.uptime / 1000)))
  )
}

Utilities.prototype.say = function(args) {
  var message = this.message

  message.channel.send(args.join(" "))
}

Utilities.prototype.speak = function(args) {
  var message = this.message

  message.channel.send(args.join(" "), {
    tts: true
  })
}

Utilities.prototype.serverinfo = function() {
  var message = this.message

  message.channel.send($.embed()
    .setThumbnail(message.guild.iconURL())
    .addField("Server Name", message.guild.name)
    .addField("Created On", message.guild.createdAt)
    .addField("You Joined", message.member.joinedAt)
    .addField("Total Channels", message.guild.channels.filter(s => s.type != "category").size)
    .addField("Total Members", message.guild.memberCount)
  )
}

module.exports = Utilities