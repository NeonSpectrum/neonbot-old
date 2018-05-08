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
    switch (code) {
      case 10:
        return
      case 2:
        env.message = "updated"
        break
      case 1:
        env.message = "crashed"
        break
      case 0:
        env.message = "restarted"
    }
    loop()
  });
}
loop()