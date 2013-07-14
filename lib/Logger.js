var bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');

process.stdout.setMaxListeners(100)

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
  
  // don't log when running tests
  if (process.env.NODE_ENV == 'test') logger.level('FATAL')
  
  return {
    disco: logger,
    repl: logger.child({
      component: 'repl',
      port: config.replPort
    }),
    _logger: bunyan
  }
}
