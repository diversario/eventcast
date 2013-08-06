'use strict'

var EE = require('events').EventEmitter
  , util = require('util')

module.exports = MessageBuffer

function MessageBuffer(config) {
  this._timeout = config && config.messageTtl
  this._timers = {
    receive: {},
    send: {},
    nack: {},
    message: {}
  }
  this._incomingMessages = {}
  this._outgoingMessages = {}
  this._expired = []
}

util.inherits(MessageBuffer, EE)

MessageBuffer.prototype.bufferOutgoing = function bufferOutgoing(messageArray) {
  var self = this
    , seqId = messageArray[0].meta().seqId

  this._outgoingMessages[seqId] = this._outgoingMessages[seqId] || {}
  
  messageArray.forEach(function (m) {
    self._outgoingMessages[seqId][m.meta().seq] = m
  })
  
  this._timers.send[seqId] = setTimeout(function () {
    delete self._outgoingMessages[seqId]
  }, this._timeout * 3)
}

MessageBuffer.prototype.getOutgoingPackets = function getOutgoingPackets(seqId, seqs) {
  var self = this
    , packets = []

  if (!self._outgoingMessages[seqId]) return packets
  
  seqs.forEach(function (seq) {
    packets.push(self._outgoingMessages[seqId][seq.toString()])
  })
  
  return packets
}

MessageBuffer.prototype.bufferIncoming = function bufferIncoming(msg, seqId, seq) {
  // start TTL timer when first packet for `seqId` is received
  seq = seq.toString()

  if (this._incomingMessages[seqId]) {
    clearTimeout(this._timers.receive[seqId])
  } else {
    this._incomingMessages[seqId] = {}
  }

  if (!this._incomingMessages[seqId][seq]) {
    this._incomingMessages[seqId][seq] = msg
  }
  
  this._timers.receive[seqId] = setTimeout(
    this.miss.bind(this, seqId), 
    this._timeout
  )
}

MessageBuffer.prototype.getIncomingBuffer = function getIncomingBuffer(seqId) {
  this._clearTimers(seqId)
  var m = this._incomingMessages[seqId]
  delete this._incomingMessages[seqId]
  return m
}

MessageBuffer.prototype.isComplete = function isComplete(seqId) {
  if (!this._incomingMessages[seqId]) return false
  
  var parts = Object.keys(this._incomingMessages[seqId])
    , lastSeq = this._incomingMessages[seqId][parts[parts.length-1]]

  return lastSeq.meta().seqEnd && lastSeq.meta().seq === parts.length - 1
}

MessageBuffer.prototype.getMissingSeq = function getMissingSeq(seqId) {
  var parts = Object.keys(this._incomingMessages[seqId])
    , missingSeq = []
    , i = 0
    , length = this._incomingMessages[seqId][parts[0]].meta().seqLen
  
  while (i < length) {
    if (!~parts.indexOf(i.toString())) {
      missingSeq.push(i)
    }
    i++
  }

  return missingSeq
}

MessageBuffer.prototype.getSenderMeta = function getSenderMeta(seqId) {
  if (!this._incomingMessages[seqId]) return null
  
  var parts = Object.keys(this._incomingMessages[seqId])

  return this._incomingMessages[seqId][parts[0]].meta()
}
  

MessageBuffer.prototype.miss = function miss(seqId) {
  delete this._timers.receive[seqId]

  this.emit('miss', seqId, this.getMissingSeq(seqId))  

  this._timers.nack[seqId] = setTimeout(
    this.expire.bind(this, seqId),
    this._timeout
  )
}

MessageBuffer.prototype.expire = function expire(seqId) {
  this._clearTimers(seqId)
  this._expired.push(seqId)
  delete this._incomingMessages[seqId]
  this.emit('expired', seqId)
}

MessageBuffer.prototype._clearTimers = function (seqId) {
  clearTimeout(this._timers.receive[seqId])
  clearTimeout(this._timers.nack[seqId])
  clearTimeout(this._timers.message[seqId])
}