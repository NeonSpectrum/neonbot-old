require('dotenv').config()

var { spawn } = require('child_process')

var env = process.env

;(function run() {
  var child = spawn(`node`, ['src/bot'], { env })

  child.stdout.on('data', function(data) {
    process.stdout.write(data.toString())
  })

  child.stderr.on('data', function(data) {
    process.stdout.write(data.toString())
  })

  child.on('close', function(code) {
    switch (code) {
      case 10:
        return
      case 2:
        env.message = 'updated'
        break
      case 1:
        env.message = 'crashed'
        break
      case 0:
        env.message = 'restarted'
    }
    console.log(code)
    console.log(env.message)
    run()
  })
})()
