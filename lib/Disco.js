var dgram = require('dgram')
  , crypto = require('crypto')
  , EE = require('events').EventEmitter
  , util = require('util')
  , repl = require('repl')
  , net = require('net')
  
  , _ = require('lodash')
  , ip = require('ip')

  , Message = require('./Message')
  , Node = require('./Node')
  , NodeList = require('./NodeList')
  , Event = require('./Event')
  , EventList = require('./EventList')
  
  , Logger = require('./Logger')

module.exports = Disco



/**
 * Default configuration values
 */
var defaultConfig = {
  address: '', // = '0.0.0.0'
  port: null, // random
  
  defaultInterval: 1000,
  discoveryInterval: 1000,
  
  multicastMembership: '239.255.255.250',
  multicastInterface: null,
  multicastLoopback: true, // must be enabled for multiple instances to see each other on the same machine
  multicastTtl: 3,
  
  replPort: null, // random
  replHost: 'localhost',
  
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
  this._startRepl()
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
  if (typeof opts == 'number') opts = {port: opts}
  
  this.config = _.extend(_.cloneDeep(defaultConfig), _.cloneDeep(opts || {}))

  this.config.port = this.config.port || getRandomPort()
  this.config.replPort = this.config.replPort || getRandomPort()
  this.config.id = this.config.id || crypto.randomBytes(8).toString('hex')
  
  // create logger instance after configuration is completed
  this.log = Logger(this.config)
  
  this.Message = Message(this)

  Object.defineProperty(this, 'id', {
    'value': this.config.id,
    'writable': false
  })

  this.node = new Node({
    id: this.id,
    address: this.getAddress()
  })
  
  this.nodes = new NodeList(this.node)
  this.events = new EventList
  
//  this._attachDiscoveryProbe()
  
  this._setStatus('stopped')
  
  this.log.disco.debug('Disco instance created')
}



/**
 * Creates REPL and exposes `this` as `disco` object.
 * 
 * Example:
 *  $> telnet 127.0.0.1 9001
 *  Trying 127.0.0.1...
 *  Connected to localhost.
 *  Escape character is '^]'.
 *  disco>
 * 
 * @private
 */
Disco.prototype._startRepl = function _startRepl() {
  var self = this
  
  this.replClients = 0
  
  net.createServer(function (socket) {
    repl.start({
      prompt: 'disco> ',
      input: socket,
      output: socket
    })
    .on('exit', function() {
      self.replClients--
      self.log.repl.info('Client disconnected. Total clients: ' + self.replClients)
      socket.end();
    })
    .context.disco = self
  })
  .on('connection', function() {
    self.replClients++
    self.log.repl.info('Client connected. Total clients: ' + self.replClients)
  })
  .listen(this.config.replPort, this.config.replHost, function() {
    self.log.repl.info('REPL started.')
  })
}



Disco.prototype.emit = function emit() {
  var _arguments = [].slice.call(arguments)
    , evtName = _arguments[0]
    , args = _arguments.slice(1)
  
  var event = new Event({
    name: evtName,
    payload: args
  })
  
  this._dispatchMessage(event)
  this._emit.apply(this, _arguments)
}


Disco.prototype._emit = function _emit() {
  return EE.prototype.emit.apply(this, [].slice.call(arguments))
}



/**
 * Sets log level.
 * 
 * @param {String} [component] Logger to set level for, e.g. 'disco', 'repl'. Defaults to 'disco'.
 * @param {String} level Log level - TRACE, DEBUG, INFO, WARN, ERROR, FATAL 
 */
Disco.prototype.logLevel = function logLevel(component, level) {
  if (!component && !level) return this.log.disco.levels()
  
  if (!level) {
    level = component
    component = 'disco'
  }
  
  if (typeof level == 'string' && this.log._logger[level]) {
    this.log[component].level(level)
  } else {
    this.log.disco.warn('Unknown log level "' + level + '".')
  }
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
      interval: this.config.discoveryInterval
    },
    payload || 'hello',
    discovery.bind(this)
  )
  
  this.log.disco.debug('Discovery probe attached.')
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

  if (this.status != 'stopped') {
    cb && cb()
    return
  }
  
  this.events.each(function (event) {
    self.on(event.name, function (message) {
      event.handler && event.handler.call(self, message)
    })
  })

  self.server = dgram.createSocket('udp4')
  
  self.server.on('message', function (_msg, rinfo) {
    var msg = new self.Message.IncomingMessage(_msg)
    self._receiveMessage(msg, rinfo)
  })

  self._bind(function () {
    self._emit('start')
    self._setStatus('started')

    self.log.disco.debug('UDP server started.')
    
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

  if (this.status != 'started') {
    cb && cb()
    return
  }

  this.events.each(function (event) {
    self.removeAllListeners(event.name)
  })

  this.events.unschedule()

  if (cb) self.server.on('close', cb)
  
  self.server.dropMembership(self.config.multicastMembership, self.config.multicastInterface)
  self.server.close()
  self.server.removeAllListeners()
  
  self._emit('stop')
  
  self._setStatus('stopped')
  
  this.log.disco.debug('UDP server stopped.')
  
  return true
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

    self.server.setMulticastTTL(self.config.multicastTtl)
    self.server.setMulticastLoopback(self.config.multicastLoopback)
    self.server.addMembership(self.config.multicastMembership, self.config.multicastInterface)

    self.log.disco.info('UDP server started', address)

    cb()
  }

  self.server.bind(self.config.port, self.config.address, ready)
}



/**
 * If `event` has a handler - triggers that handler,
 * otherwise emits `message` event with `msg`.
 * 
 * @param {IncomingMessage} msg
 * @param {Object} rinfo Remote host information
 * @private
 */
Disco.prototype._receiveMessage = function _receiveMessage(msg, rinfo) {
  this.log.disco.info('Incoming message', msg.meta())
  this.log.disco.debug(
    'Incoming message:\n',
    {
      name: msg.meta().name,
      header: msg.header(),
      meta: msg.meta(),
      payload: msg.payload()
    }
  )
  
  var e = this._compatibilityCheck(msg)
  
  if (e) return this._emit('error', e, msg)
  
//  var event = this.events.findBy('name', msg.meta().name)
//  
//  if (!event) {
//    this.log.disco.info('Unrecognized event in message ' + msg.meta().name)
//  } else {
//    this._emit(event.name, msg)
//  }

  this._emit(msg.meta().name, msg.payload())
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
  this.log.disco.debug(
    'Sending message',
    {
      name: event.name,
      payload: event.payload
    }
  )
  
  var message = new this.Message.OutgoingMessage(
    event.name,
    event.payload
  ).toBuffer()
  
  this.server.send(
    message, 
    0, 
    message.length, 
    this.config.port, 
    this.config.multicastMembership
  )
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
      this._emit('stop')
      break
    case 'started':
      this._emit('start')
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
  if (max == null) max = 65535 - 1 // -1 to leave 1 port for REPL

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