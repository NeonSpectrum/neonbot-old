var fs = require('fs')
var Discord = require('discord.js')
var moment = require('moment');
var colors = require('colors/safe');
var servers, config, db;

module.exports.log = (message) => {
  console.log(colors.yellow(moment().format('YYYY-MM-DD hh:mm:ss A')) + " | " + colors.cyan(typeof message === 'object' ? JSON.stringify(message) : message));
}

module.exports.embed = (message) => {
  var e = new Discord.RichEmbed().setColor("#59ABE3")
  if (message !== undefined)
    e.setDescription(message)
  return e
}

// module.exports.updateconfig = () => {
//   if (!process.env.HEROKU) {
//     fs.writeFile("./config.json", JSON.stringify(config, null, 2), (err) => {
//       if (err) log(err)
//     })
//   } else {
//     var paste = require("better-pastebin");
//     paste.setDevKey(process.env.DEV_KEY)
//     paste.login(process.env.PB_USER, process.env.PB_PASS, (success, data) => {
//       if (!success) throw data
//       paste.edit(process.env.PB_ID, {
//         contents: JSON.stringify(config, null, 2)
//       });
//     })
//   }
// }

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

module.exports.processDatabase = (arr, items) => {
  return new Promise(resolve => {
    var i = 0
    var loop = () => {
      if (i == arr.length) {
        module.exports.refreshServerConfig(() => {
          resolve()
        })
      } else {
        var isExists = false
        for (var j = 0; j < items.length; j++) {
          if (items[j].server_id == arr[i]) {
            isExists = true
            break
          }
        }
        if (!isExists) {
          db.collection("servers").insert({
            server_id: arr[i],
            prefix: config.default_prefix,
            deleteoncmd: false,
            voicetts: false,
            voicettsch: "",
            music: {
              volume: 100,
              autoplay: false,
              repeat: "off"
            }
          }, (err, items) => {
            i++
            loop()
          })
        } else {
          i++
          loop()
        }
      }
    }
    loop()
  })
}

module.exports.setDB = (x) => {
  db = x
}

module.exports.getDB = () => {
  return db
}
module.exports.setConfig = (x) => {
  config = x
}

module.exports.getConfig = () => {
  return config
}

module.exports.refreshConfig = (callback) => {
  db.collection("settings").find({}).toArray((err, items) => {
    config = items[0]
    callback()
  })
}

module.exports.getServerConfig = (id) => {
  for (var i = 0; i < servers.length; i++) {
    if (servers[i].server_id == id) {
      return servers[i]
    }
  }
}

module.exports.refreshServerConfig = (callback) => {
  db.collection("servers").find({}).toArray((err, items) => {
    servers = items
    callback()
  })
}

module.exports.updateConfig = (options) => {
  return new Promise(resolve => {
    db.collection("settings").update({}, {
      $set: options
    }, (err, res) => {
      module.exports.refreshConfig(() => {
        resolve(module.exports.getConfig())
      })
    })
  })
}

module.exports.updateServerConfig = (id, options) => {
  return new Promise(resolve => {
    db.collection("servers").update({
      server_id: id
    }, {
      $set: options
    }, (err, res) => {
      module.exports.refreshServerConfig(() => {
        resolve(module.exports.getServerConfig(id))
      })
    })
  })
}

module.exports.formatSeconds = (secs, format) => {
  var sec_num = parseInt(secs, 10);
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);

  if (hours < 10) {
    hours = "0" + hours;
  }
  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  if (seconds < 10) {
    seconds = "0" + seconds;
  }

  if (format == undefined) {
    var time = hours + ':' + minutes + ':' + seconds
    if (hours == "00") {
      time = time.substring(3)
    }
    return time
  } else if (format == 3) {
    return hours + ':' + minutes + ':' + seconds;
  } else if (format == 2) {
    minutes = parseInt(hours) * 60 + parseInt(minutes)
    return (minutes < 10 ? "0" + minutes : minutes) + ':' + seconds
  } else if (format == 1) {
    seconds = parseInt(hours) * 60 + parseInt(minutes) * 60 + parseInt(seconds)
    return seconds < 10 ? "0" + seconds : seconds
  }
}