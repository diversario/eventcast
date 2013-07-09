'use strict'

/**
 * @fileOverview Base class for lists. Provides generic methods
 * for list operations.
 */

module.exports = List


/**
 * @param {*} el List element
 * @constructor
 */
function List(el) {
  if (this.constructor.name === 'List') {
    throw new Error('Abstract class List must not be used directly.')
  }
  
  this.list = []
  if (el) this.add(el)
}


/**
 * Returns a proper instance of `el`.
 * E.g., if given an plain object is may return
 * an instance of Node or Event, but if given
 * an instance of either - returns it as-is.
 * 
 * @param {*} el Element to wrap.
 */
List.prototype.wrap = function (el) {
  throw new Error('Virtual method "wrap" must be implemented in the subclass')
}


/**
 * Compares two elements `a` and `b` and
 * returns comparison result as boolean.
 * 
 * @param {*} a
 * @param {*} b
 * 
 * @return {Boolean} If `a` equals `b`
 */
List.prototype.equal = function (a, b) {
  throw new Error('Virtual method "equal" must be implemented in the subclass')
}


/**
 * Adds element `el` to the list.
 * @param el
 */
List.prototype.add = function (el) {
  el = this.wrap(el)
  
  if (!this.contains(el)) this.list.push(el)
  return this
}


/**
 * Removes element `el` from the list
 * using subclass' equality method.
 * 
 * @param element
 */
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
  return this
}


/**
 * Finds element `el` in the list
 * using subclass' equality method
 * 
 * @param el
 * @returns {Number|*|null}
 */
List.prototype.find = function (el) {
  var self = this
  
  var element = this.list.filter(function (item) {
    return self.equal(item, el)
  })
  
  return element.length && element[0] || null
}



/**
 * Finds an element by comparing element's
 * property `propName` with `propValue`.
 * 
 * @param {String} propName
 * @param {*} propValue
 * @returns {Number|*|null}
 */
List.prototype.findBy = function (propName, propValue) {
  var element = this.list.filter(function (item) {
    return item[propName] === propValue
  })

  return element.length && element[0] || null  
}



/**
 * Determines if the list contains element `el`
 * using subclass' equality method.
 * 
 * @param el
 * @returns {boolean}
 */
List.prototype.contains = function (el) {
  var self = this
  
  return this.list.some(function (item) {
    return self.equal(item, el) 
  })
}


/**
 * Invokes iterator `fn` on every element
 * of the list
 * 
 * @param fn
 */
List.prototype.each = function (fn) {
  this.list.forEach(fn.bind(this))
  return this
}


/**
 * Returns a plain array of elements
 * @returns {Array}
 */
List.prototype.toArray = function () {
  return this.list.map(function (el) {
    return el
  })
}


/**
 * Returns the number of elements in the list
 * @returns {Number}
 */
List.prototype.count = function () {
  return this.list.length
}