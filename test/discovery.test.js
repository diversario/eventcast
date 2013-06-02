var Disco = require('../')
  , assert = require('assert')



describe('Defaults', function () {
  describe('Two instances', function () {
    it('see each other', function (done) {
      var server1 = Disco()
        , server2 = Disco()
        , messageCount = 0;
      
      [server1, server2].forEach(function(server){
        server.on('message', function(msg){
          assert(/default discovery/i.test(msg))
          if (++messageCount == 2) done()
        })
      })
      
      server1.start();
      server2.start();
    })
  })
})