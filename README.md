# PNGDecoder
## [In Progress]

Don't forget the txt chunk.

PNGDecoder reads the raw bits of a png image and returns a canvas of the decoded image. It's not perfect (yet). 

## Installation

## Usage

   ```javascript
   PNGDecoder( 'urltopng.png', function( PNGcanvas ) {  
         //PNGCanvas is a document canvas element   
   } );
   ```
## Testing
Using http://www.schaik.com/pngsuite/

## External Libraries
* [Pako's Inflation Algorithm](https://github.com/nodeca/pako/tree/master/dist)

## Resources
* [PNG Specification](https://www.w3.org/TR/PNG/)
* [PNG Compression](http://www.zlib.org/feldspar.html) 
