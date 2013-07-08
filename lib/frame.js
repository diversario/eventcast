/**
 * @fileOverview Describes position and order of message header
 * and metadata.
 */

exports.frameVersion = 2

exports.HEADER = {
  START: 0,
//LENGTH:
//END:  
  version: {
    START: 0,
    LENGTH: 3,
    END: 3
  },
  encrypted: {
 // START:
    LENGTH: 1    
  },
  metaLength: {
 // START:
    LENGTH: 8    
  }
}

exports.HEADER.LENGTH = exports.HEADER.version.LENGTH + 
                        exports.HEADER.encrypted.LENGTH + 
                        exports.HEADER.metaLength.LENGTH

exports.HEADER.END = exports.HEADER.START + 
                     exports.HEADER.LENGTH

exports.HEADER.encrypted.START = exports.HEADER.version.START +
                                 exports.HEADER.version.LENGTH

exports.HEADER.encrypted.END = exports.HEADER.encrypted.START +
                               exports.HEADER.encrypted.LENGTH

exports.HEADER.metaLength.START = exports.HEADER.encrypted.START + 
                                  exports.HEADER.encrypted.LENGTH

exports.HEADER.metaLength.END = exports.HEADER.metaLength.START +
                                exports.HEADER.metaLength.LENGTH

exports.META = {
  START: exports.HEADER.START + 
         exports.HEADER.LENGTH
}

exports.headerOrder = ['version', 'encrypted', 'metaLength']