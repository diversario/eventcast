### Example

A simple example that shows interaction between two servers as well as Eventcast REPL feature.

Start servers in two terminal windows:

```javascript
$ node server1
$ node server2
```

You should see servers print diagnostic info in the console:

```
$ node server2.js
[2013-07-14T22:37:16.013Z]  INFO: eventcast/84782 on myhost: UDP server started { address: '0.0.0.0', family: 'IPv4', port: 19999 } (id=af64b2ac5ce41d72)
[2013-07-14T22:37:16.015Z]  INFO: eventcast/repl/84782 on myhost: REPL started. (id=af64b2ac5ce41d72, port=20002)
[2013-07-14T22:37:21.012Z]  INFO: eventcast/84782 on myhost:  (id=af64b2ac5ce41d72)
    Incoming message { name: 'server2 here',
      address: '192.168.1.52:19999',
      hostname: 'myhost',
      id: 'af64b2ac5ce41d72',
      time: '2013-07-14T22:37:21.011Z' }
```

`server2` emits event 'server2 here` with current time. You can see the event arrive but INFO log level does not print the arguments. Let's set log level to DEBUG using REPL.

### REPL

Connect to `server2`'s REPL:

```
$ telnet localhost 20002
Trying 127.0.0.1...
Connected to localhost.
Escape character is '^]'.
eventcast@myhost> 
```
While in REPL, you can access the instance via `eventcast` object. You can emit an event:

```
eventcast@myhost> eventcast.emit('hello', 'an argument')
false
```
You see `false` returned because there are no listeners for event `hello` on this instance.

In the console of either process you should see something like this:

```
[2013-07-14T22:51:35.272Z]  INFO: eventcast/84782 on myhost:  (id=faa1bab11c766e0a)
    Incoming message { name: 'hello',
      address: '192.168.1.52:19999',
      hostname: 'mycomputername',
      id: 'faa1bab11c766e0a',
      time: '2013-07-14T22:51:35.267Z' }
```

Nice. But let's set that log level:

```
eventcast@myhost> eventcast.logLevel('debug')
```
And now you can see the event being sent and received:

```
[2013-07-14T22:38:11.021Z] DEBUG: eventcast/84782 on myhost:  (id=af64b2ac5ce41d72)
    Sending message { name: 'server2 here',
      payload: [ 'time is Sun Jul 14 2013 18:38:11 GMT-0400 (EDT)' ] }
[2013-07-14T22:38:11.021Z]  INFO: eventcast/84782 on myhost:  (id=af64b2ac5ce41d72)
    Incoming message { name: 'server2 here',
      address: '192.168.1.52:19999',
      hostname: 'myhost',
      id: 'af64b2ac5ce41d72',
      time: '2013-07-14T22:38:11.021Z' }
[2013-07-14T22:38:11.022Z] DEBUG: eventcast/84782 on myhost:  (id=af64b2ac5ce41d72)
    Incoming message:
     { name: 'server2 here',
      header: { version: 2, encrypted: false, metaLength: 141 },
      meta: 
       { name: 'server2 here',
         address: '192.168.1.52:19999',
         hostname: 'myhost',
         id: 'af64b2ac5ce41d72',
         time: '2013-07-14T22:38:11.021Z' },
      payload: [ 'time is Sun Jul 14 2013 18:38:11 GMT-0400 (EDT)' ] }
```
