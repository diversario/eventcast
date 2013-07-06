'use strict'

module.exports = NodeList

var Node = require('./Node')
  , List = require('./List')

  , util = require('util')

function NodeList(node) {
  List.call(this, node)
}

util.inherits(NodeList, List)


/**
 * @override
 */
NodeList.prototype.wrap = function (node) {
  if (!(node instanceof Node)) {
    return new Node(node)
  }
  
  return node
}


/**
 * @override
 */
NodeList.prototype.equal = function (node1, node2) {
  return node1.id === node2.id
}