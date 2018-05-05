require('dotenv').config()
var {
  spawn,
  exec
} = require('child_process');

var env = {}

function loop() {
  var child = spawn(`${process.env.NODE_PATH}node`, ['bot'], {
    env: env
  });

  child.stdout.on('data', function(data) {
    process.stdout.write(data.toString());
  });

  child.stderr.on('data', function(data) {
    process.stdout.write(data.toString());
  });

  child.on('close', function(code) {
    console.log(code)
    if (code == 2) {
      env.message = "updated"
    } else if (code == 1) {
      env.message = "crashed"
    } else {
      env.message = "restarted"
    }
    loop()
  });
}
loop()