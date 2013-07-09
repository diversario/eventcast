var dgram = require('dgram')
  , crypto = require('crypto')
  , EE = require('events').EventEmitter
  , util = require('util')

  , _ = require('lodash')
  , debug = require('debug')('disco')
  , ip = require('ip')

  , Message = require('./Message')
  , Node = require('./Node')
  , NodeList = require('./NodeList')
  , Event = require('./Event')
  , EventList = require('./EventList')

module.exports = Disco



/**
 * Default configuration values
 */
var defaultConfig = {
  defaultInterval: 5000,
  bindAddress: '',
  port: null,
  multicastMembership: '239.255.255.250',
  multicastLoopback: false,
  multicastTtl: 3,
  destinationAddress: '224.0.0.1',
  encrypt: false
}



/**
 * @param {Object|Number} opts Options map that overrides default configuration
 *  or a port number.
 * @returns {Disco}
 * @constructor
 */
function Disco(opts) {
  if (!(this instanceof Disco)) {
    return new Disco(opts)
  }

  EE.call(this)
  this._init(opts)
}

util.inherits(Disco, EE)



/**
 * Message framing protocol version.
 * @type {number}
 */
Disco.protocolVersion = 2



/**
 * Initialized this instance with optional `opts`.
 * 
 * @param {Object|Number} [opts]
 * @private
 */
Disco.prototype._init = function _init(opts) {
  this.server = dgram.createSocket('udp4')
  this.client = dgram.createSocket('udp4')
  
  if (typeof opts == 'number') opts = {port: opts}
  
  this.config = _.cloneDeep(opts || {})

  _.defaults(this.config, defaultConfig)

  this.config.port = this.config.port || getRandomPort()
  this.Message = Message(this)

  Object.defineProperty(this, 'id', {
    'value': this.config.id || crypto.randomBytes(8).toString('hex'),
    'writable': false
  })

  this.node = new Node({
    id: this.id,
    address: this.getAddress()
  })
  
  this.nodes = new NodeList(this.node)
  this.events = new EventList
  
  this._attachDiscoveryProbe()
  
  this._setStatus('stopped')
}



/**
 * Attaches discovery probe.
 * If called with no arguments - attaches a default
 * discovery probe and default payload.
 * On discovery adds a new node to the list.
 * 
 * @param {*} payload 'discover' event payload
 * @param {Function} fn 'discover' event handler
 * 
 * @private
 */
Disco.prototype._attachDiscoveryProbe = function _attachDiscoveryProbe(payload, fn) {
  if (typeof payload == 'function') {
    fn = payload
    payload = null
  }
  
  /**
   * @this Disco
   * @param msg
   */
  function discovery(msg) {
    var node = new Node({
      id: msg.meta().id,
      address: msg.meta().address
    })
    
    this.addNode(node)
    
    fn && fn.call(this, node, msg)
  }
  
  this.set(
    {
      name: 'discovery',
      interval: 1000
    },
    payload || 'hello',
    discovery.bind(this)
  )
}



/**
 * Sets custom discovery event payload and handler
 * 
 * @param payload
 * @param handler
 */
Disco.prototype.discovery = function discovery(payload, handler) {
  this._attachDiscoveryProbe(payload, handler)
}



/**
 * Returns a list of known nodes.
 * @returns {Array}
 */
Disco.prototype.getNodes = function () {
  return this.nodes.toArray()
}



/**
 * Adds a new node to the node list
 * @param nodeInfo
 */
Disco.prototype.addNode = function (nodeInfo) {
  var node = new Node(nodeInfo)
  this.nodes.add(node)
}



/**
 * Removes a node from known nodes list. 
 * @param nodeInfo
 */
Disco.prototype.removeNode = function (nodeInfo) {
  var node = new Node(nodeInfo)
  this.nodes.remove(node)
}



/**
 * Schedules a message `event.name` to be sent out every `event.interval` ms
 * with an optional `payload`. `handler` is a function to invoke
 * when this message is received on this node (i. e., a callback).
 *
 * @param evtObject
 * @param payload
 * @param handler
 */
Disco.prototype.set = function (evtObject, payload, handler) {
  if (typeof evtObject == 'string') {
    evtObject = {
      name: evtObject, 
      interval: this.config.defaultInterval
    }
  }

  var event = new Event({
    name: evtObject.name,
    interval: evtObject.interval,
    payload: payload,
    handler: handler,
    timer: null
  })
  
  if (this.events.contains(event)) {
    this.unset(event)
  }

  this.events.add(event)
}



/**
 * Removes and unschedules the event.
 * @param event
 */
Disco.prototype.unset = function (event) {
  event.unschedule()
  this.events.remove(event)
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

  this.events.each(function (event) {
    self.on(event.name, function (message) {
      event.handler && event.handler.call(self, message)
    })
  })
  
  self.server.on('message', function (_msg, rinfo) {
    var msg = new self.Message.IncomingMessage(_msg)
    self._receiveMessage(msg)
  })

  self._bind(function () {
    self.emit('start')
    self._setStatus('started')

    self.events.schedule(self._dispatchMessage.bind(self))
    
    cb && cb()
  })
}



/**
 * Unbinds the server, removes listeners,
 * stops event timers.
 */
Disco.prototype.stop = function stop(cb) {
  var self = this

  this.events.unschedule()
  
  self.server.on('close', cb)

  self.server.close()
  self.emit('stop')
  self.server.removeAllListeners()
  self._setStatus('stopped')
  debug('stopped')
}



/**
 * Binds UDP server and joins multicast membership.
 * 
 * @param cb
 * @private
 */
Disco.prototype._bind = function _bind(cb) {
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
 * If `event` has a handler - triggers that handler,
 * otherwise emits `message` event with `msg`.
 * 
 * @param {IncomingMessage} msg
 * @private
 */
Disco.prototype._receiveMessage = function _receiveMessage(msg) {
  debug('--- START MESSAGE: ' + msg.meta().name)
  debug(str(msg.header()))
  debug(str(msg.meta()))
  debug(str(msg.payload()))
  debug('--- END MESSAGE: ' + msg.meta().name)
  
  var e = this._compatibilityCheck(msg)
  
  if (e) return this.emit('error', e, msg)
  
  var event = this.events.findBy('name', msg.meta().name)
  
  if (!event) {
    debug('Unrecognized event from message:', str(msg.meta()))
  } else {
    this.emit(event.name, msg)
  }
}



/**
 * Verifies that `msg` can be processed.
 * Checks for protocol version and encryption mismatch
 * 
 * @param {Message} msg
 * @returns {Error|null}
 * @private
 */
Disco.prototype._compatibilityCheck = function _compatibilityCheck(msg) {
  var header = msg.header()
    , error = null

  if (header.version !== Disco.protocolVersion) {
    error = new Error('Protocol version mismatch: expected ' + 
                        Disco.protocolVersion + ', got ' + header.version)
  }

  if (header.encrypted !== !!this.config.encrypt) {
    error = new Error('Encryption mismatch: expect messages to be' +
                        (this.config.encrypt ? '' : ' not') + ' encrypted')
  }
  
  return error
}



/**
 * Sends an outgoing event.
 * 
 * @param {Event} event Event to send
 * @private
 */
Disco.prototype._dispatchMessage = function _dispatchMessage(event) {
  debug('firing event ', event.name, str(event.payload))
  
  var message = new this.Message.OutgoingMessage(
    event.name,
    event.payload
  ).toBuffer()
  
  this.client.send(
    message, 
    0, 
    message.length, 
    this.config.port, 
    this.config.destinationAddress)
}



/**
 * Sets `status` property on the instance and emits `status` value.
 * 
 * @param {String} status Status to set
 * @private
 */
Disco.prototype._setStatus = function _setStatus(status) {
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
 * Returns `host:port` string for `this` instance. 
 * @returns {String}
 */
Disco.prototype.getAddress = function () {
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