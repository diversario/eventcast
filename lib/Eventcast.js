var dgram = require('dgram')
  , crypto = require('crypto')
  , EE = require('events').EventEmitter
  , util = require('util')
  , os = require('os')
  
  , _ = require('lodash')
  , ip = require('ip')
  , repl = require('replize')
  , async = require('async')

  , Message = require('./Message')
  , MessageBuffer = require('./MessageBuffer')
  , Event = require('./Event')
  
  , Logger = require('./Logger')

module.exports = Eventcast



/**
 * Default configuration values
 */
var defaultConfig = {
  address: '', // = '0.0.0.0'
  port: null, // random
  
  multicastMembership: '224.0.0.1',
  multicastInterface: null,
  multicastLoopback: true, // must be enabled for multiple instances to see each other on the same machine
  multicastTtl: 3,
  
  replPort: null, // random
  replHost: 'localhost',
  
  encrypt: false,

  maxPayloadSize: 1024,
  
  messageTtl: 3000
}



/**
 * @param {Object|Number} opts Options map that overrides default configuration
 *  or a port number.
 * @returns {Eventcast}
 * @constructor
 */
function Eventcast(opts) {
  if (!(this instanceof Eventcast)) {
    return new Eventcast(opts)
  }

  EE.call(this)
  
  this._init(opts)
  this._startRepl()
}

util.inherits(Eventcast, EE)



/**
 * Message framing protocol version.
 * @type {number}
 */
Eventcast.protocolVersion = 3



/**
 * Initialized this instance with optional `opts`.
 * 
 * @param {Object|Number} [opts]
 * @private
 */
Eventcast.prototype._init = function _init(opts) {
  if (typeof opts == 'number') opts = {port: opts}
  
  this.config = _.extend(_.cloneDeep(defaultConfig), _.cloneDeep(opts || {}))

  this.config.port = this.config.port || Eventcast.getRandomPort()
  this.config.replPort = this.config.replPort || Eventcast.getRandomPort()
  this.config.id = this.config.id || crypto.randomBytes(8).toString('hex')
  
  // create logger instance after configuration is completed
  this.log = Logger(this.config)
  
  this.Message = Message(this)

  this.messageBuffer = new MessageBuffer(this.config)
  
  Object.defineProperty(this, 'id', {
    'value': this.config.id,
    'writable': false
  })
  
  this._setStatus('stopped')
  
  this.log.eventcast.debug('Eventcast instance created')
}



/**
 * Creates REPL and exposes `this` as `eventcast` object.
 * 
 * Example:
 *  $> telnet 127.0.0.1 9001
 *  Trying 127.0.0.1...
 *  Connected to localhost.
 *  Escape character is '^]'.
 *  eventcast>
 * 
 * @private
 */
Eventcast.prototype._startRepl = function _startRepl() {
  var self = this
  
  this.repl = repl({
    port: this.config.replPort,
    host: this.config.replHost,
    context: {ec: self},
    prompt: 'eventcast@' + os.hostname() + '> '
  })

  this.repl.on('replConnected', function (c) {
    self._emit('replConnected')
    self.log.repl.info('Client connected. Total clients:', c)
  })

  this.repl.on('replDisconnected', function (c) {
    self._emit('replDisconnected')
    self.log.repl.info('Client disconnected. Total clients:', c)
  })
  
  this.clients = this.repl.clients.bind(this.repl)

  this.repl.start()
}



/**
 * Sends a network message and emits on self.
 */
Eventcast.prototype.emit = function emit() {
  var _arguments = [].slice.call(arguments)
    , evtName = _arguments[0]
    , args = _arguments.slice(1)
  
  var event = new Event({
    name: evtName,
    payload: args
  })
  
  this._dispatchMessage(event)
  return this._emit.apply(this, _arguments)
}



/**
 * Emits event on self.
 * @returns {*}
 * @private
 */
Eventcast.prototype._emit = function _emit() {
  return EE.prototype.emit.apply(this, [].slice.call(arguments))
}



/**
 * Binds UDP server and joins multicast membership.
 * 
 * @param cb
 * @private
 */
Eventcast.prototype._bind = function _bind(cb) {
  var self = this

  function ready() {
    var address = self.server.address()

    self.server.setMulticastTTL(self.config.multicastTtl)
    self.server.setMulticastLoopback(self.config.multicastLoopback)
    self.server.addMembership(self.config.multicastMembership, self.config.multicastInterface)

    self.log.eventcast.info('UDP server started', address)

    cb()
  }

  self.server.bind(self.config.port, self.config.address, ready)
}



/**
 * Sends an outgoing event.
 *
 * @param {Event} event Event to send
 * @private
 */
Eventcast.prototype._dispatchMessage = function _dispatchMessage(event) {
  var self = this

  if (this.status !== 'started') {
    return this.log.eventcast.warn('Event emitted when server is not running', event)
  }

  this.log.eventcast.debug(
    'Sending message',
    {
      name: event.name,
      payload: event.payload
    }
  )

  var message

  var msg = new this.Message.OutgoingMessage(
    event.name,
    event.payload
  )

  if (msg.toBuffer().length > this.config.maxPayloadSize) {
    message = msg.toChunks(this.config.maxPayloadSize)
  } else {
    message = [msg]
  }

  async.eachSeries(message, function(_m, cb) {
    var m = _m.toBuffer()

    self.server.send(
      m,
      0,
      m.length,
      self.config.port,
      self.config.multicastMembership, function () {
        setImmediate(cb)
      }
    )
  }, function(err) {
    if (err) throw err
  })
}



/**
 * If `event` has a handler - triggers that handler,
 * otherwise emits `message` event with `msg`.
 * 
 * @param {IncomingMessage} msg
 * @param {Object} rinfo Remote host information
 * @private
 */
Eventcast.prototype._receiveMessage = function _receiveMessage(msg, rinfo) {
  var e = this._compatibilityCheck(msg)
  
  if (e) return this._emit('error', e, msg)
  
  this.log.eventcast.info('Incoming message', msg.meta())
  this.log.eventcast.debug(
    'Incoming message:\n',
    {
      name: msg.meta().name,
      header: msg.header(),
      meta: msg.meta(),
      payload: msg.payload()
    }
  )

  var message
    , seqId = msg.meta().seqId
    , seq = msg.meta().seq
  
  if (msg.isMultipart()) {
    this.messageBuffer.bufferIncoming(msg, seqId, seq)
    if (this.messageBuffer.isComplete(seqId)) {
      message = new this.Message.IncomingMessage(this.messageBuffer.getIncomingBuffer(seqId))
    } else {
      return
    }
  } else {
    message = msg
  }

  var args = [message.meta().name].concat(message.payload())
  this._emit.apply(this, args)
}



/**
 * Verifies that `msg` can be processed.
 * Checks for protocol version and encryption mismatch
 * 
 * @param {Message} msg
 * @returns {Error|null}
 * @private
 */
Eventcast.prototype._compatibilityCheck = function _compatibilityCheck(msg) {
  var meta = msg.meta()
    , error = null

  if (meta.v !== Eventcast.protocolVersion) {
    error = new Error('Protocol version mismatch: expected ' + 
                        Eventcast.protocolVersion + ', got ' + meta.v)
    error.code = 'EPRVERSION'
  }

  return error
}



/**
 * Sets `status` property on the instance and emits `status` value.
 * 
 * @param {String} status Status to set
 * @private
 */
Eventcast.prototype._setStatus = function _setStatus(status) {
  switch (status) {
    case 'stopped':
      this._emit('stop')
      break
    case 'started':
      this._emit('start')
      break
  }

  this.status = status
}



/**
 * Kicks off network activity.
 * Attaches `message` listener on the UDP server
 * from which messages are processed.
 *
 * Binds server to port and attaches event handlers.
 */
Eventcast.prototype.start = function start(cb) {
  var self = this

  if (this.status != 'stopped') {
    cb && cb()
    return
  }

  self._setStatus('starting')

  self.server = dgram.createSocket('udp4')

  self.server.on('message', function (_msg, rinfo) {
    var msg = new self.Message.IncomingMessage(_msg)
    self._receiveMessage(msg, rinfo)
  })

  self._bind(function () {
    self._emit('start')
    self._setStatus('started')

    self.log.eventcast.debug('UDP server started.')

    cb && cb()
  })
}



/**
 * Unbinds the server, removes listeners,
 * stops event timers.
 */
Eventcast.prototype.stop = function stop(cb) {
  var self = this

  if (this.status != 'started') {
    cb && cb()
    return
  }

  self._setStatus('stopping')

  if (cb) self.server.on('close', cb)

  self.server.dropMembership(self.config.multicastMembership, self.config.multicastInterface)
  self.server.close()
  self.server.removeAllListeners()

  self._emit('stop')

  self._setStatus('stopped')

  this.log.eventcast.debug('UDP server stopped.')

  return true
}



/**
 * Sets log level.
 *
 * @param {String} [component] Logger to set level for, e.g. 'eventcast', 'repl'. Defaults to 'eventcast'.
 * @param {String} level Log level - TRACE, DEBUG, INFO, WARN, ERROR, FATAL
 */
Eventcast.prototype.logLevel = function logLevel(component, level) {
  if (!component && !level) return this.log.eventcast.levels()

  if (!level) {
    level = component
    component = 'eventcast'
  }

  try {
    this.log._logger.resolveLevel(level)
  } catch(e) {
    return this.log.eventcast.warn('Unknown log level "' + level + '".')
  }

  this.log[component].level(level)
}



/**
 * Returns `host:port` string for `this` instance. 
 * @returns {String}
 */
Eventcast.prototype.getAddress = function () {
  return ip.address() + ':' + this.config.port
}



/**
 * Returns random port number between 49152 and 65535 (by default).
 * Defaults are based on RFC6335, section 6.
 *
 * @param {Number} [min]
 * @param {Number} [max]
 * @return {Number}
 */
Eventcast.getRandomPort = function getRandomPort(min, max) {
  if (min == null) min = 49152
  if (max == null) max = 65535

  return min + Math.floor(Math.random() * (max - min + 1))
}