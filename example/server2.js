var Eventcast = require('../')

var server = Eventcast({
  port:19999, 
  multicastLoopback: true,
  multicastMembership: '224.192.1.1',
  replPort: 20002
})

server.start()


setInterval(function() {
  server.emit('server2 here', 'time is ' + new Date().toLocaleString())
}, 5000)