'use strict'

module.exports = List

function List(el) {
  this.list = []
  if (el) this.add(el)
}

List.prototype.add = function (el) {
  el = this.wrap(el)
  
  if (!this.contains(el)) this.list.push(el)
}

List.prototype.remove = function (element) {
  var self = this
  
  if (this.contains(element)) {
    this.list.some(function (el, idx, list) {
      if (self.equal(element, el)) {
        list.splice(idx, 1)
        return true
      }
    })
  }
}

List.prototype.find = function (el) {
  var self = this
  
  var element = this.list.filter(function (item) {
    return self.equal(item, el)
  })
  
  return element.length && element[0] || null
}

List.prototype.findBy = function (propName, propValue) {
  var element = this.list.filter(function (item) {
    return item[propName] === propValue
  })

  return element.length && element[0] || null  
}

List.prototype.contains = function (el) {
  var self = this
  
  return this.list.some(function (item) {
    return self.equal(item, el) 
  })
}

List.prototype.each = function (fn) {
  this.list.forEach(fn.bind(this))
}
  
List.prototype.toArray = function () {
  return this.list.map(function (el) {
    return el.toObject()
  })
}

List.prototype.count = function () {
  return this.list.length
}