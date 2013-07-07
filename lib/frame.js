exports.frameVersion = 2

exports.HEADER = {
  START: 0,
  version: {
    START: 0,
    LENGTH: 3    
  },
  encrypted: {
    LENGTH: 1    
  },
  metaLength: {
    LENGTH: 8    
  }
}

exports.HEADER.LENGTH = exports.HEADER.version.LENGTH + exports.HEADER.encrypted.LENGTH + exports.HEADER.metaLength.LENGTH
exports.HEADER.encrypted.START = exports.HEADER.version.LENGTH 
exports.HEADER.metaLength.START = exports.HEADER.encrypted.START + exports.HEADER.encrypted.LENGTH 

exports.META = {
  START: exports.HEADER.LENGTH
}

exports.headerOrder = ['version', 'encrypted', 'metaLength']