---

In development

---

[![Dependency Status](https://gemnasium.com/diversario/node-disco.png)](https://gemnasium.com/diversario/node-disco)

# Disco

Network discovery utility.

    npm install disco
    
# Usage

`disco` can be used as a part of your project.

```javascript
var disco = Disco()

disco.on('message', function(message){
  // do something about the message
  // maybe send one yourself
  disco.send('I hear ya!')
})

disco.message = 'My process ID is' + process.pid

disco.start()
```