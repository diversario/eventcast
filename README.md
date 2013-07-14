# Eventcast
Network event emitter.

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

disco.start()

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