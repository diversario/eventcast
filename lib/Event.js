'use strict'

module.exports = Event

function Event(evt) {
  this.name = evt.name
  this.interval = evt.interval
  this.payload = evt.payload
  this.handler = evt.handler
  this.timer = null
}


/**
 * Schedules the event.
 * `fn` is invoked on every cycle.
 * 
 * @param {Function} fn Function to call on every cycle
 */
Event.prototype.schedule = function (fn) {
  var self = this
  this.timer = setInterval(function () {
    fn(self)
  }, this.interval)
}


/**
 * Stops event from running.
 */
Event.prototype.unschedule = function () {
  clearInterval(this.timer)
}
