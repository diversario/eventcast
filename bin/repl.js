#!/usr/bin/env node

if (!process.argv[2]) throw new Error('You must specify the port as parameter.')

var net = require('net')
 
var sock = net.connect(process.argv[2])
 
process.stdin.on('end', function () {
    sock.destroy()
    console.log()
})
 
process.stdin.on('data', function (b) {
    if (b.length === 1 && b[0] === 4) {
          process.stdin.emit('end')
    }
})
   
process.stdin.pipe(sock)
sock.pipe(process.stdout)
 
sock.on('connect', function () {
    process.stdin.resume();
      process.stdin.setRawMode(true)
})
 
sock.on('close', function done () {
    process.stdin.setRawMode(false)
    process.stdin.pause()
    sock.removeListener('close', done)
})
