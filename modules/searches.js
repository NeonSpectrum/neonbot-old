const bot = require('../bot')
const $ = require('../handler/functions')
const config = $.getConfig()
const GoogleSearch = require('google-search');
const googleSearch = new GoogleSearch({
  key: config.google_api,
  cx: '010420937032738550228:8287l8l_wec'
});
const GoogleImages = require('google-images');
const googleImages = new GoogleImages('010420937032738550228:8287l8l_wec', config.google_api);
const ud = require('urban-dictionary')

class Searches {
  constructor(message) {
    if (typeof message == "object") {
      var server = {
        config: $.getServerConfig(message.guild.id)
      }
      this.server = server
      this.message = message
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
    msg.delete();
    message.channel.send($.embed()
      .setAuthor(`Google Search for ${args.join(" ")}`, "http://i.imgur.com/G46fm8J.png")
      .setDescription(temp.join("\n"))
      .setFooter(`Searched by ${message.author.tag}`, `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=16`)
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
      .setFooter(`Searched by ${message.author.tag}`, `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=16`)
    )
  })
}

module.exports = Searches