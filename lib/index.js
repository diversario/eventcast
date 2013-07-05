var dgram = require('dgram')
  , crypto = require('crypto')
  , EE = require('events').EventEmitter
  , util = require('util')

  , _ = require('lodash')
  , debug = require('debug')('disco')
  , ip = require('ip')

  , Message = require('./Message')

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
    var msg = new Message.IncomingMessage(_msg, self).parse()
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
  
  var message = new Message.OutgoingMessage(event, this.events[event].payload, this).toBuffer()
  
  this.client.send(message, 0, message.length, this.config.port, this.config.destinationAddress)
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