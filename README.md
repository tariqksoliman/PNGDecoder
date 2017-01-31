# PNGDecoder
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()
## [In Progress]

PNGDecoder reads the raw bits of a png image and returns a canvas of the decoded image. It's not perfect.

## Features
* Returns:
   * Canvas
   * Metadata:
      * header
      * palette
      * ancillary chunks
* Reads:
   * bKGD
   * tRNS [in progress]
   * gAMA
   * sBIT
* Handles:
   * 1, 2, 4, 8 and 16 bitdepths
   
Chrome's implementation is about 1 to 4 times faster at decoding.

## Installation

At this point, merely include PNGDecoder.js. (currently under `src/js`) (and the pako inflate min)

## Usage

   ```javascript
   PNGDecoder( 'urltopng.png', function( PNGcanvas, metadata ) {  
         //PNGCanvas is a document canvas element   
   } );
   ```
## Testing
Testing uses [PNG Suite's](http://www.schaik.com/pngsuite/) set of images. Opening `index.html` under `src` runs a pixel by pixel comparision of your browser's decoder vs PNGDecoder of these images.

Not all pngs match perfectly because:
* Of how gamma is calculated (though this may be my error)
* The bKGD chunk is not ignored

## External Libraries
* [Pako's Inflation Algorithm](https://github.com/nodeca/pako/tree/master/dist)

## Resources
* [PNG Specification](https://www.w3.org/TR/PNG/)
* [PNG Compression](http://www.zlib.org/feldspar.html) 
