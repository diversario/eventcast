var Disco = require('../')
  , assert = require('assert')



describe('Default announcements', function () {
  function getOpts(custom) {
    var opts = {
      port: custom && custom.port || Disco.getRandomPort()
    }
    
    custom && Object.keys(custom).forEach(function (k) {
      opts[k] = custom[k]
    })
    
    return opts
  }

  function checkMessage(msg, opts) {
    if (opts && opts.payload) {
      var regexp = new RegExp('^' + opts.payload + '$')
      assert(regexp.test(msg.payload()))
    } else if (!opts || opts.payload !== null) {
      assert(/^hello$/.test(msg.payload()))
    } else {
      assert(msg.payload() === null)
    }
    
    assert(msg.header().version == Disco.protocolVersion)
    assert(msg.header().encrypted == (opts && opts.encrypted ? 1 : 0))
  }

  function checkMeta(msg, opts) {
    if (opts && opts.encrypted) {
      assert(msg.meta().nonce)
      assert(msg.meta().nonce.length === 40)
    }
  }
  
  describe('Two instances', function () {
    it('emit messages', function (done) {
      var opts = Disco.getRandomPort()
        , server1 = new Disco(opts)
        , server2 = new Disco(opts)
        , messageCount = 0

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('discovered', function(msg){
          checkMessage(msg)
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

    it('register each other', function (done) {
      var opts = Disco.getRandomPort()
        , server1 = new Disco(opts)
        , server2 = new Disco(opts)
        , messageCount = 0

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('discovered', function(msg){
          checkMessage(msg)
          if (++messageCount == 6) {
            getNodeList()
          }
        })
      })

      function getNodeList() {
        var list1 = server1.nodes.toArray()
          , list2 = server2.nodes.toArray()
        
        list1.sort(function (a, b) {
          return (a.id < b.id) ? -1 : 1
        })
        
        list2.sort(function (a, b) {
          return (a.id < b.id) ? -1 : 1
        })

        assert.deepEqual(list1, list2)
        
        server1.stop(function(){
          server2.stop(done)
        })
      }
      
      server1.start(function(){
        server2.start()
      })
    })


    it('can see each other, encrypted body', function (done) {
      var opts = getOpts({encrypt: {'key': 'qwqweqweqweq'}})
        , server1 = new Disco(opts)
        , server2 = new Disco(opts)
        , messageCount = 0
      
      assert.notEqual(server1.id, server2.id)
      
      server1.set({name: 'heyoo', interval: 2000}, 'howdy neighborino!')
      server2.set({name: 'heyoo', interval: 2000}, 'howdy neighborino!')
      
      ;[server1, server2].forEach(function(server){
        server.on('heyoo', function(msg){
          var opt = {payload: 'howdy neighborino!', encrypted: true}
          checkMessage(msg, opt)
          checkMeta(msg, opt)
          
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

    it('works without payload', function (done) {
      var opts = getOpts()
        , server1 = Disco(opts)
        , server2 = Disco(opts)
        , messageCount = 0

      assert.notEqual(server1.id, server2.id)

      server1.set({name: 'updog', interval: 2000})
      server2.set({name: 'updog', interval: 2000})

      ;[server1, server2].forEach(function(server){
        server.on('updog', function(msg){
          checkMessage(msg, {payload: null})
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
  })
})
