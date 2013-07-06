---

In development

---

[![Dependency Status](https://gemnasium.com/diversario/node-disco.png)](https://gemnasium.com/diversario/node-disco)

# Disco

Network discovery and messaging.

    npm install disco
    
# Usage

`disco` can be used as a part of your project.

```javascript
var disco = Disco(32768) // port

disco.on('discovered', function(info){
  // `info` contains information about some remote
  // Disco instance
  myApp.registerNode(info)
})

disco.set(
  {event: "hello world", interval: 2000},
  "send this string along with the message",
  function(msg){
    console.log(
      'Received a message from', 
      msg.address,
      'with payload',
      msg.payload
    )
  }
)

disco.start()
```