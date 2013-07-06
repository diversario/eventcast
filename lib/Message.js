'use strict'

var crypto = require('crypto')

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
   * A message consists of a header and body:
   *
   *    |___|_|_variable length_|
   *    ^v  ^e^b
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

    var header = head.version + 
                 head.encrypted +
                 head.metaLength

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
   * First 3 bytes specify the message framing protocol version
   * and the last byte specifies if message body is encrypted.
   *
   * @returns {Object}
   */
  OutgoingMessage.prototype.header = function header(params) {
    if (this._header) return this._header

    var version = padString(this.protocolVersion.toString(), 3)
      , encrypted = !!this.config.encrypt | 0
      , metaLength = padString(params.metaLength.toString(), 8)

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
    
    var rawHeader = this.data.slice(0, 12)

    this._header = {
      version: parseInt(rawHeader.slice(0, 3).toString(), 10),
      encrypted: !!parseInt(rawHeader.slice(3, 4).toString(), 10),
      metaLength: parseInt(rawHeader.slice(4), 10)
    }
    
    return this._header
  }



  /**
   * Returns message metadata section
   * @returns {*}
   */
  IncomingMessage.prototype.meta = function meta() {
    if (this._meta) return this._meta
    
    var meta = this.data.slice(12, this.header().metaLength + 12)

    this._meta = this.config.encrypt ? JSON.parse(this.decrypt(meta)) : JSON.parse(meta.toString())
    return this._meta
  }



  /**
   * Returns message payload if any
   * @returns {*}
   */
  IncomingMessage.prototype.payload = function payload() {
    if (this._payload !== undefined) return this._payload
    
    var payload = this.data.slice(this.header().metaLength + 12)

    if (!payload.length) {
      this._payload = null
      return this._payload
    }
    
    this._payload = this.config.encrypt ? JSON.parse(this.decrypt(payload)) : JSON.parse(payload.toString())
    
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
  
  return {
    IncomingMessage: IncomingMessage,
    OutgoingMessage: OutgoingMessage
  }
}