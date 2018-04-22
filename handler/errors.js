var Discord = require("discord.js")
var config = require("../config.json")

module.exports.noPerms = (message, perm) => {
  var embed = new Discord.RichEmbed()
    .setAuthor(message.author.username)
    .setTitle("Insufficient Permission")
    .setColor("#FF0000")
    .addField("Permission needed", perm)

  message.channel.send(embed)
    .then(m => m.delete(5000))
}

module.exports.equalPerms = (message, user, perms) => {

  var embed = new Discord.RichEmbed()
    .setAuthor(message.author.username)
    .setColor("#FF0000")
    .setTitle("Error")
    .addField(`${user} has perms`, perms)

  message.channel.send(embed)
    .then(m => m.delete(5000))
}

module.exports.botuser = (message) => {
  var embed = new Discord.RichEmbed()
    .setTitle("Error")
    .setDescription("You cannot ban a bot.")
    .setColor("#FF0000")

  message.channel.send(embed)
    .then(m => m.delete(5000))
}

module.exports.cantfindUser = (channel) => {
  var embed = new Discord.RichEmbed()
    .setTitle("Error")
    .setDescription("Could not find that user.")
    .setColor("#FF0000")

  channel.send(embed)
    .then(m => m.delete(5000))
}

module.exports.noReason = (channel) => {
  var embed = new Discord.RichEmbed()
    .setTitle("Error")
    .setDescription("Please supply a reason.")
    .setColor("#FF0000")

  channel.send(embed)
    .then(m => m.delete(5000))
}