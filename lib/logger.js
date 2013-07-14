var bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');

module.exports = function(config) {
  var prettyStdOut = new PrettyStream()
  prettyStdOut.pipe(process.stdout)
  
  var logger = bunyan.createLogger({
    name: 'disco',
    id: config.id,
    streams: [{
      level: 'info',
      type: 'raw',
      stream: prettyStdOut
    }]
  })

  config.logLevel && logger.level(config.logLevel)
  
  return {
    disco: logger,
    repl: logger.child({
      component: 'repl',
      port: config.replPort
    }),
    _logger: bunyan
  }
}
