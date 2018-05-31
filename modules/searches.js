const bot = require('../bot')
const $ = require('../assets/functions')
const config = $.getConfig()
const moment = require('moment')
const emojiFlags = require('emoji-flags')
const cheerio = require('cheerio')
const owjs = require('overwatch-js');
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
      message.channel.send($.embed()
        .setAuthor(`Google Images for ${args.join(" ")}`, "http://i.imgur.com/G46fm8J.png")
        .setImage(images[0].url.split('?')[0])
      )
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

  var json = await $.fetchJSON(`http://api.openweathermap.org/data/2.5/weather?q=${args.join(" ")}&units=metric&appid=a88701020436549755f42d7e4be71762`)

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

Searches.prototype.randomjoke = async function(args) {
  var message = this.message

  var name = message.mentions.users.first() ? message.mentions.users.first().username : (args[0] || "Chuck Norris")

  var json = await $.fetchJSON(`http://api.icndb.com/jokes/random?escape=javascript`)

  var msg = json.value.joke.replace("Chuck Norris", name).replace(`${name}' `, name[name.length - 1] != "s" ? `${name}'s ` : undefined)

  message.channel.send($.embed(msg))
}

Searches.prototype.lol = async function(args) {
  var message = this.message

  if (args[0] == "summoner") {
    var msg = await message.channel.send($.embed("Searching..."))
    var name = args.slice(1).join(" ")
    var c = cheerio.load(await $.fetchHTML(`http://ph.op.gg/summoner/userName=${name}`))
    msg.delete().catch(() => {})

    var mostPlayed = []
    c(".MostChampionContent").find(".ChampionName").each(function() {
      mostPlayed.push(c(this).attr("title"))
    })
    var recentlyPlayed = []
    c("table.SummonersMostGameTable").find(".SummonerName>a").each(function() {
      recentlyPlayed.push(c(this).html())
    })

    var data = {
      icon: `http:${c(".ProfileIcon>img.ProfileImage").attr("src")}`,
      name: c(".Profile>.Information>.Name").html(),
      rank: {
        title: c(".TierRankInfo>.TierRank>.tierRank").html(),
        icon: `http:${c(".Medal>img.Image").attr("src")}`,
        info: {
          points: c(".TierRankInfo>.TierInfo>.LeaguePoints").html(),
          win: c(".TierRankInfo>.TierInfo>.WinLose>.wins").html(),
          lose: c(".TierRankInfo>.TierInfo>.WinLose>.losses").html(),
          ratio: c(".TierRankInfo>.TierInfo>.WinLose>.winratio").html()
        }
      },
      mostPlayed: mostPlayed,
      recentlyPlayed: recentlyPlayed
    }

    if (data.name) {
      var msg = $.embed()
        .setAuthor(data.name, data.icon)
        .setFooter("Powered by op.gg", "http://opgg-static.akamaized.net/images/logo/logo-lol.png")
        .setThumbnail(data.rank.icon)
        .addField("Rank", data.rank.title)

      if (data.rank.title != "Unranked")
        msg.addField("Points", data.rank.info.points)
        .addField("Stats", `${data.rank.info.win} / ${data.rank.info.lose} (${data.rank.info.ratio})`)

      if (data.mostPlayed.length > 0)
        msg.addField("Most Played Champions (Ranked)", data.mostPlayed.join(", "))

      if (data.recentlyPlayed.length > 0)
        msg.addField("Recently Played with", data.recentlyPlayed.join(", "))

      message.channel.send(msg)
    } else {
      message.channel.send($.embed("Summoner name not found."))
    }
  }
}

Searches.prototype.overwatch = async function(args) {
  var message = this.message

  if (!args[0] || args[0].indexOf("#") == -1) return message.channel.send($.embed("Please specify a name with tag"))
  try {
    var msg = await message.channel.send($.embed("Searching..."))

    var user = await owjs.search(args[0])
    var data = await owjs.getAll("pc", "career", user[0].urlName)
    var main = data.competitive.global.masteringHeroe
    var timePlayed = data.quickplay.global.time_played / 1000 / 3600

    msg.delete().catch(() => {})
    message.channel.send($.embed()
      .setAuthor(user[0].name, data.profile.avatar, data.profile.url)
      .setThumbnail(data.profile.rankPicture)
      .setFooter("Powered by Overwatch", "https://cdn.iconscout.com/public/images/icon/free/png-512/overwatch-logo-353d59a7a9b81227-512x512.png")
      .addField("Level", data.profile.level)
      .addField("Tier", data.profile.tier)
      .addField("Rank", `${data.profile.level} (${data.profile.rank})`)
      .addField("Main Hero", `${main.toUpperCase()} W: ${data.competitive.heroes[main].games_won} L: ${data.competitive.heroes[main].games_lost} (${data.competitive.heroes[main].win_percentage}%)`)
      .addField("Medals", data.competitive.global.medals)
      .addField("Time Played", `${timePlayed} ${timePlayed == 1 ? "hour" : "hours"}`)
    )
  } catch () {
    message.channel.send($.embed("Player not found."))
  }
}

module.exports = Searches