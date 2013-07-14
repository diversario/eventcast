var Eventcast = require('../')

var server = Eventcast({
  port:19999, 
  multicastLoopback: true,
  multicastMembership: '224.192.1.1',
  replPort: 20001
})

server.start()