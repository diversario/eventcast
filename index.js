module.exports = process.env['COVERAGE_NODE_DISCO'] ? require ('./lib-cov/Disco') : require('./lib/Disco')