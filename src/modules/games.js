const bot = require('../bot')
const $ = require('../assets/functions')
const jimp = require('jimp')
const poke = require('pokemon')
const Helper = require('./helper')
const servers = bot.games

class Games extends Helper {
  constructor(message) {
    if (!message) return super()

    super(
      message,
      servers[message.guild.id] || {
        config: $.getServerConfig(message.guild.id),
        pokemon: {
          loop: true,
          pokemonTimeout: 0,
          score: {}
        },
        connect4: {
          board: null,
          players: [],
          turn: null,
          lastBoardMessage: null,
          waitingMessage: null,
          timeout: null
        }
      }
    )
  }
}

Games.prototype.choose = function(args) {
  var message = this.message

  if (!args[0] || args[0].indexOf('|') === -1)
    return this.send($.embed('Invalid parameters. (<choice1>|<choice2>|...>'))
  var values = args[0].split('|')
  this.send($.embed(values[Math.floor(Math.random() * values.length)]))
}

Games.prototype.pokemon = async function(args) {
  const message = this.message
  const server = this.server
  const pokemon = server.pokemon
  const self = this

  if (args[0] !== 'start' && args[0] !== 'stop' && args[0] !== 'score' && args !== 'loop')
    return this.send($.embed('Invalid Parameters. (start | stop)'))

  if (args[0] === 'start') {
    this.send($.embed('Pokemon game has started'))
    pokemon.score = {}
  } else if (args[0] === 'stop') {
    this.send($.embed(`Pokemon game will stop after this.`))
    pokemon.loop = false
    return
  } else if (args[0] === 'score') {
    showScoreboard()
    return
  }

  if (!pokemon.loop) {
    pokemon.loop = true
    showScoreboard(true)
    pokemon.pokemonTimeout = 0
    return
  } else if (pokemon.pokemonTimeout === 5) {
    this.send($.embed(`Pokemon game has stopped due to 5 consecutive lose.`))
    showScoreboard(true)
    pokemon.pokemonTimeout = 0
    return
  }

  var name
  do {
    name = poke.random()
  } while (name === 'Type: Null')

  this.log(`Pokemon correct answer: ${name}`)

  var url = `https://gearoid.me/pokemon/images/artwork/${poke.getId(name)}.png`

  var image = await jimp.read(url)
  image.resize(200, 200)

  var real
  image.getBuffer(jimp.MIME_PNG, function(err, buffer) {
    if (err) return $.warn('Pokemon first image buffer', err)
    real = buffer
  })

  var shadow = image.color([
    {
      apply: 'darken',
      params: [100]
    }
  ])

  shadow.getBuffer(jimp.MIME_PNG, async function(err, buffer) {
    if (err) return $.warn('Pokemon second image buffer', err)
    var msg = await this.send(
      $.embed()
        .attachFiles([buffer])
        .setAuthor("Who's that pokemon?", 'https://i.imgur.com/3sQh8aN.png')
        .setImage('attachment://file.jpg')
        .setFooter(guessString(name))
    )
    var winner
    message.channel
      .awaitMessages(m => m.content.toLowerCase() === name.toLowerCase(), {
        max: 1,
        time: 20000,
        errors: ['time']
      })
      .then(m => {
        winner = m.first().author.id
        if (!pokemon.score[winner] && !m.first().author.bot) {
          pokemon.score[winner] = 0
        }
        pokemon.score[winner] += 1
        throw new Error('done')
      })
      .catch(async err => {
        if (err) return $.warn('Pokemon await message', err)
        msg.delete().catch(() => {})
        await this.send(
          $.embed()
            .attachFiles([real])
            .setAuthor("Who's that pokemon?", 'https://i.imgur.com/3sQh8aN.png')
            .setImage('attachment://file.jpg')
            .setDescription(
              `**${
                winner ? bot.users.get(winner).tag : 'No one'
              }** got the correct answer!\nThe answer is **${name}**`
            )
        )
        if (!winner) pokemon.pokemonTimeout += 1
        self.pokemon('loop')
      })
  })

  function showScoreboard(final) {
    var sorted = Object.keys(pokemon.score).sort(function(a, b) {
      return pokemon.score[a] - pokemon.score[b]
    })
    sorted.reverse()
    var scores = []
    for (var i = 0; i < sorted.length; i++) {
      scores.push(
        `\`${i + 1}.\` **${bot.users.get(sorted[i]).tag}**: **${pokemon.score[sorted[i]]} ${
          pokemon.score[sorted[i]] === 1 ? 'point' : 'points'
        }**`
      )
    }

    var temp = $.embed()
      .setAuthor("Who's that pokemon?", 'https://i.imgur.com/3sQh8aN.png')
      .setTitle('Scoreboard')
      .setDescription(scores.join('\n') || 'N/A')
    if (final) temp.setFooter('Thank you for playing!', message.author.displayAvatarURL())

    this.send(temp)
  }

  function guessString(string) {
    var arr = []
    var str = string.split('')
    for (let i = 0; i < Math.ceil(string.length / 2); ) {
      var random = parseInt(Math.random() * string.length)
      if (arr.indexOf(random) === -1 && str[random] !== ' ' && typeof str[random] !== 'symbol') {
        arr.push(random)
        i++
      }
    }
    for (let i = 0; i < arr.length; i++) {
      str[arr[i]] = '_'
    }
    return str.join(' ')
  }
}

Games.prototype.connect4 = async function() {
  const message = this.message
  const server = this.server
  const connect4 = server.connect4

  if (connect4.players.length === 2) return this.send($.embed('The game is already running.'))
  if (connect4.players.indexOf(message.author.id) === -1) {
    connect4.players.push(message.author.id)
    if (connect4.players.length !== 2) {
      connect4.waitingMessage = await this.send(
        $.embed(
          `Waiting for players to join. To join the game please use \`${server.config.prefix}connect4\`.`
        )
      )
      connect4.timeout = setTimeout(() => {
        if (connect4.players.length !== 2) {
          connect4.waitingMessage.delete().catch(() => {})
          this.send($.embed(`Insufficient players. The game will now close.`), 5000)
          connect4.players = []
        }
      }, 20000)
      return
    }
  } else {
    return message.channel
      .send($.embed(`${message.author.toString()} You are already in the game.`))
      .then(m =>
        m
          .delete({
            timeout: 3000
          })
          .catch(() => {})
      )
  }

  clearTimeout(connect4.timeout)
  connect4.waitingMessage.delete().catch(() => {})
  connect4.turn = Math.floor(Math.random() * 2)
  resetBoard()
  showBoard()

  function waitForAnswer() {
    message.channel
      .awaitMessages(
        m => connect4.players.indexOf(m.author.id) === connect4.turn && m.content > 0 && m.content <= 7,
        {
          max: 1,
          time: 30000,
          errors: ['time']
        }
      )
      .then(m => {
        var moved = movePlayer(connect4.players.indexOf(m.first().author.id), m.first().content - 1)
        if (!moved) {
          this.send($.embed(`${m.first().content} is full!`))
          return waitForAnswer()
        }
        var winner = checkWinner()
        if (!winner) {
          nextPlayer()
          showBoard()
          waitForAnswer()
        } else {
          showBoard(winner === 'draw' ? winner : bot.users.get(connect4.players[winner - 1]).tag)
        }
        m.first()
          .delete()
          .catch(() => {})
      })
      .catch(() => {
        var winner = connect4.turn === 0 ? 1 : 0
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
            arr.push('⚫')
            break
          case 1:
            arr.push('🔴')
            break
          case 2:
            arr.push('🔵')
            break
        }
      }
      board.push(arr.join(''))
    }
    board.push('\u0031\u20E3\u0032\u20E3\u0033\u20E3\u0034\u20E3\u0035\u20E3\u0036\u20E3\u0037\u20E3')
    var temp
    if (!winner) {
      temp = $.embed().setTitle(`Player to move: **${bot.users.get(connect4.players[connect4.turn]).tag}**\n`)
    } else {
      if (winner === 'draw') {
        temp = $.embed().setTitle(`Congratulations. It's a draw!`)
      } else {
        temp = $.embed().setTitle(
          `${
            timeout ? `${bot.users.get(connect4.players[connect4.turn]).tag} didn't answer.\n` : ''
          }Congratulations. ${winner} won the game!`
        )
      }
    }
    if (connect4.lastBoardMessage) connect4.lastBoardMessage.delete().catch(() => {})
    connect4.lastBoardMessage = await this.send(
      temp
        .setDescription(board.join('\n'))
        .setFooter(
          `Started by ${bot.users.get(connect4.players[0]).tag}`,
          bot.users.get(connect4.players[0]).displayAvatarURL()
        )
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
      if (connect4.board[i][index] === 0) {
        connect4.board[i][index] = id + 1
        return true
      }
    }
    return false
  }

  function nextPlayer() {
    connect4.turn = connect4.turn === 0 ? 1 : 0
  }

  function checkLine(a, b, c, d) {
    // Check first cell non-zero and all cells match
    return a !== 0 && a === b && a === c && a === d
  }

  function checkWinner() {
    var board = connect4.board

    // Check down
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 7; j++) {
        if (checkLine(board[i][j], board[i + 1][j], board[i + 2][j], board[i + 3][j])) {
          return board[i][j]
        }
      }
    }

    // Check right
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 4; j++) {
        if (checkLine(board[i][j], board[i][j + 1], board[i][j + 2], board[i][j + 3])) {
          return board[i][j]
        }
      }
    }

    // Check down-right
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        if (checkLine(board[i][j], board[i + 1][j + 1], board[i + 2][j + 2], board[i + 3][j + 3])) {
          return board[i][j]
        }
      }
    }

    // Check down-left
    for (let i = 3; i < 6; i++) {
      for (let j = 0; j < 4; j++) {
        if (checkLine(board[i][j], board[i - 1][j + 1], board[i - 2][j + 2], board[i - 3][j + 3])) {
          return board[i][j]
        }
      }
    }

    // Check if draw
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 7; j++) {
        if (board[i][j] === 0) {
          return false
        }
      }
    }

    return 'draw'
  }
}

module.exports = Games
