'use strict'

module.exports = EventList

var Event = require('./Event')
  , List = require('./List')

  , util = require('util')


function EventList(event) {
  List.call(this, event)
}

util.inherits(Event, List)

EventList.prototype.schedule = function () {
  this.each(function (event) {
    event.schedule()
  })
}

EventList.prototype.unschedule = function () {
  this.each(function (event) {
    event.unschedule()
  })
}

EventList.prototype.equal = function (event, name) {
  return event.name === name
}