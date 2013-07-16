var Eventcast = require('../')
  , assert = require('assert')
  , net = require('net')

function getOpts(custom) {
  var opts = {
    port: custom && custom.port || Eventcast.getRandomPort()
  }
  
  custom && Object.keys(custom).forEach(function (k) {
    opts[k] = custom[k]
  })
  
  return opts
}

function checkMessage(msg, opts) {
  if (opts && opts.payload) {
    if (typeof opts.payload == 'string') {
      var regexp = new RegExp('^' + opts.payload + '$')
      assert(regexp.test(msg.payload()))
    }
    
    if (typeof opts.payload == 'object') {
      assert.deepEqual(opts.payload, msg.payload())
    }
  } else if (!opts || opts.payload !== null) {
    assert(/^hello$/.test(msg.payload()))
  } else {
    assert(msg.payload() === null)
  }
  
  assert(msg.header().version == Eventcast.protocolVersion)
  assert(msg.header().encrypted == (opts && opts.encrypted ? 1 : 0))
}

function checkMeta(msg, opts) {
  if (opts && opts.encrypted) {
    assert(msg.meta().nonce)
    assert(msg.meta().nonce.length === 40)
  }
}




describe('Sending events', function () {
  describe('Plain text', function () {
    var opts, server1, server2
    
    beforeEach(function(done) {
      opts = getOpts()

      server1 = new Eventcast(opts)
      server2 = Eventcast(opts) // call without new
      
      server1.start(function(){
        server2.start(function() {
          done()
        })
      })
    })
    
    afterEach(function(done) {
      server1.stop(function(){
        server2.stop(done)
      })
    })
    
    it('can see each other, no arguments', function (done) {
      var messageCount = 0

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('heyoo', function(msg){
          assert(msg === undefined)

          if (++messageCount == 4) {
            done()
          }
        })
      })

      server1.emit('heyoo')
      server2.emit('heyoo')
    })
    
    it('can see each other, one argument', function (done) {
      var messageCount = 0

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('heyoo', function(msg){
          assert(msg === 'howdy neighborino!')

          if (++messageCount == 4) {
            done()
          }
        })
      })
      
      server1.emit('heyoo', 'howdy neighborino!')
      server2.emit('heyoo', 'howdy neighborino!')
    })

    it('can see each other, multiple arguments', function (done) {
      var messageCount = 0

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('heyoo', function(obj, arr, nul, str, num){
          assert.deepEqual(obj, {obj: 2})
          assert.deepEqual(arr, [1,2,3])
          assert.strictEqual(nul, null)
          assert.strictEqual(str, 'yay')
          assert.strictEqual(num, 5)

          if (++messageCount == 4) {
            done()
          }
        })
      })

      server1.emit('heyoo', {obj: 2}, [1,2,3], null, 'yay', 5)
      server2.emit('heyoo', {obj: 2}, [1,2,3], null, 'yay', 5)
    })
  })

  describe('Encrypted', function () {
    var opts, server1, server2

    beforeEach(function(done) {
      opts = getOpts({encrypt:{key: 'NSA-KEY'}})

      server1 = new Eventcast(opts)
      server2 = new Eventcast(opts)

      server1.start(function(){
        server2.start(function() {
          done()
        })
      })
    })

    afterEach(function(done) {
      server1.stop(function(){
        server2.stop(done)
      })
    })
    
    it('can see each other, no arguments', function (done) {
      var messageCount = 0

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('heyoo', function(msg){
          assert(msg === undefined)

          if (++messageCount == 4) {
            done()
          }
        })
      })

      server1.emit('heyoo')
      server2.emit('heyoo')
    })

    it('can see each other, one argument', function (done) {
      var messageCount = 0

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('heyoo', function(msg){
          assert(msg === 'howdy neighborino!')

          if (++messageCount == 4) {
            done()
          }
        })
      })

      server1.emit('heyoo', 'howdy neighborino!')
      server2.emit('heyoo', 'howdy neighborino!')
    })

    it('can see each other, multiple arguments', function (done) {
      var messageCount = 0

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('heyoo', function(obj, arr, nul, str, num){
          assert.deepEqual(obj, {obj: 2})
          assert.deepEqual(arr, [1,2,3])
          assert.strictEqual(nul, null)
          assert.strictEqual(str, 'yay')
          assert.strictEqual(num, 5)

          if (++messageCount == 4) {
            done()
          }
        })
      })

      server1.emit('heyoo', {obj: 2}, [1,2,3], null, 'yay', 5)
      server2.emit('heyoo', {obj: 2}, [1,2,3], null, 'yay', 5)
    })
  })
})



describe('Start/stop', function () {
  it('do not require callbacks', function(done) {
    var opts = Eventcast.getRandomPort()
      , server1 = new Eventcast(opts)
      , server2 = new Eventcast(opts)

    server1.start()
    server2.start()
    
    setImmediate(function() {
      server1.stop()
      server2.stop()
      
      setImmediate(function() {
        done()
      })
    })
  });

  it('are idempotent', function(done) {
    var opts = Eventcast.getRandomPort()
      , server1 = new Eventcast(opts)

    server1.start()
    server1.start()
    server1.start()
    server1.start()

    setImmediate(function() {
      server1.start()
      server1.stop()
      server1.stop()
      server1.stop()
      server1.stop()

      setImmediate(function() {
        server1.stop()
        done()
      })
    })
  });

  it('does not leak memory', function(done) {
    this.slow(500)
    
    var opts = Eventcast.getRandomPort()
      , server1 = new Eventcast(opts)
      , server2 = new Eventcast(opts)
    
    function stop(fn) {
      server1.stop(function(){
        server2.stop(fn)
      })
    }

    function start(fn) {
      server1.start(function(){
        server2.start(fn)
      })
    }

    var i = 1000
    
    function loop() {
      start(function() {
        setImmediate(function() {
          stop(function() {
            --i > 0 ? loop() : test()
          })
        })
      })
    }

    function test() {
      assert(server1.server.listeners('message').length === 0)
      assert(server2.server.listeners('message').length === 0)
      done()
    }
    
    loop()
  })
})




describe('Errors', function () {
  describe('incompatible messages', function() {
    var opts, server1, server2

    beforeEach(function(done) {
      opts = getOpts()

      server1 = new Eventcast(opts)
      server2 = new Eventcast(opts)

      server1.start(function(){
        server2.start(function() {
          done()
        })
      })
    })

    afterEach(function(done) {
      server1.stop(function(){
        server2.stop(done)
      })
    })

    it('invalid protocol version', function (done) {
      this.slow(500)
      
      var once = true
      var v = Eventcast.protocolVersion
      
      server1.on('error', function(e) {
        assert(e.code === 'EPRVERSION')
        Eventcast.protocolVersion = v
        
        // wait for 'foo' to trigger, just in case
        setTimeout(function() {
          done()
        }, 200)
      })

      server1.on('foo', function(msg) {
        assert(once)
        assert(msg === 'bar')
        once = !once
      })      
      
      server2.on('error', function(e) {}) // so it doesn't crash
      
      server1.emit('foo', 'bar')
      
      Eventcast.protocolVersion = 420
    })
    
    it('invalid encryption version', function (done) {
      this.slow(500)

      var once = true
        , count = 0

      server1.on('error', function(e) {
        assert(e.code === 'EENCRYPT')
        server1.config.encrypt = false
        
        // wait for 'foo' to trigger, just in case
        setTimeout(function() {
          if (++count == 2) done()
        }, 200)
      })

      server2.on('error', function(e) {
        assert(e.code === 'EENCRYPT')
        server2.config.encrypt = false

        // wait for 'foo' to trigger, just in case
        setTimeout(function() {
          if (++count == 2) done()
        }, 200)
      })
      
      server1.on('foo', function(msg) {
        assert(once)
        assert(msg === 'bar')
        once = !once
      })

      server2.on('foo', function(msg) {
        assert(once)
        assert(msg === 'bar')
        once = !once
      })
      
      server1.emit('foo', 'bar')
      
      server1.config.encrypt = true
      server2.config.encrypt = true
    })
  })

  it('emit when server is stopped', function(done) {
    var server1 = new Eventcast()

    server1.on('foo', done)
    
    server1.emit('foo')
  })
})



describe('Log level', function() {
  it('get', function() {
    var server1 = new Eventcast()
    
    // 60 because it's set in lib/Logger to 60 when NODE_ENV=test
    assert.deepEqual(server1.logLevel(), [60])
  })
  
  it('set level', function() {
    var server1 = new Eventcast()

    server1.logLevel(50)
    assert.deepEqual(server1.logLevel(), [50])
  })
  
  it('set level and component', function() {
    var server1 = new Eventcast()

    server1.logLevel('eventcast', 50)
    assert.deepEqual(server1.logLevel(), [50])
  })
  
  it('set invalid', function() {
    var server1 = new Eventcast()

    // nothing happens
    server1.logLevel(9001)
  })
})
    


describe('REPL', function() {
  it('accepts connections', function(done) {
    var counter = 0
    
    var server1 = new Eventcast({
      replPort: 33333
    })

    setTimeout(function() {
      var sock = net.connect(33333)

      sock.on('connect', function () {
        setTimeout(function() {
          sock.destroy()
        }, 200)
      })
    }, 500)

    server1.on('replConnected', function() {
      assert(server1.replClients === 1)
      counter++
    })

    server1.on('replDisonnected', function() {
      assert(server1.replClients === 0)
      counter++
      assert(counter === 2)
      done()
    })
  })
})


describe('Utilities', function() {
  it('getRandomPort', function() {
    var i = 1000000
      , p
    
    while (--i > 0) {
      p = Eventcast.getRandomPort() 
      assert(p >= 49152 && p<= 65535)
    }


    i = 10000
    while (--i > 0) {
      p = Eventcast.getRandomPort(1, 10)
      assert(p >= 1 && p<= 10)
    }
  })
})
  