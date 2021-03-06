var Eventcast = require('../')
  , assert = require('assert')
  , net = require('net')
  , BSON = require('bson').BSONPure.BSON

function getOpts(custom) {
  var opts = {
    port: custom && custom.port || Eventcast.getRandomPort(),
    log: custom && custom.log
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



function getBytes(n) {
  var s = ''
  
//  while (s.length < n) s += crypto.randomBytes(1).toString('utf8')
  while (s.length < n) s += 'a'
  return s
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
        , _date = new Date()
        , _rx = /serialize me please/

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('heyoo', function(obj, arr, nul, str, num, date, rx){
          assert.deepEqual(obj, {obj: 2})
          assert.deepEqual(arr, [1,2,3])
          assert.strictEqual(nul, null)
          assert.strictEqual(str, 'yay')
          assert.strictEqual(num, 5)
          
          assert.strictEqual(_date.getTime(), date.getTime())
          assert(date instanceof Date)

          assert.strictEqual(_rx.toString(), rx.toString())
          assert(rx instanceof RegExp)
          
          if (++messageCount == 4) {
            done()
          }
        })
      })

      server1.emit('heyoo', {obj: 2}, [1,2,3], null, 'yay', 5, _date, _rx)
      server2.emit('heyoo', {obj: 2}, [1,2,3], null, 'yay', 5, _date, _rx)
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





describe('Message chunking', function () {
  describe('Plain text', function () {
    it('Returns an array of messages with chunked payload', function () {
      var Message = require('../lib/Message')({
        config: {encrypt: false, maxPayloadSize: 3},
        getAddress: function(){return {host: 'localhost', port: 123}}
      })

      var om = new Message.OutgoingMessage('msg', '123456789').toChunks()

      // let's reassemble the message
      var reassembledMessage = Buffer(0)

      // concatenate the payload chunks
      // and assert some things

      var lastSeq = 0
        , lastSeqId
        , lastSeqEnd
        , totalMsg = om.length

      om.forEach(function (_m, idx) {
        var m = _m.toBuffer()
        var metaLength = m.slice(0,2).readInt16BE(0)
        var meta = BSON.deserialize(m.slice(2, 2+metaLength))

        if (idx === 0) {
          lastSeq = meta.seq
          lastSeqId = meta.seqId
          lastSeqEnd = meta.seqEnd
        }

        assert(meta.seq === idx)
        assert(meta.seqId === lastSeqId)

        if (idx === totalMsg-1) assert(meta.seqEnd === true)
        else assert(meta.seqEnd === false)

        var payload = m.slice(2+metaLength)
        reassembledMessage = Buffer.concat([reassembledMessage, payload])
      })

      // slice out the payload
      var header = reassembledMessage.slice(0, 2)
      var meta = BSON.deserialize(reassembledMessage.slice(2, 2 + header.readInt16BE(0)))
      var payload = reassembledMessage.slice(2 + meta.length)

      // let IM handle the parsing here
      var originalMessage = new Message.IncomingMessage(payload)

      var omHeader = originalMessage.header()
      var omMeta = originalMessage.meta()
      var omPayload = originalMessage.payload()

      assert(omHeader.metaLength === BSON.serialize(omMeta).length)

      assert(omMeta.name === 'msg')
      assert(omMeta.seq === 0)
      assert(omMeta.host === 'localhost')
      assert(omMeta.port === 123)

      assert(omPayload === '123456789')
    })

    it('Same test but using IncomingMessage', function () {
      var Message = require('../lib/Message')({
        config: {encrypt: false, maxPayloadSize: 3},
        getAddress: function(){return {host: 'localhost', port: 123}}
      })

      var MessageBuffer = require('../lib/MessageBuffer')
      
      var _om = new Message.OutgoingMessage('msg', '123456789').toChunks()
      var mb = new MessageBuffer({})
      
      _om.forEach(function (m) {
        var im = new Message.IncomingMessage(m.toBuffer())
        mb.bufferIncoming(im, im.meta().seqId, im.meta().seq)
      })

      // let IM handle the parsing here
      var originalMessage = new Message.IncomingMessage(mb.getIncomingBuffer(_om[0].meta().seqId))

      var omHeader = originalMessage.header()
      var omMeta = originalMessage.meta()
      var omPayload = originalMessage.payload()

      assert(omHeader.metaLength === BSON.serialize(omMeta).length)

      assert(omMeta.name === 'msg')
      assert(omMeta.seq === 0)
      assert(omMeta.host === 'localhost')
      assert(omMeta.port === 123)

      assert(omPayload === '123456789')
    })
  })
  
  
  
  describe('Encrypted', function () {
    it('Returns an array of messages with chunked payload', function () {
      var Message = require('../lib/Message')({
        config: {encrypt: {key: 'WIKILEAKS'}, maxPayloadSize: 3},
        getAddress: function(){return {host: 'localhost', port: 123}}
      })

      var om = new Message.OutgoingMessage('msg', '123456789').toChunks()

      // let's reassemble the message
      var reassembledMessage = Buffer(0)

      // concatenate the payload chunks
      // and assert some things

      var lastSeq = 0
        , lastSeqId
        , lastSeqEnd
        , totalMsg = om.length

      om.forEach(function (_m, idx) {
        var m = _m.toBuffer()
        var metaLength = m.slice(0,2).readInt16BE(0)
        var meta = BSON.deserialize(m.slice(2, 2+metaLength))

        if (idx === 0) {
          lastSeq = meta.seq
          lastSeqId = meta.seqId
          lastSeqEnd = meta.seqEnd
        }

        assert(meta.seq === idx)
        assert(meta.seqId === lastSeqId)

        if (idx === totalMsg-1) assert(meta.seqEnd === true)
        else assert(meta.seqEnd === false)

        var payload = m.slice(2+metaLength)
        reassembledMessage = Buffer.concat([reassembledMessage, payload])
      })

      // slice out the payload
      var header = reassembledMessage.slice(0, 2)
      var meta = BSON.deserialize(reassembledMessage.slice(2, 2 + header.readInt16BE(0)))
      var payload = reassembledMessage.slice(2 + meta.length)

      // let IM handle the parsing here
      var originalMessage = new Message.IncomingMessage(payload)

      var omHeader = originalMessage.header()
      var omMeta = originalMessage.meta()
      var omPayload = originalMessage.payload()

      assert(omHeader.metaLength === BSON.serialize(omMeta).length)

      assert(omMeta.name === 'msg')
      assert(omMeta.seq === 0)
      assert(omMeta.host === 'localhost')
      assert(omMeta.port === 123)

      assert(omPayload === '123456789')
    })

    it('Same test but using IncomingMessage', function () {
      var Message = require('../lib/Message')({
        config: {encrypt: {key: 'SNIFF THIS'}, maxPayloadSize: 3},
        getAddress: function(){return {host: 'localhost', port: 123}}
      })

      var MessageBuffer = require('../lib/MessageBuffer')

      var _om = new Message.OutgoingMessage('msg', '123456789').toChunks()
      var mb = new MessageBuffer({})

      _om.forEach(function (m) {
        var im = new Message.IncomingMessage(m.toBuffer())
        mb.bufferIncoming(im, im.meta().seqId, im.meta().seq)
      })

      // let IM handle the parsing here
      var originalMessage = new Message.IncomingMessage(mb.getIncomingBuffer(_om[0].meta().seqId))

      var omHeader = originalMessage.header()
      var omMeta = originalMessage.meta()
      var omPayload = originalMessage.payload()

      assert(omHeader.metaLength === BSON.serialize(omMeta).length)

      assert(omMeta.name === 'msg')
      assert(omMeta.seq === 0)
      assert(omMeta.host === 'localhost')
      assert(omMeta.port === 123)

      assert(omPayload === '123456789')
    })
  })
})


describe.skip("Unicode chars in payload", function () {

})


describe('Multipart data', function () {
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

  ;[1, 10, 100, 1000].forEach(function (size) {
    it(size + 'KB is received', function (done) {
      this.timeout(6000)
      
      var messageCount = 0
        , str = getBytes(1024 * size)

      assert.notEqual(server1.id, server2.id)

      ;[server1, server2].forEach(function(server){
        server.on('longstring', function(msg){
          assert(msg === str)

          if (++messageCount == 4) {
            done()
          }
        })
      })

      server1.emit('longstring', str)
      server2.emit('longstring', str)
    })
  })
})




describe('Missing packets', function () {
  var opts, server1, server2
    , async = require('async')

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

  it('incomplete messages expire after a timeout', function (done) {
    this.timeout(10000)

    var sentPackets = []
      , emits = 0
      , str = getBytes(1024 * 10)

    server2.messageBuffer.on('miss', function (seqId, missedSeq) {
      emits++
      assert(server2.messageBuffer._incomingMessages[seqId])
      assert(server2.messageBuffer._expired.indexOf(seqId) === -1)
    })

    server2.messageBuffer.on('expired', function (seqId) {
      emits++
      assert(!server2.messageBuffer._incomingMessages[seqId])
      assert(server2.messageBuffer._expired.indexOf(seqId) !== -1)

      if (emits === 2) done()
    })

    server1._dispatchMessage = function (event) {
      var self = this
        , message

      var msg = new this.Message.OutgoingMessage(
        event.name,
        event.payload
      )

      if (msg.toBuffer().length > this.config.maxPayloadSize) {
        message = msg.toChunks(this.config.maxPayloadSize)
      } else {
        message = [msg.toBuffer()]
      }
      
      this.messageBuffer.bufferOutgoing(message)
      
      async.eachSeries(message, function(_m, cb) {
        var m = _m.toBuffer()
        if (process.hrtime()[1] % 2 === 0) {
          self.server.send(m, 0, m.length, self.config.port, self.config.multicastMembership, function () {
              sentPackets.push(_m.meta().seq)
              setImmediate(cb)
            }
          )
        }
        cb()
      }, function(err) {assert(!err)})
    }

    setImmediate(function () {
      server1.emit('longstring', str)
    })
  })
  
  it('`miss` emits array of missing seq numbers', function (done) {
    this.timeout(10000)
    
    var sentPackets = []
      , totalPackets
      , str = getBytes(1024 * 100)

    server2.messageBuffer.on('miss', function (seqId, missedSeq) {
      var merged = sentPackets.concat(missedSeq).sort()
      assert(merged.length == totalPackets);
      done()
    })
    
    server1._dispatchMessage = function (event) {
      var self = this
        , message

      var msg = new this.Message.OutgoingMessage(
        event.name,
        event.payload
      )

      if (msg.toBuffer().length > this.config.maxPayloadSize) {
        message = msg.toChunks(this.config.maxPayloadSize)
      } else {
        message = [msg.toBuffer()]
      }

      totalPackets = message.length
      
      this.messageBuffer.bufferOutgoing(message)
      
      async.eachSeries(message, function(_m, cb) {
        var m = _m.toBuffer()
        if (process.hrtime()[1] % 2 === 0) {
          self.server.send(m, 0, m.length, self.config.port, self.config.multicastMembership, function () {
              sentPackets.push(_m.meta().seq)
              setImmediate(cb)
            }
          )
        }
        cb()
      }, function(err) {assert(!err)})
    }
    
    setImmediate(function () {
      server1.emit('longstring', str)
    })
  })

  it.skip('request retransmission of lost packets', function (done) {
    this.timeout(15000)

    var str = getBytes(1024 * 100)
      , events = []

    server1.messageBuffer.on('miss', function (seqId) {
      events.push('miss')
    })
    
    server1.on('__ec_retx', function (req) {
      events.push('__ec_retx')
    })
    
    server1.on('longstring', function (_str) {
      assert((str + 'linux') === _str)
      setTimeout(done, 5000)
    })
    
    server1._dispatchMessage = function (event) {
      var self = this
        , message

      var msg = new this.Message.OutgoingMessage(
        event.name,
        event.payload
      )

      if (msg.toBuffer().length > this.config.maxPayloadSize) {
        message = msg.toChunks(this.config.maxPayloadSize)
      } else {
        message = [msg.toBuffer()]
      }

      this.messageBuffer.bufferOutgoing(message)
      
      async.eachSeries(message, function(_m, cb) {
        var m = _m.toBuffer()
        if (process.hrtime()[1] % 2 === 0) {
          self._send(m, self.config.multicastMembership, self.config.port, cb)
        } else {
          cb()
        }
      }, function(err) {assert(!err)})
    }

    setTimeout(function () {
      server1.emit('longstring1', str + 'osx')
    }, 5000)
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
  })

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
  })

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
  })

  it('emit when server is stopped', function(done) {
    var server1 = new Eventcast()

    server1.on('foo', done)
    
    server1.emit('foo')
  })
})



describe('Log level', function() {
  it('get', function() {
    var server1 = new Eventcast({log: true})
    
    assert.deepEqual(server1.logLevel(), [50])
  })
  
  it('set level', function() {
    var server1 = new Eventcast({log: true})

    server1.logLevel(50)
    assert.deepEqual(server1.logLevel(), [50])
  })
  
  it('set level and component', function() {
    var server1 = new Eventcast({log: true})

    server1.logLevel('eventcast', 50)
    assert.deepEqual(server1.logLevel(), [50])
  })
  
  it('set invalid', function() {
    var server1 = new Eventcast({log: true})

    // nothing happens
    server1.logLevel(9001)
  })
})
    


describe('REPL', function() {
  it('accepts connections', function(done) {
    var counter = 0
    
    var server1 = new Eventcast({
      replPort: 33333,
      replEnabled: true
    })

    setTimeout(function() {
      var sock = net.connect(33333)
      sock.setNoDelay(true)

      sock.on('connect', function () {
        setTimeout(function() {
          sock.end()
        }, 200)
      })
    }, 500)

    server1.on('replConnected', function() {
      assert(server1.clients() === 1)
      counter++
    })

    server1.on('replDisconnected', function() {
      assert(server1.clients() === 0)
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
  