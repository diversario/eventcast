'use strict'

var crypto = require('crypto')
  , os = require('os')
  , BSON = require('bson').BSONPure.BSON
  
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
    
    this._seqId = opts.seqId || getNonce()
    this._seq = opts.seq || 0
    this._seqLen = opts.seqLen || 1
    this._seqEnd = opts.seqEnd !== false
    
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
    if (this._buffer) return this._buffer
    
    var meta = BSON.serialize(this.meta())
      , payload = this.payload()    
      , head = this.header({metaLength: meta.length})
      , header = new Buffer(frame.HEADER.LENGTH)
    
    header.writeUInt16BE(head.metaLength, 0)
    
    this._buffer = Buffer.concat([header, meta, payload], header.length + meta.length + payload.length)
    return this._buffer
  }


  

  /**
   * Splits current message into multiple messages.
   * 
   * @returns {Array} Array of OutgoingMessage instances.
   */
  OutgoingMessage.prototype.toChunks = function toChunks() {
    var chunks = []
      , message = this.toBuffer()
      , pointer = 0
      , seqId = getNonce()
      , seq = 0
      , payloadLength
      , seqLen = Math.ceil((message.length / this.config.maxPayloadSize))
        
    while (pointer < message.length) {
      if (this.config.maxPayloadSize <= message.length - pointer) payloadLength = this.config.maxPayloadSize
      else payloadLength = message.length
      
      var om = new OutgoingMessage(
        this.name, 
        null, 
        {
          recursive: true, 
          seq: seq++, 
          seqLen: seqLen,
          seqId: seqId,
          seqEnd: pointer + payloadLength >= message.length
        }
      )
      
      om.setPayload(message.slice(pointer, pointer + payloadLength))
      
      chunks.push(om)
      pointer = pointer + payloadLength
    }
    
    return chunks
  }
  
  

  /**
   * Returns object representation of the header.
   * Currently includes only metadata length.
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
      seq: this._seq,
      seqLen: this._seqLen,
      seqId: this._seqId,
      seqEnd: this._seqEnd
    }

    if (this._recursive) {
      this._meta.enc = false
      if (this.config.encrypt) this._meta.nonce = getNonce() 
    } else {
      this._meta.enc = !!this.config.encrypt
    }
    
    if (this._recursive || !this.config.encrypt) {
      this._meta.name = this.name
      this._meta.host = parent.getAddress().host
      this._meta.port = parent.getAddress().port
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
      this._payload = BSON.serialize({
        payload: this._rawPayload ? this._rawPayload : new Buffer('') 
      })
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
    
    // detect if this is a message buffer
    if (data[0] && typeof data[0].meta == 'function') {
      return this.assembleMultipartMessage(data)
    }
    
    if (encrypted) {
      this.data = this.decrypt(data)
    } else {
      this.data = data
    }
    
    if (this.meta().enc) {
      return new IncomingMessage(this.rawPayload(), true)
    }
  }

  IncomingMessage.prototype.isMultipart = function () {
    return !this.meta().seqEnd || this.meta().seq > 0
  }
  
  IncomingMessage.prototype.assembleMultipartMessage = function (messages) {
    var reassembledMessage = Buffer(0)

    // concatenate the payload chunks
    Object.keys(messages).sort(sortMultipart).forEach(function (seq) {
      var m = messages[seq]
      reassembledMessage = Buffer.concat([reassembledMessage, m.rawPayload()])
    })

    // slice out the payload
    var header = reassembledMessage.slice(frame.HEADER.START, frame.HEADER.LENGTH)
    var meta = BSON.deserialize(reassembledMessage.slice(frame.HEADER.END, frame.HEADER.END + header.readInt16BE(0)))
    var payload = reassembledMessage.slice(frame.HEADER.END + meta.length)

    return new IncomingMessage(payload)
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
 
    this._meta = BSON.deserialize(meta)
    
    return this._meta
  }



  /**
   * Returns message payload if any
   * @returns {*}
   */
  IncomingMessage.prototype.payload = function payload() {
    if (this._payload !== undefined) return this._payload
    
    if (this.meta().seqEnd !== true || this.meta().seq !== 0) {
      this._payload = this.rawPayload()
      return this._payload
    }
    
    var payload = this.data.slice(frame.HEADER.LENGTH + this.header().metaLength)
    
    // rawPayload may be an empty string at this point
    if (!payload.length) {
      this._payload = null
      return this._payload
    }

    this._payload = BSON.deserialize(payload).payload
    
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
  
  function sortMultipart(a, b) {
    a = parseInt(a)
    b = parseInt(b)

    if (a < b) return -1
    if (a > b) return 1
    return 0
  }

  return {
    IncomingMessage: IncomingMessage,
    OutgoingMessage: OutgoingMessage
  }
}