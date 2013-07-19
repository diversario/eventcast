'use strict'

var crypto = require('crypto')
  , os = require('os')
  , assert = require('assert')
  
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
  function OutgoingMessage(name, payload, opts) {
    opts = opts || {}
    
    this.name = name
    this._recursive = opts.recursive
    this.setPayload(payload)

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
  OutgoingMessage.prototype.toBuffer = function toBuffer() {
    var meta = Buffer(JSON.stringify(this.meta()))
      , payload = this.payload()
    
    var head = this.header({metaLength: meta.length})

    var header = new Buffer(2)
    header.writeUInt16BE(head.metaLength, 0)
    
    assert(header.length === 2)
    
    return Buffer.concat([header, meta, payload], header.length + meta.length + payload.length)
  }


  OutgoingMessage.prototype.sizeBeforePayload = function sizeBeforePayload() {
    return 2 + Buffer(JSON.stringify(this.meta())).length
  }
  
  
  
  OutgoingMessage.prototype.toChunks = function toChunks() {
    var chunks = []
      , message = this.toBuffer()
      , pointer = 0
      , payloadLength
    
    while (pointer < message.length) {
      var om = new OutgoingMessage(this.name, null, {recursive: true})
      
      if (this.config.maxPayloadSize <= message.length - pointer) payloadLength = this.config.maxPayloadSize
      else payloadLength = message.length
      
      om.setPayload(message.slice(pointer, pointer + payloadLength))
      
      chunks.push(om.toBuffer())
      pointer = pointer + payloadLength
    }
    
    return chunks
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

    this._header = {
      metaLength: params.metaLength
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
      v: this.protocolVersion,
      seq: 0
    }

    if (this._recursive) {
      this._meta.enc = false
      if (this.config.encrypt) this._meta.nonce = getNonce() 
    } else {
      this._meta.enc = !!this.config.encrypt
    }
    
    if (this._recursive || !this.config.encrypt) {
      this._meta.name = this.name
      this._meta.address = parent.getAddress()
      this._meta.hostname = os.hostname()
      this._meta.id = this.id
      this._meta.time = new Date().toISOString()
    }
    
    return this._meta
  }



  OutgoingMessage.prototype.setPayload = function setPayload(payload) {
    this._rawPayload = payload
    this._contentType = Buffer.isBuffer(this._rawPayload) ? 'buffer' : 'json'
  }
  
  
  
  /**
   * Builds and caches outgoing payload
   * 
   * @returns {*}
   */
  OutgoingMessage.prototype.payload = function payload() {
    if (this._payload != null) return this._payload

    if (this._contentType == 'buffer') {
      this._payload = this._rawPayload
      return this._payload
    }
    
    if (this.config.encrypt && !this._recursive) {
      this._payload = new OutgoingMessage(this.name, this._rawPayload, {recursive: true}).toBuffer()
      this._payload = this.encrypt(this._payload)
    } else {
      this._payload = new Buffer(this._rawPayload ? JSON.stringify(this._rawPayload) : '')
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

    return Buffer.concat([cipher.update(str), cipher.final()])
  }



  /**
   * Creates a new incoming message.
   *
   * @param data
   * @constructor
   */
  function IncomingMessage(data, encrypted) {
    this.config = parent.config
    this._recursive = encrypted
    
    if (encrypted) {
      this.data = this.decrypt(data)
    } else {
      this.data = data
    }
    
    if (this.meta().enc) {
      return new IncomingMessage(this.rawPayload(), true)
    }
  }



  /**
   * Returns message header
   *
   * @returns {Object}
   */
  IncomingMessage.prototype.header = function header() {
    if (this._header) return this._header
    
    this._header = {
      metaLength: this.data.readUInt16BE(frame.HEADER.START, frame.HEADER.LENGTH)
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
 
    this._meta = JSON.parse(meta.toString())
    
    return this._meta
  }



  /**
   * Returns message payload if any
   * @returns {*}
   */
  IncomingMessage.prototype.payload = function payload() {
    if (this._payload !== undefined) return this._payload
    
    var payload = this.data.slice(frame.HEADER.LENGTH + this.header().metaLength).toString()
    
    // rawPayload may be an empty string at this point
    if (!payload.length) {
      this._payload = null
      return this._payload
    }

    this._payload = JSON.parse(payload.toString())
    
    return this._payload
  }

  
  
  /**
   * Returns raw message payload.
   * 
   * @returns {*}
   */
  IncomingMessage.prototype.rawPayload = function rawPayload() {
    return this.data.slice(frame.HEADER.LENGTH + this.header().metaLength)
  }



  /**
   * Decrypts given string `str` with AES-128 and key from Disco#config.encrypt.key
   *
   * @param {Buffer} buf Encrypted input
   * @return {String}
   */
  IncomingMessage.prototype.decrypt = function decrypt(buf) {
    var decipher = crypto.createDecipher('aes128', this.config.encrypt.key)

    return Buffer.concat([decipher.update(buf), decipher.final()])
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