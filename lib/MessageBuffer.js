'use strict'

var EE = require('events').EventEmitter
  , util = require('util')

module.exports = MessageBuffer

function MessageBuffer(config) {
  this._timeout = ((config && config.messageTtl || 3000) / 2) | 0
  this._timers = {
    receive: {},
    nack: {},
    message: {}
  }
  this._messages = {}
  this._expired = []
}

util.inherits(MessageBuffer, EE)

MessageBuffer.prototype.buffer = function buffer(msg, seqId, seq) {
  // start TTL timer when first packet for `seqId` is received
  seq = seq.toString()

  if (this._messages[seqId]) {
    clearTimeout(this._timers.receive[seqId])
  } else {
    this._messages[seqId] = {}
  }

  this._timers.receive[seqId] = setTimeout(
    this.miss.bind(this, seqId), 
    this._timeout
  )
  
  if (!this._messages[seqId][seq]) {
    this._messages[seqId][seq] = msg
  }
}

MessageBuffer.prototype.getBuffer = function getBuffer(seqId) {
  this._clearTimers(seqId)
  var m = this._messages[seqId]
  delete this._messages[seqId]
  return m
}

MessageBuffer.prototype.isComplete = function isComplete(seqId) {
  if (!this._messages[seqId]) return false
  
  var parts = Object.keys(this._messages[seqId])
    , lastSeq = this._messages[seqId][parts[parts.length-1]]

  return lastSeq.meta().seqEnd && lastSeq.meta().seq === parts.length - 1
}

MessageBuffer.prototype.getMissingSeq = function getMissingSeq(seqId) {
  var parts = Object.keys(this._messages[seqId])
    , missingSeq = []
    , i = 0
    , last = 0
    , curr 
  
  while (i <= parts.length - 1) {
    curr = parseInt(parts[i], 10)
    
    if (curr > last) {
      while (curr > last) {
        missingSeq.push(last++)
      }
    }
    
    last = curr + 1
    i++
  }
  
  return missingSeq
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
  delete this._timers.nack[seqId]
  this._expired.push(seqId)
  delete this._messages[seqId]
  this.emit('expired', seqId)
}

MessageBuffer.prototype._clearTimers = function (seqId) {
  clearTimeout(this._timers.receive[seqId])
  clearTimeout(this._timers.nack[seqId])
  clearTimeout(this._timers.message[seqId])
}