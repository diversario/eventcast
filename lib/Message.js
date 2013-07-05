'use strict'

var crypto = require('crypto')
  , ip = require('ip')

exports.OutgoingMessage = OutgoingMessage
exports.IncomingMessage = IncomingMessage

function OutgoingMessage(name, payload, parent) {
  this.name = name
  this.payload = payload
  
  this.config = parent.config
  this.id = parent.id
  this.protocolVersion = parent.constructor.protocolVersion
}



OutgoingMessage.prototype.toString = function toString() {
  var header = this.constructHeader()
    , body = this.constructBody()
  
  return header + body
}


OutgoingMessage.prototype.toBuffer = function toBuffer() {
  return Buffer(this.toString())
}



/**
 * Constructs the message header.
 *
 * @returns {String}
 */
OutgoingMessage.prototype.constructHeader = function constructHeader() {
  var version = padString(this.protocolVersion.toString(), 3)
    , encrypted = !!this.config.encrypt | 0

  return version + encrypted.toString()
}



/**
 * Constructs the message body.
 * Takes care of payload and encryption.
 *
 * @returns {String}
 */
OutgoingMessage.prototype.constructBody = function constructBody() {
  var body = {
    name: this.name,
    address: ip.address() + ':' + this.config.port,
    id: this.id,
    time: new Date().toISOString()
  }

  if (this.payload) body.payload = this.constructPayload()

  var str = JSON.stringify(body)

  return this.config.encrypt ? this.encryptBody(str) : str
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
 * Parses an incoming message.
 *
 *
 * @param msg
 * @returns {*}
 */
OutgoingMessage.prototype.parseMessage = function parseMessage(msg) {
  var header = this.parseHeader(msg.slice(0, 4))

  if (header.version !== this.protocolVersion) {
    throw new Error('Protocol version mismatch: expected ' +
                    this.protocolVersion + ', got ' + header.version)
  }

  if (header.encrypt !== !!this.config.encrypt) {
    throw new Error('Encryption mismatch: expect messages to be' +
                    (this.config.encrypt ? '' : ' not') + ' encrypted')
  }

  var body = this.parseBody(msg.slice(4))
  body.payload = this.parsePayload(body.payload)

  return body
}



/**
 * Parses message header
 *
 * @param header
 * @returns {Object}
 */
OutgoingMessage.prototype.parseHeader = function parseHeader(header) {
  return {
    version: parseInt(header.slice(0, 3).toString(), 10),
    encrypt: !!parseInt(header.slice(3,4).toString(), 10)
  }
}



/**
 * Parses message body.
 *
 * @param body
 * @returns {Object}
 */
OutgoingMessage.prototype.parseBody = function parseBody(body) {
  return this.config.encrypt ? JSON.parse(this.decryptBody(body))
    : JSON.parse(body.toString())
}



/**
 * Parses message payload
 *
 * @param payload
 * @returns {Object|null}
 */
OutgoingMessage.prototype.parsePayload = function parsePayload(payload) {
  return payload ? JSON.parse(payload) : null
}



/**
 * Encrypts given string `str` with AES-128 and key from Disco#config.encrypt.key
 *
 * @param {String} str Plain-text input
 * @return {String}
 */
OutgoingMessage.prototype.encryptBody = function encryptBody(str) {
  var cipher = crypto.createCipher('aes128', this.config.encrypt.key)

  var payload = cipher.update(str, 'binary', 'base64')
  payload += cipher.final('base64')

  return payload
}



/**
 * Decrypts given string `str` with AES-128 and key from Disco#config.encrypt.key
 *
 * @param {Buffer} buf Encrypted input
 * @return {String}
 */
OutgoingMessage.prototype.decryptBody = function decryptBody(buf) {
  var decipher = crypto.createDecipher('aes128', this.config.encrypt.key)

  var decipheredMessage = decipher.update(Buffer(buf.toString(), 'base64')) // not sure why I need to recreate a Buffer here
  decipheredMessage += decipher.final()

  return decipheredMessage
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

