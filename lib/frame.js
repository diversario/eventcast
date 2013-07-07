exports.frameVersion = 2


exports.VERSION = {
  START: 0,
  LENGTH: 3
}

exports.ENCRYPTED = {
  START: exports.VERSION.LENGTH,
  LENGTH: 1
}

exports.METALENGTH = {
  START: exports.ENCRYPTED.START + exports.ENCRYPTED.LENGTH,
  LENGTH: 8
}

exports.HEADER = {
  START: 0,
  LENGTH: exports.VERSION.LENGTH + exports.ENCRYPTED.LENGTH + exports.METALENGTH.LENGTH
}

exports.META = {
  START: exports.HEADER.LENGTH
}

exports.HEADER_LENGTH = exports.VERSION_LENGTH + 
                        exports.ENCRYPTED_LENGTH + 
                        exports.METALENGTH_LENGTH

exports.headerOrder = ['version', 'encrypted', 'metaLength']