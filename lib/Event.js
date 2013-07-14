'use strict'

module.exports = Event

function Event(evt) {
  this.name = evt.name
  this.payload = evt.payload
}
