var dgram = require('dgram')
  , crypto = require('crypto')
  , EE = require('events').EventEmitter
  , util = require('util')
  
  , _ = require('lodash')
  , debug = require('debug')('disco')



/**
 * Formats given objects for use with debug. 
 * @param {Object} * Any number of objects
 */
function str(){
  var string = '\n';
  [].slice.call(arguments).forEach(function(obj){
    string += JSON.stringify(obj, null, '  ')
  })
  return string;
}


/**
 * Default configuration values
 */
var defaultConfig = {
  announceInterval: 5000,
  bindAddress: '0.0.0.0',
  bindPort: 58005,
  multicastMembership: '239.255.255.250',
  multicastLoopback: true,
  multicastTtl: 3,
  destinationAddress: '224.0.0.1',
  destinationPort: 58005
}


/**
 * 
 * @param {Object} opts Options map, overrides default configuration. 
 * @returns {Disco}
 * @constructor
 */
function Disco(opts) {
  if (!(this instanceof Disco)) return new Disco(opts)
  Disco.init.call(this, opts);
}


util.inherits(Disco, EE)


/**
 * Initialization. 
 * @param {Object} opts Options map passed to the constructor.
 */
Disco.init = function(opts){
  this.socket = dgram.createSocket('udp4')
  this.config = _.defaults(opts || {}, defaultConfig)
  this.config.id = this.config.id || crypto.randomBytes(8).toString('hex')
  
  this.status = 'stopped';
  
  debug(str(this.config));
}


/**
 * Kicks off network activity.
 * Binds socket to port and attaches event handlers.
 */
Disco.prototype.start = function(){
  var self = this
  
  self.socket.on('message', function (msg, rinfo) {
    var message = msg.toString()
    debug('message received', message)
    self.emit('message', message)
  })
  
  self.bind()
  setInterval(self.announce.bind(self), self.config.announceInterval)
}


/**
 * Binds socket to a port and creates multicast subscription.
 */
Disco.prototype.bind = function(){
  var self = this

  self.socket.on("listening", function () {
    var address = self.socket.address()

    self.socket.addMembership(self.config.multicastMembership)
    self.socket.setMulticastLoopback(self.config.multicastLoopback)
    self.socket.setMulticastTTL(self.config.multicastTtl)
    debug("server listening " + address.address + ":" + address.port)
  })

  self.socket.bind(self.config.bindPort)
}


/**
 * Sends an outgoing message.
 */
Disco.prototype.announce = function(){
  debug('announcing')
  var message = new Buffer('default discovery message')
  this.socket.send(message, 0, message.length, this.config.destinationPort, this.config.destinationAddress);
}

module.exports = Disco
