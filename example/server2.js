var Eventcast = require('../')

var server = Eventcast({
  discoveryInterval: 3000,
  port:19999, 
  multicastLoopback: true,
  multicastMembership: '224.192.1.1',
  replPort: 20002
})

server.start()
