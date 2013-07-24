# Eventcast
Network event emitter.

  [![Build Status](https://secure.travis-ci.org/diversario/eventcast.png?branch=develop)](http://travis-ci.org/diversario/eventcast)
  [![Coverage Status](https://coveralls.io/repos/diversario/eventcast/badge.png?branch=develop)](https://coveralls.io/r/diversario/eventcast?branch=develop)
  [![Dependency Status](https://gemnasium.com/diversario/eventcast.png)](https://gemnasium.com/diversario/eventcast)
  [![NPM version](https://badge.fury.io/js/eventcast.png)](http://badge.fury.io/js/eventcast)

```
npm install eventcast
```
## How it works

Eventcast uses UDP multicast to send BSON-serialized messages to multiple nodes and to receive them. The goal is to provide a network event emitter where nodes can dynamically exchange data via familiar event API.

Checkout [example](example/) folder to see it in action.

## Usage

Create an instance of `eventcast` and add some events:

```javascript
var ec1 = Eventcast(9000) // port 9000

ec1.start()

ec1.on('myevent', handleEvent)
```

```javascript
var ec2 = Eventcast(9000) // port 9000

ec2.start()

ec2.emit('myevent', 'hello')
```

## REPL
`eventcast` creates a REPL that provides access to all instance methods and properties. REPL binds to a random port unless `replPort` is passed to the constructor.

```
$ telnet localhost 20001
Trying 127.0.0.1...
Connected to localhost.
Escape character is '^]'.
eventcast@hostname> eventcast.stop()
true
eventcast>
```

## Configuration
TODO. See [default configuration values](lib/Eventcast.js) overridable in the constructor.

## API
Eventcast is an instance of Event Emitter, therefore it supports [Event Emitter API](http://nodejs.org/api/events.html). Internally, `#emit` is the only method that is not real EE method but a wrapper for `events.EventEmitter.emit` that first sends out messages and then emits the event.

### Eventcast#emit(event, [arg1], [arg2], [...])
Sends out event as `event` with supplied arguments. **Arguments must be serializable into JSON** because they're going to be sent over the network.

### Eventcast#on(event, listener)
Adds a listener for `event`.

#### … and the rest of [EventEmitter API](http://nodejs.org/api/events.html).

### Eventcast#logLevel([component], [level])
(Eventcast uses bunyan to log) If called with no arguments - returns an array of levels for all streams.

Call with `level` will set all streams to `level`.

Called with `component` and `level` will set that component to given level. Eventcast has two components so far - `eventcast` and `repl`. `eventcast` is the root logger.

### Eventcast#start([callback])
Starts the UDP server. `callback` will be called when server is bound and ready.

### Eventcast#stop([callback])
Stops the UDP server. `callback` will be called when server is shutdown.