var Disco = require('../')
  , assert = require('assert')



describe('Default announcements', function () {
  describe('Two instances', function () {
    it('can each other', function (done) {
      var server1 = new Disco
        , server2 = new Disco
        , messageCount = 0
      
      assert.notEqual(server1.getId(), server2.getId())
      
      ;[server1, server2].forEach(function(server){
        server.on('message', function(msg){
          assert(/default discovery/i.test(msg))
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
    
    it('do not interfere with each other', function (done) {
      var opts = {multicastLoopback: true, port: Disco.getRandomPort()}
        , server1 = Disco(opts)
        , server2 = Disco(opts)
        , messageCount = 0

      assert.notEqual(server1.getId(), server2.getId())

      ;[server1, server2].forEach(function(server){
        server.on('message', function(msg){
          assert(/default discovery/i.test(msg))
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
