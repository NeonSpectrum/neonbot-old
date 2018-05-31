const bot = require('../bot')
const $ = require('../assets/functions')
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
          score: {},
          connect4: {
            board: null,
            players: [],
            turn: null,
            lastBoardMessage: null,
            waitingMessage: null,
            timeout: null
          }
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

Games.prototype.connect4 = async function() {
  var message = this.message,
    server = this.server,
    connect4 = server.connect4

  if (connect4.players.length == 2) return message.channel.send($.embed("The game is already running."))
  if (connect4.players.indexOf(message.author.id) == -1) {
    connect4.players.push(message.author.id)
    if (connect4.players.length != 2) {
      connect4.waitingMessage = await message.channel.send($.embed(`Waiting for players to join. To join the game please use \`${server.config.prefix}connect4\`.`))
      connect4.timeout = setTimeout(() => {
        if (connect4.players.length != 2) {
          connect4.waitingMessage.delete().catch(() => {})
          message.channel.send($.embed(`Insufficient players. The game will now close.`)).then(m => m.delete({
            timeout: 5000
          }).catch(() => {}))
          connect4.players = []
        }
      }, 20000)
      return
    }
  } else return message.channel.send($.embed(`${message.author.toString()} You are already in the game.`)).then(m => m.delete({
    timeout: 3000
  }).catch(() => {}))

  clearTimeout(connect4.timeout)
  connect4.waitingMessage.delete().catch(() => {})
  connect4.turn = Math.floor(Math.random() * 2)
  resetBoard()
  showBoard()

  function waitForAnswer() {
    message.channel.awaitMessages((m) => connect4.players.indexOf(m.author.id) == connect4.turn && m.content > 0 && m.content <= 7, {
      max: 1,
      time: 30000,
      errors: ['time']
    }).then((m) => {
      movePlayer(connect4.players.indexOf(m.first().author.id), m.first().content - 1)
      var winner = checkWinner()
      if (!winner) {
        nextPlayer()
        showBoard()
        waitForAnswer()
      } else {
        showBoard(winner == "draw" ? winner : bot.users.get(connect4.players[winner - 1]).tag)
      }
      m.first().delete().catch(() => {})
    }).catch(() => {
      var winner = connect4.turn == 0 ? 1 : 0
      showBoard(bot.users.get(connect4.players[winner]).tag, true)
    })
  }
  waitForAnswer()

  async function showBoard(winner, timeout) {
    var board = []
    for (var i = 0; i < connect4.board.length; i++) {
      var arr = []
      for (var j = 0; j < connect4.board[i].length; j++) {
        var circle = connect4.board[i][j]
        switch (circle) {
          case 0:
            arr.push("⚫")
            break
          case 1:
            arr.push("🔴")
            break
          case 2:
            arr.push("🔵")
            break
        }
      }
      board.push(arr.join(""))
    }
    board.push("\u0031\u20E3\u0032\u20E3\u0033\u20E3\u0034\u20E3\u0035\u20E3\u0036\u20E3\u0037\u20E3")
    var temp
    if (!winner) {
      temp = $.embed().setTitle(`Player to move: **${bot.users.get(connect4.players[connect4.turn]).tag}**\n`)
    } else {
      if (winner == "draw") {
        temp = $.embed().setTitle(`Congratulations. It's a draw!`)
      } else {
        temp = $.embed().setTitle(`${timeout ? `${bot.users.get(connect4.players[connect4.turn]).tag} didn't answer.\n` : ""}Congratulations. ${winner} won the game!`)
      }
    }
    if (connect4.lastBoardMessage) connect4.lastBoardMessage.delete().catch(() => {})
    connect4.lastBoardMessage = await message.channel.send(temp
      .setDescription(board.join("\n"))
      .setFooter(`Started by ${bot.users.get(connect4.players[0]).tag}`, bot.users.get(connect4.players[0]).displayAvatarURL())
    )
    if (winner) connect4.players = []
  }

  function resetBoard() {
    connect4.board = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ]

    // connect4.board = [
    //   [0, 1, 1, 1, 2, 2, 1],
    //   [1, 2, 2, 2, 1, 2, 2],
    //   [2, 1, 1, 1, 2, 2, 1],
    //   [2, 2, 2, 1, 1, 1, 2],
    //   [1, 2, 1, 1, 2, 1, 1],
    //   [2, 1, 1, 2, 1, 2, 2]
    // ]
  }

  function movePlayer(id, index) {
    for (var i = connect4.board.length - 1; i >= 0; i--) {
      if (connect4.board[i][index] == 0) {
        connect4.board[i][index] = id + 1
        return true
      }
    }
    return false
  }

  function nextPlayer() {
    connect4.turn = connect4.turn == 0 ? 1 : 0
  }

  function checkLine(a, b, c, d) {
    // Check first cell non-zero and all cells match
    return ((a != 0) && (a == b) && (a == c) && (a == d));
  }

  function checkWinner() {
    var board = connect4.board

    // Check down
    for (i = 0; i < 3; i++)
      for (j = 0; j < 7; j++)
        if (checkLine(board[i][j], board[i + 1][j], board[i + 2][j], board[i + 3][j]))
          return board[i][j];

    // Check right
    for (i = 0; i < 6; i++)
      for (j = 0; j < 4; j++)
        if (checkLine(board[i][j], board[i][j + 1], board[i][j + 2], board[i][j + 3]))
          return board[i][j];

    // Check down-right
    for (i = 0; i < 3; i++)
      for (j = 0; j < 4; j++)
        if (checkLine(board[i][j], board[i + 1][j + 1], board[i + 2][j + 2], board[i + 3][j + 3]))
          return board[i][j];

    // Check down-left
    for (i = 3; i < 6; i++)
      for (j = 0; j < 4; j++)
        if (checkLine(board[i][j], board[i - 1][j + 1], board[i - 2][j + 2], board[i - 3][j + 3]))
          return board[i][j];

    // Check if draw
    for (i = 0; i < 6; i++)
      for (j = 0; j < 7; j++)
        if (board[i][j] == 0)
          return false;

    return "draw"
  }
}

module.exports = Games