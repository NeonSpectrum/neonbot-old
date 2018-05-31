const bot = require('../bot')
const $ = require('../assets/functions')
const config = $.getConfig()
const moment = require('moment')
const fetch = require('node-fetch')
const emojiFlags = require('emoji-flags')
const GoogleSearch = require('google-search')
const googleSearch = new GoogleSearch({
  key: process.env.GOOGLE_API,
  cx: '010420937032738550228:8287l8l_wec'
})
const GoogleImages = require('google-images')
const googleImages = new GoogleImages('010420937032738550228:8287l8l_wec', process.env.GOOGLE_API)
const ud = require('urban-dictionary')

class Searches {
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

Searches.prototype.google = async function(args) {
  var message = this.message
  var msg = await message.channel.send($.embed("Searching..."))

  googleSearch.build({
    q: args.join(" "),
    num: 5
  }, function(err, res) {
    var items = res.items
    var temp = []
    for (var i = 0; i < items.length; i++) {
      temp.push(`[**${items[i].title}**](${items[i].link})\n${items[i].snippet.replace(/<\/?[^>]+(>|$)/g, "")}\n`)
    }
    msg.delete().catch(() => {})
    message.channel.send($.embed()
      .setAuthor(`Google Search for ${args.join(" ")}`, "http://i.imgur.com/G46fm8J.png")
      .setDescription(temp.join("\n"))
      .setFooter(`Searched by ${message.author.tag}`, message.author.displayAvatarURL())
    )
  });
}

Searches.prototype.image = function(args) {
  var message = this.message

  googleImages.search(args.join(" "))
    .then(images => {
      message.channel.send({
        files: [images[0].url.split('?')[0]]
      })
    });
}

Searches.prototype.ud = function(args) {
  var message = this.message

  ud.term(args.join(" "), function(error, entries, tags, sounds) {
    message.channel.send($.embed()
      .setAuthor(`Urban Dictionary for ${args.join(" ")}`, "https://lh5.ggpht.com/oJ67p2f1o35dzQQ9fVMdGRtA7jKQdxUFSQ7vYstyqTp-Xh-H5BAN4T5_abmev3kz55GH%3Dw300")
      .setDescription(`[**${entries[0].word}**](${entries[0].permalink})`)
      .addField("**Definition:**", entries[0].definition)
      .addField("**Example:**", entries[0].example)
      .setFooter(`Searched by ${message.author.tag}`, message.author.displayAvatarURL())
    )
  })
}

Searches.prototype.weather = async function(args) {
  var message = this.message

  if (!args[0]) return message.channel.send($.embed("Please specify a city."))

  var response = await fetch(`http://api.openweathermap.org/data/2.5/weather?q=${args.join(" ")}&units=metric&appid=a88701020436549755f42d7e4be71762`)
  var json = await response.json()

  if (json.cod != 200) return message.channel.send($.embed("City not found."))
  message.channel.send($.embed()
    .setTitle(`${emojiFlags.countryCode(json.sys.country).emoji} ${json.sys.country} - ${json.name}`)
    .setURL(`https://openweathermap.org/city/${json.id}`)
    .setFooter("Powered by OpenWeatherMap", "https://media.dragstone.com/content/icon-openweathermap-1.png")
    .setThumbnail(`http://openweathermap.org/img/w/${json.weather[0].icon}.png`)
    .addField("☁ Weather", `${json.weather[0].main} - ${json.weather[0].description}`)
    .addField("🌡 Temperature", `Minimum Temperature: ${json.main.temp_min}°C\nMaximum Temperature: ${json.main.temp_max}°C\nTemperature: ${json.main.temp}°C`)
    .addField("💨 Wind", `Speed: ${json.wind.speed} m/s\nDegrees: ${json.wind.deg}°`)
    .addField("🌤 Sunrise", moment(new Date(json.sys.sunrise * 1000)).format("MMM D, YYYY h:mm:ss A"))
    .addField("🌥 Sunset", moment(new Date(json.sys.sunset * 1000)).format("MMM D, YYYY h:mm:ss A"))
    .addField("🔘 Coordinates", `Longitude: ${json.coord.lon}\nLatitude: ${json.coord.lat}`)
    .addField("🎛 Pressure", `${json.main.pressure} hpa`)
    .addField("💧 Humidity", `${json.main.humidity}%`)
  )
}

module.exports = Searches