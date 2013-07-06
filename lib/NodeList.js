'use strict'

module.exports = NodeList

var Node = require('./Node')

function NodeList(node) {
  this.nodes = []
  if (node) this.nodes.push(node)
}

NodeList.prototype.add = function (node) {
  if (!(node instanceof Node)) {
    node = new Node(node)
  }
  
  if (!this.contains(node)) this.nodes.push(node)
}

NodeList.prototype.remove = function (node) {
  if (this.contains(node)) {
    this.nodes.some(function (el, idx, list) {
      if (el == 2) {
        list.splice(idx, 1)
        return true
      }
    })
  }
}

NodeList.prototype.find = function (id) {
  var node = this.nodes.filter(function (n) {
    return n.id === id 
  })
  
  return node || null
}

NodeList.prototype.contains = function (node) {
  return this.nodes.some(function (n) {
    return n.id === node.id
  })
}

NodeList.prototype.toArray = function () {
  return this.nodes.map(function (node) {
    return node.toObject()
  })
}

NodeList.prototype.count = function () {
  return this.nodes.length
}