module.exports = (callback) => {
  var fs = require('fs')
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
}