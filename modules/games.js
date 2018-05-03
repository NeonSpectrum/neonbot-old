const Discord = require('discord.js')
const bot = require('../bot')
const $ = require('../handler/functions')
const config = $.getConfig()
const pokemon = require('pokemon')
const jimp = require('jimp')

var servers = []

class Games {
  constructor(message) {
    if (typeof message === "object") {
      if (!servers[message.guild.id]) {
        servers[message.guild.id] = {
          config: $.getServerConfig(message.guild.id),
          loop: true,
          pokemonTimeout: 0,
          score: {}
        }
      } else {
        servers[message.guild.id].config = $.getServerConfig(message.guild.id)
      }
      this.server = servers[message.guild.id]
      this.message = message
    }
  }
}

Games.prototype.pokemon = async function(args) {
  var message = this.message,
    server = this.server,
    self = this

  if (args[0] != "start" && args[0] != "stop" && args[0] != "score" && args != "loop") return message.channel.send($.embed("Invalid Parameters. (start | stop)"))

  if (args[0] == "start") {
    message.channel.send($.embed("Pokemon game has started"))
  } else if (args[0] == "stop") {
    message.channel.send($.embed(`Pokemon game will stop after this.`))
    server.loop = false
    return
  } else if (args[0] == "score") {
    showScoreboard()
    return
  }

  if (!server.loop) {
    server.loop = true
    showScoreboard(true)
    reset()
    return
  } else if (server.pokemonTimeout == 5) {
    message.channel.send($.embed(`Pokemon game has stopped due to 5 consecutive lose.`))
    reset()
    return
  }

  var name
  do {
    name = pokemon.random()
  } while (name == "Type: Null")

  $.log(`Pokemon correct answer: ${name}`)

  var url = `https://gearoid.me/pokemon/images/artwork/${pokemon.getId(name)}.png`

  var image = await jimp.read(url)
  image.resize(200, 200)

  var real
  image.getBuffer(jimp.MIME_PNG, function(err, buffer) {
    real = buffer
  })

  var shadow = image.color([{
    apply: 'darken',
    params: [100]
  }])

  shadow.getBuffer(jimp.MIME_PNG, async function(err, buffer) {
    var msg = await message.channel.send($.embed()
      .attachFiles([buffer])
      .setAuthor("Who's that pokemon?", "https://i.imgur.com/3sQh8aN.png")
      .setImage("attachment://file.jpg")
      .setFooter(guessString(name))
    )
    var collector = new Discord.MessageCollector(message.channel, () => true)
    var winner
    collector.on("collect", (m) => {
      if (!server.score[m.author.id] && !m.author.bot) {
        server.score[m.author.id] = 0
      }
      if (m.content.toLowerCase() == name.toLowerCase()) {
        winner = m.author.id
        server.score[winner] += 1
        collector.emit("end")
      }
    })
    collector.on("end", async (collection, reason) => {
      msg.delete()
      msg = null
      await message.channel.send($.embed()
        .attachFiles([real])
        .setAuthor("Who's that pokemon?", "https://i.imgur.com/3sQh8aN.png")
        .setImage("attachment://file.jpg")
        .setDescription(`**${winner ? bot.users.get(winner).tag : "No one"}** got the correct answer!\nThe answer is **${name}**`)
      )
      if (!winner) server.pokemonTimeout += 1
      self.pokemon("loop")
    })
    setTimeout(() => {
      if (msg != null) collector.emit("end")
    }, 20000)
  })

  function showScoreboard(final) {
    var sorted = Object.keys(server.score).sort(function(a, b) {
      return server.score[a] - server.score[b]
    })
    sorted.reverse()
    var temp = []
    for (var i = 0; i < sorted.length; i++) {
      temp.push(`\`${i+1}.\` **${bot.users.get(sorted[i]).tag}**: **${server.score[sorted[i]]} ${server.score[sorted[i]] == 1 ? "point" : "points"}**`)
    }

    var temp = $.embed()
      .setAuthor("Who's that pokemon?", "https://i.imgur.com/3sQh8aN.png")
      .setTitle("Scoreboard")
      .setDescription(temp.join("\n"))
    if (final) temp.setFooter("Thank you for playing!", `https://cdn.discordapp.com/avatars/${bot.user.id}/${bot.user.avatar}.png?size=16`)

    message.channel.send(temp)
  }

  function guessString(string) {
    var arr = []
    var str = string.split("")
    for (var i = 0; i < Math.ceil(string.length / 2);) {
      var random = parseInt(Math.random() * string.length)
      if (arr.indexOf(random) == -1 && str[random] != " " && typeof str[random] !== 'symbol') {
        arr.push(random)
        i++
      }
    }
    for (var i = 0; i < arr.length; i++) {
      str[arr[i]] = "_"
    }
    return str.join(" ")
  }

  function reset() {
    server.pokemonTimeout = 0
    server.score = {}
  }
}

module.exports = Games