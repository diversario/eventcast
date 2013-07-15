var Eventcast = require('../')
  , assert = require('assert')


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
})
    