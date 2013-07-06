'use strict'

module.exports = Event

function Event(evt) {
  this.name = evt.name
  this.interval = evt.interval
  this.payload = evt.payload
  this.handler = evt.handler
  this.timer = null
}

Event.prototype.schedule = function (fn) {
  var self = this
  this.timer = setInterval(function () {
    fn(self)
  }, this.interval)
}

Event.prototype.unschedule = function () {
  clearInterval(this.timer)
}

Event.prototype.toObject = function () {
  return {
    name: this.name,
    interval: this.interval,
    payload: this.payload,
    handler: this.handler,
    timer: this.timer
  }
}