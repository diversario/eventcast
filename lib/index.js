var dgram = require('dgram')
  , crypto = require('crypto')
  , EE = require('events').EventEmitter
  , util = require('util')
  
  , _ = require('lodash')
  , debug = require('debug')('disco')



module.exports = Disco



/**
 * Default configuration values
 */
var defaultConfig = {
  announceInterval: 5000,
  bindAddress: '',
  port: null,
  multicastMembership: '239.255.255.250',
  multicastLoopback: true,
  multicastTtl: 3,
  destinationAddress: '224.0.0.1'
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
  debug(this.id, str(this.config), this.status)
}



util.inherits(Disco, EE)



/**
 * Initialization. 
 * @param {Object} opts Options map passed to the constructor.
 */
Disco.prototype.init = function init(opts){
  this.server = dgram.createSocket('udp4')
  this.client = dgram.createSocket('udp4')
  this.config = _.cloneDeep(opts || {})
  
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
 * Binds server to port and attaches event handlers.
 */
Disco.prototype.start = function start(cb){
  var self = this
  
  self.server.on('message', function (msg, rinfo) {
    var message = msg.toString()
    debug('message received', message)
    self.emit('message', message)
  })
  
  self.bind(function(){
    self.emit('start')
    self.setStatus('started')
    setInterval(self.announce.bind(self), self.config.announceInterval)
    cb && cb()
  })
}



/**
 * Unbinds the server and removes listeners.
 */ 
Disco.prototype.stop = function stop(cb){
  var self = this

  self.server.on('close', cb)
  
  self.server.close()
  self.server.removeAllListeners()
  self.emit('stop')
  self.setStatus('stopped')
  debug('stopped')
}



/**
 * Binds server to a port and creates multicast subscription.
 */
Disco.prototype.bind = function bind(cb){
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
 * Sends an outgoing message.
 */
Disco.prototype.announce = function announce(){
  debug('announcing')
  var message = new Buffer('default discovery message')
  this.client.send(message, 0, message.length, this.config.port, this.config.destinationAddress)
}



Disco.prototype.setStatus = function setStatus(status){
  switch(status) {
    case 'stopped': 
      this.emit('stop')
      break
    case 'started':
      this.emit('start')
      break
    default: throw new Error('Status "' + status + '" is not valid.')
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

  return min + Math.floor(Math.random()*(max-min+1))
}



/**
 * Formats given objects for use with debug.
 * Accepts arbitrary number of objects.
 */
function str(){
  var string = '\n';
  [].slice.call(arguments).forEach(function(obj){
    string += JSON.stringify(obj, null, '  ')
  })
  return string;
}



if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() == 'test') {
  module.exports.getRandomPort = getRandomPort
}