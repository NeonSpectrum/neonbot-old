var fs = require('fs')
var Discord = require('discord.js')
var moment = require('moment');
var colors = require('colors/safe');
var config = require("../config.json")

module.exports.log = (message) => {
  console.log(colors.yellow(moment().format('YYYY-MM-DD hh:mm:ss A')) + " | " + colors.cyan(typeof message === 'object' ? JSON.stringify(message) : message));
}

module.exports.embed = (message) => {
  var e = new Discord.RichEmbed().setColor("#15f153")
  if (message !== undefined)
    e.setDescription(message)
  return e
}

module.exports.updateconfig = (message) => {
  fs.writeFile("./config.json", JSON.stringify(config, null, 2), (err) => {
    if (err) log(err)
  })
}

module.exports.isOwner = (id) => {
  return id == config.ownerid
}

module.exports.isInArray = (arr, value) => {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] == value) return true
  }
  return false
}

module.exports.addIfNotExists = (arr, value) => {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] == value) return arr
  }
  arr.push(value)
  return arr
}