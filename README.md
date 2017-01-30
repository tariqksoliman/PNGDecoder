# PNGDecoder
## [In Progress]

PNGDecoder reads the raw bits of a png image and returns a canvas of the decoded image. It's not perfect (yet).

## Features
* Returns:
   * Canvas
   * Metadata:
      * header
      * palette
      * ancillary chunks
* Reads:
   * gAMA
   * sBIT
* Handles:
   * 1,2,4 and 8 bits
   * 16 bits ( Often looks right but is off by 1 pixel value compared to chrome's implementation )
   
Chrome's implementation is about 2 to 4 times faster at decoding.

## Installation

At this point, merely include PNGDecoder.js. (currently under `src/js`)

## Usage

   ```javascript
   PNGDecoder( 'urltopng.png', function( PNGcanvas, metadata ) {  
         //PNGCanvas is a document canvas element   
   } );
   ```
## Testing
Testing uses [PNG Suite's](http://www.schaik.com/pngsuite/) set of images. Opening `index.html` under `src` runs a pixel by pixel comparision of your browser's decoder vs PNGDecoder of these images.

## External Libraries
* [Pako's Inflation Algorithm](https://github.com/nodeca/pako/tree/master/dist)

## Resources
* [PNG Specification](https://www.w3.org/TR/PNG/)
* [PNG Compression](http://www.zlib.org/feldspar.html) 
