# Eventcast
Network event emitter.

  [![Build Status](https://secure.travis-ci.org/diversario/eventcast.png?branch=master)](http://travis-ci.org/diversario/eventcast)
  [![Coverage Status](https://coveralls.io/repos/diversario/eventcast/badge.png?branch=master)](https://coveralls.io/r/diversario/eventcast?branch=master)
  [![Dependency Status](https://gemnasium.com/diversario/eventcast.png)](https://gemnasium.com/diversario/eventcast)
  [![NPM version](https://badge.fury.io/js/eventcast.png)](http://badge.fury.io/js/eventcast)

```
npm install eventcast
```
## How it works

TODO
The goal of `eventcast` is to provide a network event emitter where nodes can dynamically subscribe to events and exchange data. Use `eventcast` as a part of your project.

## Usage

Create an instance of `eventcast` and add some events:

```javascript
var ec = Eventcast(9000) // port 9000

ec.start()

ec.emit('myevent', 'hello')
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
TODO