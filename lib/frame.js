/**
 * @fileOverview Describes position and order of message header
 * and metadata.
 */

exports.frameVersion = 2

exports.HEADER = {
  START: 0,
  LENGTH: 2
}

exports.HEADER.END = exports.HEADER.START + 
                     exports.HEADER.LENGTH

exports.META = {
  START: exports.HEADER.START + 
         exports.HEADER.LENGTH
}