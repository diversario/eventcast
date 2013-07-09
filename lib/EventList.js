'use strict'

module.exports = EventList

var Event = require('./Event')
  , List = require('./List')

  , util = require('util')

function EventList(event) {
  List.call(this, event)
}

util.inherits(EventList, List)


/**
 * Schedules every event to run periodically.
 * Unschedules event before scheduling.
 */
EventList.prototype.schedule = function (fn) {
  this.each(function (event) {
    event.unschedule()
    event.schedule(fn)
  })
}


/**
 * Stops event execution.
 */
EventList.prototype.unschedule = function () {
  this.each(function (event) {
    event.unschedule()
  })
}


/**
 * @override
 */
EventList.prototype.equal = function (e1, e2) {
  return e1.name === e2.name
}


/**
 * @override
 */
EventList.prototype.wrap = function (evt) {
  if (!(evt instanceof Event)) {
    return new Event(evt)
  }

  return evt
}
