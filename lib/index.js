var dgram = require('dgram')
  , crypto = require('crypto')
  , EE = require('events').EventEmitter
  , util = require('util')

  , _ = require('lodash')
  , debug = require('debug')('disco')
  , ip = require('ip')

module.exports = Disco



/**
 * Default configuration values
 */
var defaultConfig = {
  defaultInterval: 5000,
  bindAddress: '',
  port: null,
  multicastMembership: '239.255.255.250',
  multicastLoopback: true,
  multicastTtl: 3,
  destinationAddress: '224.0.0.1',
  encrypt: false
}



/**
 *
 * @param {Object} opts Options map, overrides default configuration.
 * @returns {Disco}
 * @constructor
 */
function Disco(opts) {
  if (!(this instanceof Disco)) {
    return new Disco(opts)
  }

  EE.call(this)
  this.init(opts)
}

Disco.protocolVersion = 1

util.inherits(Disco, EE)



/**
 * Initialization.
 * @param {Object} opts Options map passed to the constructor.
 */
Disco.prototype.init = function init(opts) {
  this.server = dgram.createSocket('udp4')
  this.client = dgram.createSocket('udp4')
  this.config = _.cloneDeep(opts || {})
  this.events = {}

  _.defaults(this.config, defaultConfig)

  this.config.port = this.config.port || getRandomPort()

  Object.defineProperty(this, 'id', {
    'value': this.config.id || crypto.randomBytes(8).toString('hex'),
    'writable': false
  })

  this.setStatus('stopped')
}



/**
 * Kicks off network activity.
 * Attaches `message` listener on the UDP server
 * from which messages are processed.
 * 
 * Binds server to port and attaches event handlers.
 */
Disco.prototype.start = function start(cb) {
  var self = this

  self.server.on('message', function (_msg, rinfo) {
    var msg = self.parseMessage(_msg)
    self.receiveMessage(msg)
  })

  self.bind(function () {
    self.emit('start')
    self.setStatus('started')

    Object.keys(self.events).forEach(self.scheduleEvent.bind(self))
    
    cb && cb()
  })
}



/**
 * Unbinds the server and removes listeners.
 */
Disco.prototype.stop = function stop(cb) {
  var self = this

  self.server.on('close', cb)

  self.server.close()
  self.emit('stop')
  self.server.removeAllListeners()
  self.setStatus('stopped')
  debug('stopped')
}



/**
 * Binds server to a port and creates multicast subscription.
 */
Disco.prototype.bind = function bind(cb) {
  var self = this

  function ready() {
    var address = self.server.address()

    self.server.addMembership(self.config.multicastMembership)
    self.server.setMulticastLoopback(self.config.multicastLoopback)
    self.server.setMulticastTTL(self.config.multicastTtl)

    debug("server listening " + address.address + ":" + address.port)

    cb()
  }

  self.server.bind(self.config.port, self.config.bindAddress, ready)
}



/**
 * Schedules `event` to run periodically.
 * Unschedules `event` before scheduling.
 * 
 * @param event
 */
Disco.prototype.scheduleEvent = function scheduleEvent(event) {
  var self = this
  
  self.unscheduleEvent(event)
  
  self.events[event].timer = setInterval(function () {
    self.dispatchMessage(event)
  }, self.events[event].interval)
}



/**
 * Stops `event` timer.
 * @param event
 */
Disco.prototype.unscheduleEvent = function unscheduleEvents(event) {
  clearInterval(this.events[event].timer)
}



/**
 * If `event` has a handler - triggers that handler,
 * otherwise emits `message` event with `msg`.
 * 
 * @param {Object} msg
 */
Disco.prototype.receiveMessage = function receiveMessage(msg) {
  if (this.events[msg.name].handler) this.events[msg.name].handler(msg)
  else this.emit('message', msg)
}



/**
 * Sends an outgoing event.
 */
Disco.prototype.dispatchMessage = function dispatchMessage(event) {
  debug('firing event ' + event)

  var header = this.constructHeader()
    , body = this.constructBody(event, this.events[event].payload)
  
  var message = new Buffer(header + body)
  
  this.client.send(message, 0, message.length, this.config.port, this.config.destinationAddress)
}



/**
 * Constructs the message header.
 * 
 * @returns {String}
 */
Disco.prototype.constructHeader = function constructHeader() {
  var version = padString(Disco.protocolVersion.toString(), 3)
    , encrypted = !!this.config.encrypt | 0

  return version + encrypted
}



/**
 * Constructs the message body.
 * Takes care of payload and encryption.
 * 
 * @param name
 * @param payload
 * @returns {String}
 */
Disco.prototype.constructBody = function constructBody(name, payload) {
  var body = {
    name: name,
    address: ip.address() + ':' + this.config.port,
    id: this.id,
    time: new Date().toISOString()
  }

  if (payload) body.payload = this.constructPayload(payload)

  var str = JSON.stringify(body)
  
  return this.config.encrypt ? this.encryptBody(str) : str 
}



/**
 * Constructs the message payload. 
 * @param payload
 * @returns {String}
 */
Disco.prototype.constructPayload = function constructPayload(payload) {
  return JSON.stringify(payload)
}



/**
 * Parses an incoming message.
 * 
 * 
 * @param msg
 * @returns {*}
 */
Disco.prototype.parseMessage = function parseMessage(msg) {
  var header = this.parseHeader(msg.slice(0, 4))
  
  if (header.version !== Disco.protocolVersion) {
    throw new Error('Protocol version mismatch: expected ' + 
                    Disco.protocolVersion + ', got ' + header.version)
  }
  
  if (header.encrypt !== !!this.config.encrypt) {
    throw new Error('Encryption mismatch: expect messages to be' +
                    (this.config.encrypt ? '' : ' not') + ' encrypted')
  }
  
  var body = this.parseBody(msg.slice(4))
  body.payload = this.parsePayload(body.payload)
  
  return body
}



/**
 * Parses message header
 * 
 * @param header
 * @returns {Object}
 */
Disco.prototype.parseHeader = function parseHeader(header) {
  return {
    version: parseInt(header.slice(0, 3).toString(), 10),
    encrypt: !!parseInt(header.slice(3,4).toString(), 10)
  }
}



/**
 * Parses message body.
 * 
 * @param body
 * @returns {Object}
 */
Disco.prototype.parseBody = function parseBody(body) {
  return this.config.encrypt ? JSON.parse(this.decryptBody(body))
                             : JSON.parse(body.toString())
}



/**
 * Parses message payload
 * 
 * @param payload
 * @returns {Object|null}
 */
Disco.prototype.parsePayload = function parsePayload(payload) {
  return payload ? JSON.parse(payload) : null
}



/**
 * Encrypts given string `str` with AES-128 and key from Disco#config.encrypt.key
 *
 * @param {String} str Plain-text input
 * @return {String}
 */
Disco.prototype.encryptBody = function encryptBody(str) {
  var cipher = crypto.createCipher('aes128', this.config.encrypt.key)

  var payload = cipher.update(str, 'binary', 'base64')
  payload += cipher.final('base64')

  return payload
}



/**
 * Decrypts given string `str` with AES-128 and key from Disco#config.encrypt.key
 *
 * @param {Buffer} buf Encrypted input
 * @return {String}
 */
Disco.prototype.decryptBody = function decryptBody(buf) {
  var decipher = crypto.createDecipher('aes128', this.config.encrypt.key)

  var decipheredMessage = decipher.update(Buffer(buf.toString(), 'base64')) // not sure why I need to recreate a Buffer here
  decipheredMessage += decipher.final()

  return decipheredMessage
}



/**
 * Schedules a message `event.name` to be sent out every `event.interval` ms
 * with an optional `payload`. `handler` is a function to invoke
 * when this message is received on this node (i. e., a callback).
 *
 * @param event
 * @param payload
 * @param handler
 */
Disco.prototype.set = function (event, payload, handler) {
  if (typeof event == 'string') {
    event = {name: event, interval: this.config.defaultInterval}
  }
  
  if (this.events[event.name]) {
    this.unset(event.name)
  }

  this.events[event.name] = {
    name: event.name,
    interval: event.interval,
    payload: payload,
    handler: handler,
    timer: null
  }
}



/**
 * Removes and unschedules the event.
 * @param eventName
 */
Disco.prototype.unset = function (eventName) {
  this.unscheduleEvent(eventName)
  delete this.events[eventName]
}



/**
 * Sets `status` property on the instance
 * and emits `status` value.
 * 
 * @param status
 */
Disco.prototype.setStatus = function setStatus(status) {
  switch (status) {
    case 'stopped':
      this.emit('stop')
      break
    case 'started':
      this.emit('start')
      break
    default:
      throw new Error('Status "' + status + '" is not valid.')
  }

  this.status = status
}



/**
 * Returns random port number between 10000 and 65535 (by default).
 *
 * @param [min]
 * @param [max]
 * @return {Number}
 */
function getRandomPort(min, max) {
  if (min == null) min = 49152
  if (max == null) max = 65535

  return min + Math.floor(Math.random() * (max - min + 1))
}



/**
 * Formats given objects for use with debug.
 * Accepts arbitrary number of objects.
 */
function str() {
  var string = '\n'
    
  ;[].slice.call(arguments).forEach(function (obj) {
    string += JSON.stringify(obj, null, '  ')
  })
  
  return string
}



/**
 * Adds right padding to the `str` until it's `length` long.
 * Optional `char` used for padding defaults to a space character.
 * 
 * @param str
 * @param length
 * @param char
 * @returns {*}
 */
function padString(str, length, char) {
  if (!char) char = ' '
  while (str.length < length) str += char
  return str
}



if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() == 'test') {
  module.exports.getRandomPort = getRandomPort
  module.exports.padString = padString
}