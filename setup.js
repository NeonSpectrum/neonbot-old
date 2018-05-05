var fs = require('fs')
var $ = require('./handler/functions')

module.exports = (db, callback) => {
  return new Promise(resolve => {
    if (!process.env.HEROKU) {
      const readline = require('readline');

      var config = {
        token: "",
        prefix: "",
        googleapi: "",
        ownerid: ""
      }
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.on('keypress', console.log);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });
      rl.on('line', (input) => {});
      rl.question('Enter bot token: ', (answer) => {
        config.token = answer.trim()
        rl.question('Enter bot prefix: ', (answer) => {
          config.prefix = answer.trim()
          rl.question('Enter bot google api: ', (answer) => {
            config.googleapi = answer.trim()
            rl.question('Enter bot owner: ', (answer) => {
              config.ownerid = answer.trim()
              rl.close();
              db.collection('settings').insert({
                token: config.token,
                default_prefix: config.prefix,
                google_api: config.googleapi,
                ownerid: config.ownerid,
                game: {
                  type: "",
                  name: ""
                }
              }, (err, items) => {
                resolve(items.ops);
              })
            })
          })
        })
      });
    } else {
      db.collection('settings').insert({
        token: process.env.TOKEN,
        default_prefix: process.env.PREFIX,
        google_api: process.env.GOOGLEAPI,
        ownerid: process.env.OWNERID,
        game: {
          type: "",
          name: ""
        }
      }, (err, items) => {
        if (err) $.log(err)
        resolve(items.ops);
      })
    }
  })
}