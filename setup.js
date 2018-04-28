var fs = require('fs')
module.exports = (callback) => {
  if (!process.env.HEROKU) {
    const readline = require('readline');
    if (fs.existsSync('./config.json')) {
      fs.unlink('./config.json', function() {})
    }
    fs.writeFileSync('./config.json', fs.readFileSync('./config.json.example'));

    config = require('./config.json')

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
            fs.writeFile("./config.json", JSON.stringify(config, null, 2), (err) => {
              if (err) log(err)
              rl.close();
              callback();
            })
          })
        })
      })
    });
  } else {
    var paste = require("better-pastebin");
    paste.setDevKey(process.env.DEV_KEY)
    paste.login(process.env.PB_USER, process.env.PB_PASS, (success, data) => {
      if (!success) throw data
      paste.get(process.env.PB_ID, (success, data) => {
        fs.writeFile('./config.json', data, (err) => {
          callback()
        })
      });
    })
  }
}