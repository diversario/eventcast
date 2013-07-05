var Disco = require('../')
  , assert = require('assert')



describe('Default announcements', function () {
  describe('Two instances', function () {
    it('can see each other, encrypted body', function (done) {
      var server1 = new Disco({encrypt: {'key': 'qwqweqweqweq'}})
        , server2 = new Disco({encrypt: {'key': 'qwqweqweqweq'}})
        , messageCount = 0
      
      assert.notEqual(server1.id, server2.id)
      
      server1.set({name: 'message', interval: 2000}, 'default discovery message')
      server2.set({name: 'message', interval: 2000}, 'default discovery message')
      
      ;[server1, server2].forEach(function(server){
        server.on('message', function(msg){
          assert(/default discovery/i.test(msg.payload))
          if (++messageCount == 2) {
            server1.stop(function(){
              server2.stop(done)
            })
          }
        })
      })
      
      server1.start(function(){
        server2.start()
      })
    })
    
    it('do not interfere with each other, plaintext body', function (done) {
      var opts = {multicastLoopback: true, port: Disco.getRandomPort()}
        , server1 = Disco(opts)
        , server2 = Disco(opts)
        , messageCount = 0

      assert.notEqual(server1.id, server2.id)

      server1.set({name: 'message', interval: 2000}, 'default discovery message')
      server2.set({name: 'message', interval: 2000}, 'default discovery message')
      
      ;[server1, server2].forEach(function(server){
        server.on('message', function(msg){
          assert(/default discovery/i.test(msg.payload))
          if (++messageCount == 2) {
            server1.stop(function(){
              server2.stop(done)
            })
          }
        })
      })

      server1.start(function(){
        server2.start();
      });
    })
  })
})
