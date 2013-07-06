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
  this.timer = setInterval(fn, this.interval)
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