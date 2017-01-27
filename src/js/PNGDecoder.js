var PNGDecoder = function( url, callback ) {
  //Load the raw data file
  //Create a new XMLHttpRequest object
  xhr = new XMLHttpRequest;
  //Set it to a GET request for the url and make it asynchronous
  xhr.open( 'GET', url, true );
  //Say we want the raw binary data
  xhr.responseType = 'arraybuffer';
  //When our request has loaded, do this
  xhr.onload = function() {
    var data, png;
    //Store our received data into an array that we can manipulate
    data = new Uint8Array( xhr.response || xhr.mozResponseArrayBuffer );
    //Decode it
    png = decode( data );

    //Callback
    if( typeof callback === 'function' )
      callback( png );
  };
  //Send our request
  return xhr.send(null);

  //functions

  function decode( data ) {
    var i = { i: 0 };
    var inflator = new pako.Inflate();
    var chunks = [];
    var palette;
    var ancillaries = {
      gAMA: 1
    };

    //Check if file is a valid PNG
    if( getSignature( data, i ) ) {
      //Get the header
      var header = getHeader( data, i );
      console.log( header );
      //Get all the chunks
      while( i.i < data.length ) {
        chunks.push( getNextChunk( data, i ) );
      }
      //Put all the data chunks into our decompressor
      for( var j = 0; j < chunks.length; j++ ) {
        console.log( chunks[j].type.full );
        switch( chunks[j].type.full ) {
          case 'IDAT':            //Our inflator needs to know which chunk is last
              if( j != chunks.length - 1 && chunks[j+1].type.full == 'IEND' ) {
                inflator.push( chunks[j].data, true ); //true for last
              }
              else {
                inflator.push( chunks[j].data, false );
              }
            break;
          case 'PLTE':
              palette = usePalette( chunks[j] );
            break;
          //Ancillary chunks now
          case 'gAMA':
              ancillaries.gAMA = useGamma( chunks[j] );
              console.log( 'Gamma: ' + ancillaries.gAMA );
            break;
        }
      }
      if( inflator.err ) {
        console.log( inflator.msg );
      }

      var output = inflator.result;
      return makeCanvasFromInflatedFullIDAT( header, output, palette, ancillaries );
    }
    else {
      console.error( 'File is not a valid PNG' );
    }
    return false;
  }

  //First 8 bytes make up the PNG file signature
  /*
    Detect Channel: 1 Byte
    P: 1 Byte
    N: 1 Byte
    G: 1 Byte
    Carriage Return Character: 1 Byte
    Line Feed Character: 1 Byte
    DOS End Of File Character: 1 Byte
    Unix Line Feed Character: 1 Byte
  */
  function getSignature( data, i ) {
    var signature = {
      detectchannel: null,
      p: null,
      n: null,
      g: null,
      cr: null,
      lf: null,
      doseof: null,
      unixlf: null
    };

    signature.detectchannel = ( data[0] == 137 ) ? 8 : 7;
    signature.p = intToString( data[1] );
    signature.n = intToString( data[2] );
    signature.g = intToString( data[3] );
    signature.cr = intToString( data[4] );
    signature.lf = intToString( data[5] );
    signature.doseof = intToString( data[6] );
    signature.unixlf = intToString( data[7] );

    //Valid PNG signature always begins with: 137 80 78 71 13 10 26 10
    if( data[0] == 137 &&
        data[1] == 80 &&
        data[2] == 78 &&
        data[3] == 71 &&
        data[4] == 13 &&
        data[5] == 10 &&
        data[6] == 26 &&
        data[7] == 10 ) {
          i.i = 8;
          return true;
    }
    return false;
  }

  //Next bytes make up the header
  /*
    Length: 4 Bytes
    Width: 4 Bytes
    Height: 4 Bytes
    Bit Depth: 1 Byte
    Color Type: 1 Byte
    Compression Method: 1 Byte
    Filter Method: 1 Byte
    Interlace Method: 1 Byte
  */
  function getHeader( data, i ) {
    var header = {
      length: null,
      type: {
        i: null,
        h: null,
        d: null,
        r: null
      },
      data: {
        width: null,
        height: null,
        bitdepth: null,
        colortype: null,
        compression: null,
        filter: null,
        interlace: null
      },
      crc: null
    };

    //4 Bytes for the length always 13 for header
    header.length = get4ByteInt( data, 8 );

    //ancillary (if lowercase)
    header.type.i = intToString( data[12] );
    //private (if lowercase)
    header.type.h = intToString( data[13] );
    //unused
    header.type.d = intToString( data[14] );
    //safe to copy (if lowercase)
    header.type.r = intToString( data[15] );

    //4 Bytes each for width and height (neither can be 0)
    header.data.width = get4ByteInt( data, 16 );
    header.data.height = get4ByteInt( data, 20 );

    //is 1, 2, 4, 8 or 16
    header.data.bitdepth = data[24];
    //is 0, 2, 3, 4, 6
    //color type codes represent sums of the following values: 1 (palette used), 2 (color used), and 4 (alpha channel used)
    header.data.colortype = data[25];

    //must be 0
    header.data.compression = data[26];
    //must be 0
    header.data.filter = data[27];
    //must be 0 (no interlace) or 1 (adam7 interlace)
    header.data.interlace = data[28];

    //always 4 bytes
    header.crc = get4ByteInt( data, 29 );

    i.i = 33;

    return header;
  }

  //Ancilalry chunk setters

  function usePalette( plte ) {
    var palette = [];
    if( plte.data.length % 3 != 0 ) return;
    for( var i = 0; i < plte.data.length; i += 3 ) {
      palette.push( { r: plte.data[i], g: plte.data[i+1], b: plte.data[i+2] } );
    }
    return palette;
  }

  function useGamma( gama ) {
    var gamma = null;
    var rawGamma = get4ByteInt( gama.data, 0 );
    return rawGamma / 100000;
  }

  function getNextChunk( data, i ) {
    var chunk = {
      length: null,
      type: {
        full: null,
        a: null,
        b: null,
        c: null,
        d: null
      },
      data: null,
      crc: null
    };

    chunk.length = get4ByteInt( data, i.i )

    chunk.type.a = intToString( data[i.i+4] );
    //private (if lowercase)
    chunk.type.b = intToString( data[i.i+5] );
    //unused
    chunk.type.c = intToString( data[i.i+6] );
    //safe to copy (if lowercase)
    chunk.type.d = intToString( data[i.i+7] );
    chunk.type.full = chunk.type.a + chunk.type.b + chunk.type.c + chunk.type.d;

    chunk.data = data.slice( i.i+8, i.i+8+chunk.length );

    chunk.crc = get4ByteInt( data, i.i+8+chunk.length );

    i.i = i.i + 12 + chunk.length;

    //console.log(chunk);
    return chunk;
  }

  //Takes in decompressed IDAT data, unfilters it, draws it to a canvas and returns the canvas.
  function makeCanvasFromInflatedFullIDAT( header, data, palette, ancillaries ) {
    console.log(data);
    var width = header.data.width;
    var height = header.data.height;

    var canvas = document.createElement( 'canvas' );
    canvas.width = width;
    canvas.height = height;

    var context = canvas.getContext( '2d' );
    var imgData = context.createImageData( width, height );
    var bands = 1;
    switch( header.data.colortype ) {
      case 0: bands = 1; break; //greyscale
      case 2: bands = 3; break; //RGB
      case 3: bands = 0; break; //PLTE
      case 4: bands = 2; break; //greyscale A
      case 6: bands = 4; break; //RGBA
    }
    console.log( bands + ' band(s)' );

    var dataindex = 0;
    var imgdataindex = 0;
    var pixdataindex = 0;

    if( palette ) {
      var color;

      for( var y = 0; y < height; y++ ) {

        dataindex += 1;
        for( var x = 0; x < width; x++ ) {
          color = palette[data[dataindex]] || { r: 0, g: 0, b: 0 };
          imgData.data[ imgdataindex + 0 ] = color.r; //Red
          imgData.data[ imgdataindex + 1 ] = color.g; //Green
          imgData.data[ imgdataindex + 2 ] = color.b; //Blue
          imgData.data[ imgdataindex + 3 ] = ( bands == 4 ) ? 255 : 255; //Alpha

          dataindex += 1;
          imgdataindex += 4;
        }
      }
    }
    else {
      var rawPixelData = [];
      var filter;

      var testfilt = [0, 20, 40,
                      4, 8, 7];
      console.log('=====================================');
      //console.log( unfilter( testfilt, 0, 1, 2, 2, 1, 8) );
      //console.log( unfilter( testfilt, 1, 4, 2, 2, 1, 8) )
      console.log( unfilter( testfilt, 5, 4, 2, 2, 1, 8) )
      //console.log( unfilter( testfilt, 3, 2, 2, 2, 1, 8) )
      console.log( testfilt );
      //return canvas;

      for( var y = 0; y < height; y++ ) {
        //1 because the first byte of each scanline indicates its filter
        dataindex += 1;

        //filter = data[ y * ((width*bands) + 1) ];
        filter = getFilter( data, y, header.data.bitdepth, bands, width );
 
        if( !(filter >= 0 && filter <= 4) ) return canvas;

        for( var x = 0; x < ( ( width / ( 8 / header.data.bitdepth ) ) ); x++ ) {
          for( var b = 0; b < bands; b++ ) {
            rawPixelData.push( unfilter( data, dataindex + b, filter, width, height, bands, header.data.bitdepth ) );
          }
          dataindex += bands;
        }
      }

      //Move data into correct bitdepth
      console.log( rawPixelData );
      var pixelData = Uint8To( header.data.bitdepth, rawPixelData );
      console.log(pixelData);
      var scalar = 255 / ( Math.pow( 2, header.data.bitdepth ) - 1 );
      
      for( var y = 0; y < height; y++ ) {
      
        for( var x = 0; x < width; x++ ) {
          switch( header.data.colortype ) {
            case 0: 
              //console.log( unfilter( data, dataindex, filter, width, height, bands ) * scalar );
              imgData.data[ imgdataindex + 0 ] = 255 * Math.pow( pixelData[ pixdataindex ] / 255, 1 / ancillaries.gAMA ) * scalar; //Red
              imgData.data[ imgdataindex + 1 ] = 255 * Math.pow( pixelData[ pixdataindex ] / 255, 1 / ancillaries.gAMA ) * scalar; //Green
              imgData.data[ imgdataindex + 2 ] = 255 * Math.pow( pixelData[ pixdataindex ] / 255, 1 / ancillaries.gAMA ) * scalar; //Blue
              imgData.data[ imgdataindex + 3 ] = 255; //Alpha
              break;
            default:
              imgData.data[ imgdataindex + 0 ] = 255 * Math.pow( pixelData[ pixdataindex + 0 ] / 255, 1 / ancillaries.gAMA ); //Red
              imgData.data[ imgdataindex + 1 ] = 255 * Math.pow( pixelData[ pixdataindex + 1 ] / 255, 1 / ancillaries.gAMA ); //Green
              imgData.data[ imgdataindex + 2 ] = 255 * Math.pow( pixelData[ pixdataindex + 2 ] / 255, 1 / ancillaries.gAMA ); //Blue
              imgData.data[ imgdataindex + 3 ] = ( bands == 4 ) ? pixelData[ pixdataindex + 3 ] : 255; //Alpha
          }
          pixdataindex += bands;
          imgdataindex += 4;
        }
      }
    }
    context.putImageData( imgData, 0, 0 );

    return canvas;
  }

  function get4ByteInt( data, i ) {
    var b0 = padByteString( data[i+0].toString(2) );
    var b1 = padByteString( data[i+1].toString(2) );
    var b2 = padByteString( data[i+2].toString(2) );
    var b3 = padByteString( data[i+3].toString(2) );
    return parseInt( b0 + b1 + b2 + b3, 2 );
  }
  function padByteString( str ) {
    var zeros = '00000000';
    return zeros.substring(0, zeros.length - str.length ) + str;
  }

  function intToString( byte ) {
    return String.fromCharCode( byte );
  }

  function Uint8To( bitdepth, data ) {
    var newData = [];
    switch( bitdepth ) {
      case 1:
          for( var i = 0; i < data.length; i++ ) {
            var bytestr = padByteString( data[i].toString(2) );
            for( var c = 0; c < 8; c++ ) {
              newData.push( parseInt( bytestr[c], 2 ) );
            }
          }
        break;
      case 2:
          for( var i = 0; i < data.length; i++ ) {
            var bytestr = padByteString( data[i].toString(2) );
            
            newData.push( parseInt( bytestr.substr( 0, 2 ), 2 ) );
            newData.push( parseInt( bytestr.substr( 2, 2 ), 2 ) );
            newData.push( parseInt( bytestr.substr( 4, 2 ), 2 ) );
            newData.push( parseInt( bytestr.substr( 6, 2 ), 2 ) );
          }
        break;
      case 4:
          for( var i = 0; i < data.length; i++ ) {
            var bytestr = padByteString( data[i].toString(2) );
            newData.push( parseInt( bytestr.substr( 0, 4 ), 2 ) );
            newData.push( parseInt( bytestr.substr( -4 ), 2 ) );
          }
        break;
      case 16:
          for( var i = 0; i < data.length; i += 2 ) {
            var bytestr = padByteString( data[i].toString(2) ) + padByteString( data[i+1].toString(2) );
            newData.push( parseInt( bytestr, 2 ) );
          }
        break;
      default:
        return data;
    }
    return newData;
  }

  function getFilter( data, line, bitdepth, bands, width ) {
    return data[ line * ( ( ( width / ( 8 / bitdepth ) ) * bands ) + 1 ) ];
  }

  function unfilter( data, index, filter, width, height, bands, bitdepth ) {
    //x	the byte being filtered;
    //a	the byte corresponding to x in the pixel immediately before the pixel containing x (or the byte immediately before x, when the bit depth is less than 8);
    //b	the byte corresponding to x in the previous scanline;
    //c	the byte corresponding to b in the pixel immediately before the pixel containing b (or the byte immediately before b, when the bit depth is less than 8).
    var bytesPerScanline = ( ( width / ( 8 / bitdepth ) ) * bands ) + 1;
    //console.log( 'bpsl: ' + bytesPerScanline );
    switch( filter ) {
      case 0:
        break;
      case 1: //Recon(x) = Filt(x) + Recon(a)
          data[index] = ( data[index] + getA(index) ) % 256;
        break;
      case 2: //Recon(x) = Filt(x) + Recon(b)
          data[index] = ( data[index] + getB(index) ) % 256;
        break;
      case 3: //Filt(x) + floor((Recon(a) + Recon(b)) / 2)
          data[index] = ( data[index] + Math.floor( ( getA(index) + getB(index) ) / 2 ) ) % 256;
        break;
      case 4:
          data[index] = ( data[index] + paethFilter( getA(index), getB(index), getC(index) ) ) % 256;
        break;
      default:
        console.error( 'Invalid filter algorithm' );
    }

    return data[index];

    function getA( i, getI ) {
      var a = -1;
      var scanlineNum = Math.floor( i / bytesPerScanline );
      //- 1 for filter byte
      var aScanlineNum = Math.floor( ( i - bands - 1 ) / bytesPerScanline );
      //Make sure a is on the same scan line and is not the filter bit
      if( scanlineNum == aScanlineNum ) {
        a = i - ( bands * Math.ceil( bitdepth / 8 ) );
      }

      if( getI ) {
        return a;
      }

      if( a == -1 ) a = 0;
      else a = data[a];

      return a;
    }

    function getB( i, getI ) {
      var b = -1;
      if( i - bytesPerScanline > 0 ) {
        b = i - bytesPerScanline;
      }

      if( getI ) {
        return b;
      }

      if( b == -1 ) b = 0;
      else b = data[b];

      return b;
    }

    function getC( i ) { //this is the getA of getB
      var a = getA( i, true );
      if( a == -1 ) return 0;
      return getB( a );
    }

    //Finds the value of the closest to a + b -c
    function paethFilter( a, b, c ) {
      var Pr;
      var p = a + b - c;
      var pa = Math.abs(p - a);
      var pb = Math.abs(p - b);
      var pc = Math.abs(p - c);
      if( pa <= pb && pa <= pc ) Pr = a;
      else if( pb <= pc ) Pr = b;
      else Pr = c;
      return Pr;
    }

  }
}