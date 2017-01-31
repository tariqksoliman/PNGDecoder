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
    var data, decoded, png, metadata;
    //Store our received data into an array that we can manipulate
    data = new Uint8Array( xhr.response || xhr.mozResponseArrayBuffer );
    //Decode it
    decoded = decode( data );
    png = decoded.canvas;
    metadata = decoded.metadata;

    //Callback
    if( typeof callback === 'function' )
      callback( png, metadata );
  };
  //Send our request
  return xhr.send(null);

  //private functions

  function decode( data ) {
    //An object so that it's passed by reference and gets updated
    var i = { i: 0 };
    var inflator = new pako.Inflate();
    var header;
    var chunks = [];
    var palette;
    var ancillaries = {
      bKGD: null,
      gAMA: 1,
      sBit: null,
      tRNS: null,
    };

    //Check if file is a valid PNG
    if( getSignature( data, i ) ) {
      //Get the header
      header = getHeader( data, i );
      //console.log( header );
      //Get all the chunks
      while( i.i < data.length ) {
        chunks.push( getNextChunk( data, i ) );
      }
      //Put all the data chunks into our decompressor
      for( var j = 0; j < chunks.length; j++ ) {
        //console.log( chunks[j].type.full );
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
          case 'bKGD':
              ancillaries.bKGD = useBackground( chunks[j], header.data.colortype );
            break;
          case 'gAMA':
              ancillaries.gAMA = useGamma( chunks[j] );
              //console.log( 'Gamma: ' + ancillaries.gAMA );
            break;
          case 'sBIT':
              ancillaries.sBIT = useSBIT( chunks[j] );
              //console.log( ancillaries.sBIT );
            break;
          case 'tRNS':
              ancillaries.tRNS = useTransparency( chunks[j], header.data.colortype );
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

  //Ancillary and PLTE chunk setters

  function usePalette( plte ) {
    var palette = [];
    if( plte.data.length % 3 != 0 ) return;
    for( var i = 0; i < plte.data.length; i += 3 ) {
      palette.push( { r: plte.data[i], g: plte.data[i+1], b: plte.data[i+2] } );
    }
    return palette;
  }

  function useBackground( bkgd, colortype ) {
    var background = [];
    switch( colortype ) {
      case 3:
          background = bkgd.data[0];
        break;
      default:
          background = Uint8To( 16, null, bkgd.data );
    }

    return background;
  }

  function useGamma( gama ) {
    var gamma = null;
    var rawGamma = get4ByteInt( gama.data, 0 );
    return rawGamma / 100000 * 2.2;
  }

  //sBIT tells us which bits of a data value are significant
  function useSBIT( sbit ) {
    var sigbits = [];
    for( var i = 0; i < sbit.data.length; i++ ) {
      sigbits[i] = sbit.data[i];
    }

    return sigbits;
  }

  //tRNS 
  function useTransparency( trns, colortype ) {
    var transparency = [];
    switch( colortype ) {
      case 0:
      case 2:
          transparency = Uint8To( 16, null, trns.data );
        break;
      case 3:
        for( var i = 0; i < trns.data.length; i++ ) {
          transparency[i] = trns.data[i];
        }
      break;
    }
    return transparency;
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

    //console.log(chunk.type.full);
    return chunk;
  }

  //Takes in decompressed IDAT data, unfilters it, draws it to a canvas and returns the canvas.
  function makeCanvasFromInflatedFullIDAT( header, data, palette, ancillaries ) {
    //console.log(data);
    var width = header.data.width;
    var height = header.data.height;

    var canvas = document.createElement( 'canvas' );
    canvas.width = width;
    canvas.height = height;

    var context = canvas.getContext( '2d' );
    context.mozImageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
    context.msImageSmoothingEnabled = false;
    context.imageSmoothingEnabled = false;  
    var imgData = context.createImageData( width, height );
    var bands = 1;
    switch( header.data.colortype ) {
      case 0: bands = 1; break; //greyscale
      case 2: bands = 3; break; //RGB
      case 3: bands = 1; break; //PLTE
      case 4: bands = 2; break; //greyscale A
      case 6: bands = 4; break; //RGBA
    }
    //console.log( bands + ' band(s)' ); 

    var rawPixelData = [];
    var pixelData;
    var dataindex = 0;
    var imgdataindex = 0;
    var pixdataindex = 0;
    var byteLength = 8;
    if( ancillaries.sBIT ) byteLength -= ancillaries.sBIT[0];
    var dataWidth =  ( width / ( 8 / header.data.bitdepth ) );
    var nextMultipleOfEight = ( dataWidth * 8 ) + 8 - ( ( dataWidth * 8 ) % 8 );
    var trailingData = ( nextMultipleOfEight - ( dataWidth * 8 ) ) / header.data.bitdepth;
    /*
    console.log( 'width: ' + width );
    console.log( 'next m of 8: ' + nextMultipleOfEight );
    console.log( 'trailingData: ' + trailingData );
    console.log( 'bitdepth: ' + header.data.bitdepth );
    console.log( 'dataWidth: ' + dataWidth );
    console.log( 'dataWidth * width: ' + dataWidth * width );
    */
    /*
    t = [0, 200, 200, 100, 50,
         1, 100,  40,  60, 80 ];
    console.log( t );
    console.log( unfilter( t, 1, 1, 2, 2, 1, 16 ) );
    console.log( t );
    console.log( unfilter( t, 2, 1, 2, 2, 1, 16 ) );
    console.log( t );
    console.log( unfilter( t, 3, 1, 2, 2, 1, 16 ) );
    console.log( t );
    console.log( unfilter( t, 4, 1, 2, 2, 1, 16 ) );
    console.log( t );
    console.log( unfilter( t, 6, 2, 2, 2, 1, 16 ) );
    console.log( t );
    console.log( unfilter( t, 7, 2, 2, 2, 1, 16 ) );
    console.log( t );
    console.log( unfilter( t, 8, 2, 2, 2, 1, 16 ) );
    console.log( t );
    console.log( unfilter( t, 9, 2, 2, 2, 1, 16 ) );
    console.log( t );
    return null;
    */
    //console.log( ancillaries.bKGD );
    
    var color = { r: 0, g: 0, b: 0, a: 0 };
    //correctedColor
    var ccolor = {};

    if( palette ) {
      //console.log(palette);
      for( var y = 0; y < height; y++ ) {
        //1 because the first byte of each scanline indicates its filter
        dataindex += 1;

        for( var x = 0; x < dataWidth; x++ ) {
          for( var b = 0; b < bands; b++ ) {
            rawPixelData.push( data[dataindex + b] );
          }
          dataindex += bands;
        }
      }
      //console.log(rawPixelData);
      pixelData = Uint8To( header.data.bitdepth, null, rawPixelData );
      //console.log(pixelData);
      
      dataindex = 0;
      
      for( var y = 0; y < height; y++ ) {

        for( var x = 0; x < width; x++ ) {

          color = palette[pixelData[dataindex]] || { r: 0, g: 0, b: 0, a: 0 };
          //correct for gamma
          ccolor.r = 255 * Math.pow( color.r / 255, 1 / ancillaries.gAMA );
          ccolor.g = 255 * Math.pow( color.g / 255, 1 / ancillaries.gAMA );
          ccolor.b = 255 * Math.pow( color.b / 255, 1 / ancillaries.gAMA );
          ccolor.a = ( ancillaries.tRNS && ancillaries.tRNS[pixelData[dataindex]] ) ? ancillaries.tRNS[pixelData[dataindex]] : 255;

          //correct for background blending formula: https://drafts.fxtf.org/compositing-1/#simplealphacompositing
          
          if( ancillaries.bKGD && false ) {
            ccolor.r = ( ( (ccolor.r / 255) * (ccolor.a / 255) ) + ( ( (palette[ ancillaries.bkGD[0] ].r / 255) * 1 ) * ( 1 - (ccolor.a / 255) ) ) ) * 255;
            ccolor.g = ( ( (ccolor.g / 255) * (ccolor.a / 255) ) + ( ( (palette[ ancillaries.bkGD[0] ].g / 255) * 1 ) * ( 1 - (ccolor.a / 255) ) ) ) * 255;
            ccolor.b = ( ( (ccolor.b / 255) * (ccolor.a / 255) ) + ( ( (palette[ ancillaries.bkGD[0] ].b / 255) * 1 ) * ( 1 - (ccolor.a / 255) ) ) ) * 255;
            ccolor.a = 255;
          }

          imgData.data[ imgdataindex + 0 ] = ccolor.r; //Red
          imgData.data[ imgdataindex + 1 ] = ccolor.g; //Green
          imgData.data[ imgdataindex + 2 ] = ccolor.b; //Blue
          imgData.data[ imgdataindex + 3 ] = ccolor.a; //Alpha

          dataindex += 1;
          imgdataindex += 4;
        }
        //Odd sized images skip some bits at the end. ex: width=9, bitdepth=1, the first line could be 10101010 10001010 and the last '1010' is thrown away
        if( dataWidth % 1 !== 0 ) {
          dataindex += trailingData;
        }
      }
    }
    else {
      var filter;

      for( var y = 0; y < height; y++ ) {
        //1 because the first byte of each scanline indicates its filter
        dataindex += 1;

        //filter = data[ y * ((width*bands) + 1) ];
        filter = getFilter( data, y, header.data.bitdepth, bands, width );
        //console.log(filter);
        if( !(filter >= 0 && filter <= 4) ) return {};

        for( var x = 0; x < dataWidth; x++ ) {
          for( var b = 0; b < bands; b++ ) {
            rawPixelData.push( unfilter( data, dataindex + b, filter, width, height, bands, header.data.bitdepth ) );
          }
          dataindex += bands;
        }
      }

      //Move data into correct bitdepth
      //console.log( rawPixelData );
      pixelData = Uint8To( header.data.bitdepth, ancillaries.sBIT, rawPixelData );
      //console.log(pixelData);
      var scalar = ( Math.pow( 2, header.data.bitdepth ) - 1 );
      //console.log(scalar);
      var value, avalue;

      for( var y = 0; y < height; y++ ) {
      
        for( var x = 0; x < width; x++ ) {
          switch( header.data.colortype ) {
            case 0:
            case 4:
              color.r = Math.pow( pixelData[ pixdataindex ] / scalar, 1 / ancillaries.gAMA ) * 255;
              color.a = ( header.data.colortype == 4 ) ? ( pixelData[ pixdataindex + 1 ] / scalar ) * 255 : 255;

              if( ancillaries.bKGD ) {
                color.r = ( ( (color.r / 255) * (color.a / 255) ) + ( ( (ancillaries.bKGD[0] / scalar) * 1 ) * ( 1 - (color.a / 255) ) ) ) * 255;
                color.a = 255;
              }

              imgData.data[ imgdataindex + 0 ] = color.r; //Red
              imgData.data[ imgdataindex + 1 ] = color.r; //Green
              imgData.data[ imgdataindex + 2 ] = color.r; //Blue
              imgData.data[ imgdataindex + 3 ] = color.a //Alpha
              
              break;
            default:
              color.r = Math.pow( pixelData[ pixdataindex + 0 ] / scalar, 1 / ancillaries.gAMA ) * 255;
              color.g = Math.pow( pixelData[ pixdataindex + 1 ] / scalar, 1 / ancillaries.gAMA ) * 255;
              color.b = Math.pow( pixelData[ pixdataindex + 2 ] / scalar, 1 / ancillaries.gAMA ) * 255;
              color.a = ( header.data.colortype == 6 ) ? ( pixelData[ pixdataindex + 3 ] / scalar ) * 255 : 255;

              if( ancillaries.bKGD && ( header.data.colortype == 2 || header.data.colortype == 6 ) ) {
                color.r = ( ( (color.r / 255) * (color.a / 255) ) + ( ( (ancillaries.bKGD[0] / scalar) * 1 ) * ( 1 - (color.a / 255) ) ) ) * 255;
                color.g = ( ( (color.g / 255) * (color.a / 255) ) + ( ( (ancillaries.bKGD[1] / scalar) * 1 ) * ( 1 - (color.a / 255) ) ) ) * 255;
                color.b = ( ( (color.b / 255) * (color.a / 255) ) + ( ( (ancillaries.bKGD[2] / scalar) * 1 ) * ( 1 - (color.a / 255) ) ) ) * 255;
                color.a = 255;
              }

              imgData.data[ imgdataindex + 0 ] = color.r; //Red
              imgData.data[ imgdataindex + 1 ] = color.g; //Green
              imgData.data[ imgdataindex + 2 ] = color.b; //Blue
              imgData.data[ imgdataindex + 3 ] = color.a; //Alpha
          }
          pixdataindex += bands;
          imgdataindex += 4;
        }
      }
    }
    context.putImageData( imgData, 0, 0 );

    return {
      'canvas': canvas,
      'metadata': {
          'header': header,
          'palette': palette,
          'ancillaries': ancillaries
        } 
      };
  }

  //Helper functions

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

  function Uint8To( bitdepth, sbit, data ) {
    var newData = [];
    var bytestr;
    var str;
    switch( bitdepth ) {
      case 1:
          for( var i = 0; i < data.length; i++ ) {
            bytestr = padByteString( data[i].toString(2) );
            if( sbit ) {
              bytestr = bytestr.substr( 0, 8 - ( sbit[ i % sbit.length ] ) );
            }
            for( var c = 0; c < 8; c++ ) {
              str = parseInt( bytestr[c], 2 );
              if( !isNaN( str ) )
                newData.push( str );
            }
          }
        break;
      case 2:
          for( var i = 0; i < data.length; i++ ) {
            bytestr = padByteString( data[i].toString(2) );
            
            newData.push( parseInt( bytestr.substr( 0, 2 ), 2 ) );
            newData.push( parseInt( bytestr.substr( 2, 2 ), 2 ) );
            newData.push( parseInt( bytestr.substr( 4, 2 ), 2 ) );
            newData.push( parseInt( bytestr.substr( 6, 2 ), 2 ) );
          }
        break;
      case 4:
          for( var i = 0; i < data.length; i++ ) {
            bytestr = padByteString( data[i].toString(2) );
            newData.push( parseInt( bytestr.substr( 0, 4 ), 2 ) );
            newData.push( parseInt( bytestr.substr( -4 ), 2 ) );
          }
        break;
      case 16:
          for( var i = 0; i < data.length; i += 2 ) {
            bytestr = padByteString( data[i].toString(2) ) + padByteString( data[i+1].toString(2) );
            newData.push( parseInt( bytestr, 2 ) );
          }
        break;
      default:
        return data;
    }
    return newData;
  }

  //Filter functions

  function getFilter( data, line, bitdepth, bands, width ) {
    return data[ line * ( ( ( width / ( 8 / bitdepth ) ) * bands ) + 1 ) ];
  }

  function unfilter( data, index, filter, width, height, bands, bitdepth ) {
    //x	the byte being filtered;
    //a	the byte corresponding to x in the pixel immediately before the pixel containing x (or the byte immediately before x, when the bit depth is less than 8);
    //b	the byte corresponding to x in the previous scanline;
    //c	the byte corresponding to b in the pixel immediately before the pixel containing b (or the byte immediately before b, when the bit depth is less than 8).
    var bytesPerScanline = ( ( width / ( 8 / bitdepth ) ) * bands ) + 1;
    //console.log( bytesPerScanline );
    //console.log( 'bpsl: ' + bytesPerScanline );
    switch( filter ) {
      case 0:
        break;
      case 1: //Recon(x) = Filt(x) + Recon(a)
          //console.log( index + '  =======================' );
          //console.log( 'val: ' + data[index] );
          //console.log( 'left: ' + getA(index) );
          data[index] = ( data[index] + getA(index) ) % 256;
        break;
      case 2: //Recon(x) = Filt(x) + Recon(b)
          //console.log( index + '  =======================' );
          //console.log( 'val: ' + data[index] );
          //console.log( 'up: ' + getB(index) );
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

    //A is the pixel value to the left, getI, when true, returns data's index instead of value
    function getA( i, getI ) {
      var a = -1;
      var scanlineNum = Math.floor( i / bytesPerScanline );
      //- 1 for filter byte
      var aScanlineNum = Math.floor( ( i - ( bands * Math.ceil( bitdepth / 8 ) ) - 1 ) / bytesPerScanline );
      //console.log( scanlineNum + ' ' + aScanlineNum );
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

    //B is the pixel value above, getI, when true, returns data's index instead of value
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

    //A is the pixel value above and to the left
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

//If we're running under Node, 
if( typeof exports !== 'undefined' ) {
    exports.PNGDecoder = PNGDecoder;
}