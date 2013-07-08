'use strict'

var crypto = require('crypto')
  
  , frame = require('./frame')

module.exports = MessageFactory

/**
 * Message factory. Allows to link messages to the parent.
 * @param parent Instance of Disco that uses Message
 */
function MessageFactory(parent) {
  /**
   * Creates a new outgoing message.
   *
   * @param {String} name
   * @param {*} payload
   * @constructor
   */
  function OutgoingMessage(name, payload) {
    this.name = name
    this._rawPayload = payload

    this.config = parent.config
    this.id = parent.id
    this.protocolVersion = parent.constructor.protocolVersion
  }



  /**
   * Returns an object representing the message
   * @returns {{header: *, meta: String, payload: *}}
   */
  OutgoingMessage.prototype._toObject = function _toObject() {
    return {
      header: this.header(),
      meta: this.meta(),
      payload: this.payload()
    }
  }



  /**
   * Returns a serialized message.
   * A message consists of a header, metadata and payload:
   *
   *    |___|_|_variable length_|_variable length_|
   *    ^v  ^e^m                ^p
   *
   * Bytes 0-3 used for the header and the rest is the message body.
   * 
   * @returns {String} Serialized message
   */
  OutgoingMessage.prototype.toString = function toString() {
    var metaString = JSON.stringify(this.meta())
      , payloadString = this.payload()
    
    var meta = this.config.encrypt ? this.encrypt(metaString) 
                                   : metaString
      , payload = this.config.encrypt ? this.encrypt(payloadString) 
                                      : payloadString

    var head = this.header({metaLength: meta.length})

    var header = ''
    
    for (var chunk = 0; chunk < frame.headerOrder.length; chunk++) {
      header += head[frame.headerOrder[chunk]]
    }

    return header + meta + payload
  }



  /**
   * Returns a message as a Buffer
   * @returns {Buffer}
   */
  OutgoingMessage.prototype.toBuffer = function toBuffer() {
    return Buffer(this.toString())
  }



  /**
   * Constructs the message header.
   * 
   * Header length is 12 bytes:
   * 
   *     |___|_|________|
   *     ^v  ^e^m
   * 
   * First 3 bytes specify the message framing protocol version,
   * next 1 byte specifies if message body is encrypted,
   * next 8 bytes is the length of the metadata section.
   *
   * @returns {Object}
   */
  OutgoingMessage.prototype.header = function header(params) {
    if (this._header) return this._header

    var version = padString(this.protocolVersion, frame.HEADER.version.LENGTH)
      , encrypted = padString(!!this.config.encrypt | 0, frame.HEADER.encrypted.LENGTH)
      , metaLength = padString(params.metaLength, frame.HEADER.metaLength.LENGTH)

    this._header = {
      version: version,
      encrypted: encrypted,
      metaLength: metaLength
    }
    
    return this._header
  }



  /**
   * Constructs the message metadata section.
   *
   * @returns {Object}
   */
  OutgoingMessage.prototype.meta = function meta() {
    if (this._meta) return this._meta

    this._meta = {
      name: this.name,
      address: parent.getAddress(),
      id: this.id,
      time: new Date().toISOString()
    }

    if (this.config.encrypt) {
      this._meta.nonce = getNonce()
    }
    
    return this._meta
  }



  /**
   * Builds and caches outgoing payload
   * 
   * @returns {*}
   */
  OutgoingMessage.prototype.payload = function payload() {
    if (this._payload != null) return this._payload

    this._payload = this._rawPayload ? JSON.stringify(this._rawPayload) : ''

    if (this.config.encrypt) {
      this._payload += getNonce()
    }
    
    return this._payload
  }

  

  /**
   * Encrypts given string `str` with AES-128 and key from Disco#config.encrypt.key
   *
   * @param {String} str Plain-text input
   * @return {String}
   */
  OutgoingMessage.prototype.encrypt = function encrypt(str) {
    var cipher = crypto.createCipher('aes128', this.config.encrypt.key)

    var encrypted = cipher.update(str, 'binary', 'base64')
    encrypted += cipher.final('base64')

    return encrypted
  }



  /**
   * Creates a new incoming message.
   *
   * @param data
   * @constructor
   */
  function IncomingMessage(data) {
    this.data = data

    this.config = parent.config
  }



  /**
   * Returns message header
   *
   * @returns {Object}
   */
  IncomingMessage.prototype.header = function header() {
    if (this._header) return this._header
    
    var rawHeader = this.data.slice(frame.HEADER.START, frame.HEADER.END)

    this._header = {
      version: parseInt(rawHeader.slice(frame.HEADER.version.START, frame.HEADER.version.END).toString(), 10),
      encrypted: !!parseInt(rawHeader.slice(frame.HEADER.encrypted.START, frame.HEADER.encrypted.END).toString(), 10),
      metaLength: parseInt(rawHeader.slice(frame.HEADER.metaLength.START, frame.HEADER.metaLength.END), 10)
    }
    
    return this._header
  }



  /**
   * Returns message metadata section
   * @returns {*}
   */
  IncomingMessage.prototype.meta = function meta() {
    if (this._meta) return this._meta
    
    var meta = this.data.slice(frame.META.START, frame.META.START + this.header().metaLength)
    
    this._meta = this.config.encrypt ? JSON.parse(this.decrypt(meta)) : JSON.parse(meta.toString())
    return this._meta
  }



  /**
   * Returns message payload if any
   * @returns {*}
   */
  IncomingMessage.prototype.payload = function payload() {
    if (this._payload !== undefined) return this._payload
    
    var payload = this.data.slice(frame.HEADER.LENGTH + this.header().metaLength)

    if (!payload.length) {
      this._payload = null
      return this._payload
    }
    
    var rawPayload = this.config.encrypt ? this.decrypt(payload) : payload.toString()
    
    if (this.config.encrypt) {
      rawPayload = rawPayload.slice(0, rawPayload.length - this.meta().nonce.length)
    }

    // rawPayload may be an empty string at this point
    if (!rawPayload.length) {
      this._payload = null
      return this._payload
    }

    this._payload = JSON.parse(rawPayload)
    
    return this._payload
  }
  
  

  /**
   * Decrypts given string `str` with AES-128 and key from Disco#config.encrypt.key
   *
   * @param {Buffer} buf Encrypted input
   * @return {String}
   */
  IncomingMessage.prototype.decrypt = function decrypt(buf) {
    var decipher = crypto.createDecipher('aes128', this.config.encrypt.key)

    var decipheredBody = decipher.update(Buffer(buf.toString(), 'base64')) // not sure why I need to recreate a Buffer here
    decipheredBody += decipher.final()

    return decipheredBody
  }


  /**
   * Adds right padding to the `str` until it's `length` long.
   * Optional `char` used for padding defaults to a space character.
   *
   * @param {*} input Input data. Must have a .toString method
   * @param {Number} paddedLength Length of the resulting string
   * @param {String} [ch] Character to use for padding. Defaults to a space character.
   * 
   * @returns {String}
   */
  function padString(input, paddedLength, ch) {
    input = input.toString()
    
    if (!ch) ch = ' '
    while (input.length < paddedLength) input += ch
    return input
  }


  /**
   * Generates a random string and returns its SHA-1 hash.
   * 
   * @returns {string}
   */
  function getNonce() {
    var r = crypto.randomBytes(8).toString('hex') + Date.now()
      , hash = crypto.createHash('sha1').update(r)
    
    return hash.digest().toString('hex')
  }
  
  return {
    IncomingMessage: IncomingMessage,
    OutgoingMessage: OutgoingMessage
  }
}