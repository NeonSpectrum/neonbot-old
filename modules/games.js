const bot = require('../bot')
const $ = require('../assets/functions')
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
      this.log = (content) => {
        $.log(content, message)
      }
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
    showScoreboard(true)
    reset()
    return
  }

  var name
  do {
    name = pokemon.random()
  } while (name == "Type: Null")

  this.log(`Pokemon correct answer: ${name}`)

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
    var winner
    message.channel.awaitMessages((m) => m.content.toLowerCase() == name.toLowerCase(), {
      max: 1,
      time: 20000,
      errors: ['time']
    }).then((m) => {
      winner = m.first().author.id
      if (!server.score[winner] && !m.first().author.bot) {
        server.score[winner] = 0
      }
      server.score[winner] += 1
      throw "done"
    }).catch(async (err) => {
      msg.delete().catch(() => {})
      await message.channel.send($.embed()
        .attachFiles([real])
        .setAuthor("Who's that pokemon?", "https://i.imgur.com/3sQh8aN.png")
        .setImage("attachment://file.jpg")
        .setDescription(`**${winner ? bot.users.get(winner).tag : "No one"}** got the correct answer!\nThe answer is **${name}**`)
      )
      if (!winner) server.pokemonTimeout += 1
      self.pokemon("loop")
    })
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
    if (final) temp.setFooter("Thank you for playing!", message.author.displayAvatarURL())

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