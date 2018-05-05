var {
  spawn,
  exec
} = require('child_process');

var env = {}

function loop() {
  //kick off process of listing files
  var child = spawn('node', ['bot'], {
    env: env
  });

  //spit stdout to screen
  child.stdout.on('data', function(data) {
    process.stdout.write(data.toString());
  });

  //spit stderr to screen
  child.stderr.on('data', function(data) {
    process.stdout.write(data.toString());
  });

  child.on('close', function(code) {
    if (code == 1641) {
      env.message = "updated"
    } else if (code == 1) {
      env.message = "crashed"
    } else {
      env = {}
    }
    loop()
  });
}
loop()