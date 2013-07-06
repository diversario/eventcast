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
    this.payload = payload

    this.config = parent.config
    this.id = parent.id
    this.protocolVersion = parent.constructor.protocolVersion

    this.construct()
  }



  /**
   * Builds message header and body.
   */
  OutgoingMessage.prototype.construct = function () {
    this.body = this.getBody()
    this.header = this.getHeader()
  }


  /**
   * Returns an object representing the message
   * @returns {{header: Object, body: String}}
   */
  OutgoingMessage.prototype.toObject = function toObject() {
    return {
      header: this.header,
      body: this.body
    }
  }



  /**
   * Returns a stringified message.
   * @returns {string}
   */
  OutgoingMessage.prototype.toString = function toString() {
    var msg = this.toObject()
      , header = msg.header.version + msg.header.encrypted

    var bodyString = JSON.stringify(msg.body)

    return header + (this.config.encrypt ? this.encrypt(bodyString) : bodyString)
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
   * @returns {Object}
   */
  OutgoingMessage.prototype.getHeader = function getHeader() {
    if (this.header) return this.header

    var version = padString(this.protocolVersion.toString(), 3)
      , encrypted = !!this.config.encrypt | 0

    return {
      version: version,
      encrypted: encrypted
    }
  }



  /**
   * Constructs the message body.
   * Takes care of payload and encryption.
   *
   * @returns {String}
   */
  OutgoingMessage.prototype.getBody = function getBody() {
    if (this.body) return this.body

    var body = {
      name: this.name,
      address: parent.getAddress(),
      id: this.id,
      time: new Date().toISOString()
    }

    if (this.payload) body.payload = this.constructPayload()

    return body
  }



  /**
   * Constructs the message payload.
   *
   * @returns {String}
   */
  OutgoingMessage.prototype.constructPayload = function constructPayload() {
    return JSON.stringify(this.payload)
  }



  /**
   * Encrypts given string `str` with AES-128 and key from Disco#config.encrypt.key
   *
   * @param {String} str Plain-text input
   * @return {String}
   */
  OutgoingMessage.prototype.encrypt = function encrypt(str) {
    var cipher = crypto.createCipher('aes128', this.config.encrypt.key)

    var payload = cipher.update(str, 'binary', 'base64')
    payload += cipher.final('base64')

    return payload
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
    this.protocolVersion = parent.constructor.protocolVersion
  }



  /**
   * Parses an incoming message.
   *
   * @returns {*}
   */
  IncomingMessage.prototype.parse = function parse() {
    var header = this.parseHeader()

    if (header.version !== this.protocolVersion) {
      throw new Error('Protocol version mismatch: expected ' + this.protocolVersion + ', got ' + header.version)
    }

    if (header.encrypted !== !!this.config.encrypt) {
      throw new Error('Encryption mismatch: expect messages to be' + (this.config.encrypt ? '' : ' not') + ' encrypted')
    }

    var body = this.parseBody()
    body.payload = this.parsePayload(body.payload)

    return body
  }



  /**
   * Parses message header
   *
   * @returns {Object}
   */
  IncomingMessage.prototype.parseHeader = function parseHeader() {
    var header = this.data.slice(0, 4)

    return {
      version: parseInt(header.slice(0, 3).toString(), 10),
      encrypted: !!parseInt(header.slice(3, 4).toString(), 10)
    }
  }



  /**
   * Parses message body.
   *
   * @returns {Object}
   */
  IncomingMessage.prototype.parseBody = function parseBody() {
    var body = this.data.slice(4)

    return this.config.encrypt ? JSON.parse(this.decrypt(body)) : JSON.parse(body.toString())
  }



  /**
   * Parses message payload
   *
   * @param payload
   * @returns {Object|null}
   */
  IncomingMessage.prototype.parsePayload = function parsePayload(payload) {
    return payload ? JSON.parse(payload) : null
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