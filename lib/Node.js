'use strict'

var os = require('os')

module.exports = Node

function Node(info) {
  this.id = info.id
  this.address = info.address
  this.hostname = os.hostname()
}

Node.prototype.toObject = function () {
  return {
    id: this.id,
    address: this.address,
    hostname: this.hostname
  }
}