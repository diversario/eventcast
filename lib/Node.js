'use strict'

/**
 * @fileOverview Node represents an instance of Disco server.
 */

module.exports = Node

function Node(info) {
  this.id = info.id
  this.address = info.address
}