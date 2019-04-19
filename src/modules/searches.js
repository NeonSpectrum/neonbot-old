const bot = require('../bot')
const $ = require('../assets/functions')
const moment = require('moment')
const _ = require('lodash')
const emojiFlags = require('emoji-flags')
const cheerio = require('cheerio')
const tunnel = require('tunnel')
const langs = require('../assets/lang')
const owjs = require('overwatch-js')
const SteamID = require('steamid')
const GoogleSearch = require('google-search')
const translate = require('google-translate-api')
const googleSearch = new GoogleSearch({
  key: bot.env.GOOGLE_API,
  cx: '010420937032738550228:8287l8l_wec'
})
const GoogleImages = require('google-images')
const googleImages = new GoogleImages('010420937032738550228:8287l8l_wec', bot.env.GOOGLE_API)
const ud = require('urban-dictionary')

class Searches {
  constructor(message) {
    if (typeof message === 'object') {
      var server = {
        config: $.getServerConfig(message.guild.id)
      }
      this.server = server
      this.message = message
      this.log = content => {
        $.log(content, message)
      }
    }
  }
}

Searches.prototype.google = async function(args) {
  var message = this.message

  var msg = await message.channel.send($.embed('Searching...'))

  googleSearch.build(
    {
      q: args.join(' '),
      num: 5
    },
    function(err, res) {
      if (err) return $.warn(err)
      var items = res.items
      var temp = []
      for (let i = 0; i < items.length; i++) {
        temp.push(
          `[${items[i].title}](${items[i].link})\n${items[i].snippet.replace(/<\/?[^>]+(>|$)/g, '')}\n`
        )
      }
      msg.delete().catch(() => {})
      message.channel.send(
        $.embed()
          .setAuthor(`Google Search for ${args.join(' ')}`, 'http://i.imgur.com/G46fm8J.png')
          .setDescription(temp.join('\n'))
          .setFooter(`Searched by ${message.author.tag}`, message.author.displayAvatarURL())
      )
    }
  )
}

Searches.prototype.image = async function(args) {
  var message = this.message

  var msg = await message.channel.send($.embed('Searching...'))

  googleImages.search(args.join(' ')).then(images => {
    msg.delete().catch(() => {})
    message.channel.send(
      $.embed()
        .setAuthor(`Google Images for ${args.join(' ')}`, 'http://i.imgur.com/G46fm8J.png')
        .setFooter(`Searched by ${message.author.tag}`, message.author.displayAvatarURL())
        .setImage(images[0].url.split('?')[0])
    )
  })
}

Searches.prototype.translate = async function(args) {
  var message = this.message

  if (!args[0]) {
    return message.channel.send($.embed('Invalid Paramters. (lang<lang <word> | lang <word>)'))
  }

  var msg = await message.channel.send($.embed('Searching...'))

  var word = args.slice(1).join(' ')
  var lang = args[0].split('>')
  var from = lang[1] ? lang[0] : undefined
  var to = lang[1] || lang[0]

  translate(word, {
    from: from,
    to: to
  })
    .then(res => {
      msg.delete().catch(() => {})
      message.channel.send(
        $.embed()
          .setAuthor('Google Translate', 'http://i.imgur.com/G46fm8J.png')
          .setFooter(`Searched by ${message.author.tag}`, message.author.displayAvatarURL())
          .setDescription(
            `\`${word}\`from \`${langs[res.from.language.iso]}\` to \`${langs[to]}\`\n\`\`\`${res.text}\`\`\``
          )
      )
    })
    .catch(() => {
      msg.delete().catch(() => {})
      message.channel.send($.embed('Cannot translate to this language.'))
    })
}

Searches.prototype.langlist = function() {
  var message = this.message

  var key = Object.keys(langs)
  var str = []

  for (let i = 0; i < key.length; i++) {
    str.push(`\`${key[i]}\`: ${langs[key[i]]}`)
  }
  message.channel.send(
    $.embed()
      .setTitle('Language List')
      .setDescription(str.join('\n'))
  )
}

Searches.prototype.ud = async function(args) {
  var message = this.message

  var msg = await message.channel.send($.embed('Searching...'))

  ud.term(args.join(' '), function(err, entries, tags, sounds) {
    if (err) return $.warn(err)
    msg.delete().catch(() => {})
    message.channel.send(
      $.embed()
        .setAuthor(
          `Urban Dictionary for ${args.join(' ')}`,
          'https://lh5.ggpht.com/oJ67p2f1o35dzQQ9fVMdGRtA7jKQdxUFSQ7vYstyqTp-Xh-H5BAN4T5_abmev3kz55GH%3Dw300'
        )
        .setTitle(entries[0].word)
        .setURL(entries[0].permalink)
        .addField('**Definition:**', entries[0].definition)
        .addField('**Example:**', entries[0].example)
        .setFooter(`Searched by ${message.author.tag}`, message.author.displayAvatarURL())
    )
  })
}

Searches.prototype.weather = async function(args) {
  var message = this.message

  if (!args[0]) return message.channel.send($.embed('Please specify a city.'))

  var msg = await message.channel.send($.embed('Searching...'))
  var json = await $.fetchJSON(
    `http://api.openweathermap.org/data/2.5/weather?q=${args.join(
      ' '
    )}&units=metric&appid=a88701020436549755f42d7e4be71762`
  )

  if (+json.cod !== 200) {
    return msg.edit($.embed('City not found.')).catch(() => {})
  }
  message.channel.send(
    $.embed()
      .setTitle(`${emojiFlags.countryCode(json.sys.country).emoji} ${json.sys.country} - ${json.name}`)
      .setURL(`https://openweathermap.org/city/${json.id}`)
      .setFooter('Powered by OpenWeatherMap', 'https://media.dragstone.com/content/icon-openweathermap-1.png')
      .setThumbnail(`http://openweathermap.org/img/w/${json.weather[0].icon}.png`)
      .addField('☁ Weather', `${json.weather[0].main} - ${json.weather[0].description}`)
      .addField(
        '🌡 Temperature',
        `Minimum Temperature: ${json.main.temp_min}°C\nMaximum Temperature: ${
          json.main.temp_max
        }°C\nTemperature: ${json.main.temp}°C`
      )
      .addField('💨 Wind', `Speed: ${json.wind.speed} m/s\nDegrees: ${json.wind.deg}°`)
      .addField('🌤 Sunrise', moment(new Date(json.sys.sunrise * 1000)).format('MMM D, YYYY h:mm:ss A'))
      .addField('🌥 Sunset', moment(new Date(json.sys.sunset * 1000)).format('MMM D, YYYY h:mm:ss A'))
      .addField('🔘 Coordinates', `Longitude: ${json.coord.lon}\nLatitude: ${json.coord.lat}`)
      .addField('🎛 Pressure', `${json.main.pressure} hpa`)
      .addField('💧 Humidity', `${json.main.humidity}%`)
  )
}

Searches.prototype.randomjoke = async function(args) {
  var message = this.message

  var name = message.mentions.users.first()
    ? message.mentions.users.first().username
    : args[0] || 'Chuck Norris'

  var json = await $.fetchJSON(`http://api.icndb.com/jokes/random?escape=javascript`)

  var msg = json.value.joke
    .replace('Chuck Norris', name)
    .replace(`${name}' `, name[name.length - 1] !== 's' ? `${name}'s ` : undefined)

  message.channel.send($.embed(msg))
}

Searches.prototype.lol = async function(args) {
  var message = this.message

  if (args[0] !== 'summoner' && args[0] !== 'champion') {
    return message.channel.send($.embed('Invalid Parameters. (summoner <user> | champion <name>)'))
  }

  if (args[0] === 'summoner') {
    var msg = await message.channel.send($.embed('Searching...'))
    var name = args.slice(1).join(' ')
    var c = cheerio.load(await $.fetch(`http://ph.op.gg/summoner/userName=${name}`))

    var mostPlayed = []
    var recentlyPlayed = []

    c('.MostChampionContent')
      .find('.Face')
      .each(function() {
        mostPlayed.push(c(this).attr('title'))
      })
    c('table.SummonersMostGameTable')
      .find('.SummonerName>a')
      .each(function() {
        recentlyPlayed.push(c(this).text())
      })

    var data = {
      icon: `http:${c('.ProfileIcon>img.ProfileImage').attr('src')}`,
      name: c('.Profile>.Information>.SummonerName').text(),
      rank: {
        title:
          c('.LeaguesContainer .Tier')
            .eq(0)
            .text() || 'N/A',
        icon: `http:${c('.Medal>img').attr('src')}`,
        info: {
          points:
            c('.LeaguesContainer .LP')
              .eq(0)
              .text() || 'N/A',
          win:
            c('.LeaguesContainer .WinLose>.Wins')
              .eq(0)
              .text() || 'N/A',
          lose:
            c('.LeaguesContainer .WinLose>.Losses')
              .eq(0)
              .text() || 'N/A',
          ratio:
            c('.LeaguesContainer .WinLose>.Ratio')
              .eq(0)
              .text() || 'N/A'
        }
      },
      mostPlayed: mostPlayed,
      recentlyPlayed: recentlyPlayed
    }

    if (data.name) {
      msg.delete().catch(() => {})
      var temp = $.embed()
        .setAuthor(data.name, data.icon)
        .setFooter('Powered by op.gg', 'http://opgg-static.akamaized.net/images/logo/logo-lol.png')
        .setThumbnail(data.rank.icon)
        .addField('Rank', data.rank.title)

      if (data.rank.title !== 'Unranked') {
        temp
          .addField('Points', data.rank.info.points)
          .addField(
            'Stats',
            data.rank.info.ratio == 'N/A'
              ? 'N/A'
              : `${data.rank.info.win} / ${data.rank.info.lose} (${data.rank.info.ratio})`
          )
      }

      if (data.mostPlayed.length > 0) {
        temp.addField('Most Played Champions (Ranked)', data.mostPlayed.join(', '))
      }

      if (data.recentlyPlayed.length > 0) {
        temp.addField('Recently Played with', data.recentlyPlayed.join(', '))
      }

      message.channel.send(temp)
    } else {
      msg.edit($.embed('Summoner name not found.')).catch(() => {})
    }
  } else if (args[0] === 'champion') {
    msg = await message.channel.send($.embed('Searching...'))
    c = cheerio.load(await $.fetch(`https://www.leaguespy.net/league-of-legends/champion/${args[1]}/stats`))

    var strongAgainst = [
      c('.champ__counters')
        .eq(0)
        .find('.champ__counters__radials__big>a>span')
        .text(),
      c('.champ__counters')
        .eq(0)
        .find('.champ__counters__radials__small>a>span')
        .text()
    ]
    var weakAgainst = [
      c('.champ__counters')
        .eq(1)
        .find('.champ__counters__radials__big>a>span')
        .text(),
      c('.champ__counters')
        .eq(1)
        .find('.champ__counters__radials__small>a>span')
        .text()
    ]
    var skillBuild = []
    var itemBuild = {
      startingItems: [],
      boots: [],
      coreItems: [],
      luxuryItems: []
    }

    c('.ls-table')
      .eq(0)
      .find('.ls-table__row')
      .each(function() {
        strongAgainst.push(
          c(this)
            .find('a')
            .text()
            .trim()
        )
      })
    c('.ls-table')
      .eq(1)
      .find('.ls-table__row')
      .each(function() {
        weakAgainst.push(
          c(this)
            .find('a')
            .text()
            .trim()
        )
      })
    c('.skill-block')
      .find('.skill-grid__column')
      .each(function() {
        c(this)
          .find('span')
          .each(function(i) {
            if (c(this).hasClass('active')) {
              var skill = ''
              switch (i) {
                case 0:
                  skill = 'q'
                  break
                case 1:
                  skill = 'w'
                  break
                case 2:
                  skill = 'e'
                  break
                case 3:
                  skill = 'r'
                  break
              }
              skillBuild.push(skill)
            }
          })
      })
    c('.champ-block')
      .find('.item-block')
      .eq(0)
      .find('.item-block__top>.item-block__items>span')
      .each(function() {
        itemBuild.startingItems.push(
          c(this)
            .find('span')
            .text()
        )
      })
    c('.champ-block')
      .find('.item-block')
      .eq(1)
      .find('.item-block__top>.item-block__items>span')
      .each(function() {
        itemBuild.boots.push(
          c(this)
            .find('span')
            .text()
        )
      })
    c('.champ-block')
      .find('.item-block')
      .eq(2)
      .find('.item-block__top>.item-block__items>span')
      .each(function() {
        itemBuild.coreItems.push(
          c(this)
            .find('span')
            .text()
        )
      })
    c('.champ-block')
      .find('.item-block')
      .eq(3)
      .find('.item-block__top>.item-block__items>span')
      .each(function() {
        itemBuild.luxuryItems.push(
          c(this)
            .find('span')
            .text()
        )
      })
    data = {
      icon: c('.champ__header__left__radial')
        .find('.inset>img')
        .attr('src'),
      name: c('.champ__header__left__main>h2').text(),
      role: c('.stat-source>.stat-source__btn')
        .eq(0)
        .find('a')
        .text()
        .split(' ')[0],
      roleIcon: `https://www.leaguespy.net${c('.champ__header__left__radial>.overlay>img').attr('src')}`,
      winRate: c('.champ__header__left__main>.stats-bar')
        .eq(0)
        .find('.bar-div>span')
        .text(),
      banRate: c('.champ__header__left__main>.stats-bar')
        .eq(1)
        .find('.bar-div>span')
        .text(),
      weakAgainst: weakAgainst.filter(x => x != ''),
      strongAgainst: strongAgainst.filter(x => x != ''),
      skillBuild: skillBuild.filter(x => x != ''),
      itemBuild: _.mapValues(itemBuild, x => x.filter(x => x != ''))
    }
    if (data.name) {
      msg.delete().catch(() => {})
      message.channel.send(
        $.embed()
          .setAuthor(
            data.name,
            data.roleIcon,
            `https://www.leaguespy.net/league-of-legends/champion/${args[1]}/stats`
          )
          .setThumbnail(data.icon)
          .setFooter('Powered by LeagueSpy', 'https://www.leaguespy.net/images/favicon/favicon-32x32.png')
          .addField('Role', data.role)
          .addField('Win Rate', data.winRate)
          .addField('Ban Rate', data.banRate)
          .addField('Weak Against', data.weakAgainst.join(', '))
          .addField('Strong Against', data.strongAgainst.join(', '))
          .addField('Skill Build', data.skillBuild.join(' > '))
          .addField(
            'Item Build',
            `Starting Items: ${data.itemBuild.startingItems.join(', ')}\nBoots: ${data.itemBuild.boots.join(
              ', '
            )}\nCore Items: ${data.itemBuild.coreItems.join(
              ', '
            )}\nLuxury Items: ${data.itemBuild.luxuryItems.join(', ')}`
          )
      )
    } else {
      msg.edit($.embed('Champion not found')).catch(() => {})
    }
  }
}

Searches.prototype.overwatch = async function(args) {
  var message = this.message

  if (!args[0] || args[0].indexOf('#') === -1) {
    return message.channel.send($.embed('Please specify a name with tag'))
  }

  var msg = await message.channel.send($.embed('Searching...'))

  try {
    var user = await owjs.search(args[0])
    var data = await owjs.getAll('pc', 'career', user[0].urlName)
    var main = data.competitive.global.masteringHeroe
    var timePlayed = +data.quickplay.global.time_played / 1000 / 3600

    msg.delete().catch(() => {})
    message.channel.send(
      $.embed()
        .setAuthor(user[0].name, data.profile.avatar, data.profile.url)
        .setThumbnail(data.profile.rankPicture)
        .setFooter(
          'Powered by Overwatch',
          'https://cdn.iconscout.com/public/images/icon/free/png-512/overwatch-logo-353d59a7a9b81227-512x512.png'
        )
        .addField('Level', data.profile.level)
        .addField('Tier', data.profile.tier)
        .addField('Rank', `${data.profile.level} (${data.profile.rank})`)
        .addField(
          'Main Hero',
          `${main.toUpperCase()} W: ${data.competitive.heroes[main].games_won} L: ${
            data.competitive.heroes[main].games_lost
          } (${data.competitive.heroes[main].win_percentage}%)`
        )
        .addField('Medals', data.competitive.global.medals)
        .addField('Time Played', `${timePlayed} ${timePlayed === 1 ? 'hour' : 'hours'}`)
    )
  } catch (err) {
    msg.edit($.embed('User not found.')).catch(() => {})
  }
}

Searches.prototype.dota2 = async function(args) {
  var message = this.message

  if (!args[0]) {
    return message.channel.send($.embed('Please specify an Steam ID.'))
  }

  var msg = await message.channel.send($.embed('Searching...'))
  var sid
  try {
    sid = new SteamID(args[0])
  } catch (err) {
    return msg.edit($.embed('User not found.')).catch(() => {})
  }

  var c = cheerio.load(await $.fetch(`https://www.dotabuff.com/players/${sid.accountid}`))

  if (
    c('.intro.intro-smaller')
      .text()
      .indexOf('private') > -1
  ) {
    return message.channel.send($.embed("This user's profile is private."))
  }

  var mostPlayed = []
  var record = c('.header-content-secondary>dl')
    .eq(3)
    .find('.game-record')
    .text()
    .split('-')

  c('.heroes-overview>.r-row').each(function(i) {
    if (i < 5) {
      mostPlayed.push(
        c(this)
          .find('.r-none-mobile>a')
          .text()
      )
    }
  })
  var data = {
    name: c('.image-container-bigavatar>a>img').attr('alt'),
    icon: c('.image-container-bigavatar>a>img').attr('src'),
    lastMatch:
      c('.header-content-secondary>dl')
        .eq(0)
        .find('dd>time')
        .text() || 'N/A',
    soloMMR:
      c('.header-content-secondary>dl')
        .eq(1)
        .find('dd')
        .text()
        .split(' ')[0] || 'N/A',
    partyMMR:
      c('.header-content-secondary>dl')
        .eq(2)
        .find('dd')
        .text()
        .split(' ')[0] || 'N/A',
    record: record[0] ? record : 'N/A',
    winRate:
      c('.header-content-secondary>dl')
        .eq(4)
        .find('dd')
        .text() || 'N/A',
    mostPlayed: mostPlayed[0] ? mostPlayed : 'N/A'
  }
  if (data.name && data.lastMatch !== 'N/A') {
    msg.delete().catch(() => {})
    message.channel.send(
      $.embed()
        .setAuthor(data.name, data.icon)
        .setFooter(
          'Powered by Dota Buff',
          'https://pbs.twimg.com/profile_images/879332626414358528/eHLyVWo-_400x400.jpg'
        )
        .addField('Solo MMR', data.soloMMR)
        .addField('Party MMR', data.partyMMR)
        .addField(
          'Record',
          typeof data.record === 'object'
            ? `Win: ${data.record[0]}\nLose: ${data.record[1]}\nAbandon: ${data.record[2]}`
            : data.record
        )
        .addField('Win Rate', data.winRate)
        .addField(
          'Most Played Hero',
          typeof data.mostPlayed === 'object' ? data.mostPlayed.join(', ') : data.mostPlayed
        )
    )
  } else {
    msg.edit($.embed('User not found.')).catch(() => {})
  }
}

Searches.prototype.csgo = async function(args) {
  var message = this.message

  if (!args[0]) {
    return message.channel.send($.embed('Please specify an Steam ID.'))
  }

  var msg = await message.channel.send($.embed('Searching...'))
  var c = cheerio.load(await $.fetch(`https://csgo-stats.com/search/${args[0]}`))

  var data = {
    name: c('.steam-name>a').text(),
    icon: c('.avatar>img').attr('src'),
    rank: c('span.rank-name').text(),
    rankIcon: `https://csgo-stats.com${c('.rank>img').attr('src')}`,
    kills: c('.main-stats')
      .eq(0)
      .find('.main-stats-row-top')
      .find('.main-stats-data-row')
      .eq(1)
      .find('.main-stats-data-row-data')
      .text(),
    timePlayed: c('.main-stats')
      .eq(0)
      .find('.main-stats-row')
      .find('.main-stats-data-row')
      .eq(1)
      .find('.main-stats-data-row-data')
      .text(),
    winRate: c('.main-stats')
      .eq(0)
      .find('.main-stats-row-bot')
      .find('.main-stats-data-row')
      .eq(1)
      .find('.main-stats-data-row-data')
      .text(),
    accuracy: c('.main-stats')
      .eq(1)
      .find('.main-stats-row-top')
      .find('.main-stats-data-row-alt')
      .eq(1)
      .find('.main-stats-data-row-data')
      .text(),
    headshot: c('.main-stats')
      .eq(1)
      .find('.main-stats-row')
      .find('.main-stats-data-row-alt')
      .eq(1)
      .find('.main-stats-data-row-data')
      .text(),
    mvp: c('.main-stats')
      .eq(1)
      .find('.main-stats-row-bot')
      .find('.main-stats-data-row-alt')
      .eq(1)
      .find('.main-stats-data-row-data')
      .text(),
    favoriteWeapon: c('.fav-weapon-pretty-name>span')
      .eq(0)
      .text(),
    favoriteMap: c('.fav-weapon-pretty-name>span')
      .eq(1)
      .text()
  }
  if (data.name) {
    msg.delete().catch(() => {})
    message.channel.send(
      $.embed()
        .setAuthor(data.name, data.icon)
        .setFooter(
          'Powered by CSGO Stats',
          'https://store2cdn2.overwolf.com/.galleries/app-icons/CSGO_Stats_com-CSGO_Stats_Icon.png'
        )
        .setThumbnail(data.rankIcon)
        .addField('Rank', data.rank)
        .addField('Kills', data.kills)
        .addField('Win Rate', data.winRate)
        .addField('MVP', data.mvp)
        .addField('Accuracy', data.accuracy)
        .addField('Headshot', data.headshot)
        .addField('Favorite Weapon', data.favoriteWeapon)
        .addField('Favorite Map', data.favoriteMap)
        .addField('Time Played', data.timePlayed)
    )
  } else {
    msg.edit($.embed('User not found.')).catch(() => {})
  }
}

Searches.prototype.lyrics = async function(args) {
  var message = this.message

  if (!args[0]) return message.channel.send($.embed('Please specify a song'))

  var msg = await message.channel.send($.embed('Searching...'))
  var html = await $.fetch('https://search.azlyrics.com/search.php?q=' + args.join(' ').replace(/\s/g, '+'))

  var c = cheerio.load(html)
  var lyricSearchList = []
  c('td.visitedlyr a').each(function() {
    if (
      lyricSearchList.length <= 5 &&
      c(this)
        .attr('href')
        .indexOf('/lyrics/') > -1
    ) {
      lyricSearchList.push({
        title: c(this).text(),
        url: c(this).attr('href')
      })
    }
  })
  if (lyricSearchList.length > 0) {
    msg.delete().catch(() => {})
    var temp = $.embed().setAuthor('Choose 1-5 below.', 'https://i.imgur.com/SBMH84I.png')
    for (let i = 0; i < lyricSearchList.length; i++) {
      temp.addField(`${i + 1}. ${lyricSearchList[i].title}`, lyricSearchList[i].url)
    }
    var reactionlist = ['\u0031\u20E3', '\u0032\u20E3', '\u0033\u20E3', '\u0034\u20E3', '\u0035\u20E3', '🗑']
    msg = await message.channel.send(temp)
    msg
      .awaitReactions(
        (reaction, user) => reactionlist.indexOf(reaction.emoji.name) > -1 && user.id === message.author.id,
        {
          max: 1,
          time: 15000,
          errors: ['time']
        }
      )
      .then(async collected => {
        collected
          .first()
          .message.delete()
          .catch(() => {})
        if (collected.first().emoji.name === '🗑') return
        var index = reactionlist.indexOf(collected.first().emoji.name)
        msg = await message.channel.send($.embed('Processing...'))
        var proxy = bot.env.PROXY.split(':')
        html = await $.fetch(lyricSearchList[index].url, {
          httpsAgent: proxy[0]
            ? new tunnel.httpsOverHttp({
                proxy: {
                  host: proxy[0],
                  port: proxy[1]
                }
              })
            : null
        })
        msg.delete().catch(() => {})
        lyricSearchList = []
        var c = cheerio.load(html)
        var string = c('div.col-xs-12.col-lg-8.text-center div')
          .eq(6)
          .text()
        var strings = []
        do {
          var part = string.substring(0, 2001)
          part = part.substring(0, part.lastIndexOf(part.lastIndexOf('\n\n') >= 0 ? '\n\n' : '\n') + 1)
          strings.push(part)
          string = string.replace(part, '')
        } while (string.length > 0)
        for (let i = 0; i < strings.length; i++) {
          var temp = $.embed(strings[i])
          if (i === 0) temp.setTitle(c('div.lyricsh h2 b').text())
          await message.channel.send(temp)
        }
      })
      .catch(err => {
        $.warn(err)
        msg.delete().catch(() => {})
      })
    for (let i = 0; i < reactionlist.length; i++) {
      try {
        await msg.react(reactionlist[i])
      } catch (err) {
        break
      }
    }
  } else {
    msg.edit($.embed('Lyrics not found.')).catch(() => {})
  }
}

module.exports = Searches
