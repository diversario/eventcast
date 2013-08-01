# Eventcast
Network event emitter.

  [![Build Status](https://secure.travis-ci.org/diversario/eventcast.png?branch=develop)](http://travis-ci.org/diversario/eventcast)
  [![Coverage Status](https://coveralls.io/repos/diversario/eventcast/badge.png?branch=develop)](https://coveralls.io/r/diversario/eventcast?branch=develop)
  [![Dependency Status](https://gemnasium.com/diversario/eventcast.png)](https://gemnasium.com/diversario/eventcast)
  [![NPM version](https://badge.fury.io/js/eventcast.png)](http://badge.fury.io/js/eventcast)

```
npm install eventcast
```
## Motivation
I decided to write this because 1) multicast is interesting and 2) event emitters are awesome. So it's a learning exercise. And if you think something is amiss - please open an issue!

## How it works

Eventcast uses UDP multicast to send BSON-serialized messages to multiple nodes and to receive them. The goal is to provide a network event emitter where nodes can dynamically exchange data via familiar event API.

Checkout [example](example/) folder to see it in action.

## Security
`eventcast` uses optional `aes128` message encryption. Packets encrypted with user-provided passphrase. When encryption is enabled `eventcast` adds a nonce to every packet (nonce is created using `crypto.randomBytes`).

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
`eventcast` constructor takes an option hash:

- `address` _string_ Interface to which UDP server binds. Defaults to `0.0.0.0`. Best left unchanged unless you really know what you're doing.
- `port` _number_ UDP server port. Will be set at random which is not very useful. Port must be the same for instances that want to see each other.
- `multicastMembership` _string_ [Multicast group](http://en.wikipedia.org/wiki/Multicast_address) to join. Defaults to `224.0.0.1` (all hosts).
- `multicastInterface` _string_ Interface to use for multicast messages. Defaults to `0.0.0.0`.
- `multicastLoopback` _boolean_ Receive multicast messages on the loopback interface. Must be set to `true` for instances on the same machine to see each other.
- `multicastTtl` _number_ Multicast scope (see [this article](http://www.tldp.org/HOWTO/Multicast-HOWTO-2.html)). Defaults to 1 - messages will not leave the subnet and will not be forwarded by the router.
- `replPort` _number_ REPL port. Connect to this port to access built-in REPL. If not set explicitly - port is random (you can figure it out from logs).
- `replHost` _string_ REPL interface. Defaults to `localhost`, which is probably best.
- `encrypt` _object_ Encryption options if you want encryption. By default encryption is disabled.
- `encrypt.key` _string_ Passphrase to use for encryption. No default.
- `maxPayloadSize` _number_ Threshold in bytes above which messages will be chunked. Defaults to 1024. Multicast messages are best kept under ~1500 bytes to avoid silent packet loss.
- `messageTtl` _number_ If chunked message is transmitted and no chunks received within this timeframe - message is discarded. Defaults to 3000 (3 seconds).

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