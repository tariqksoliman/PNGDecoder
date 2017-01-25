# PNGDecoder

* Overview  
PNGDecoder reads the raw bits of a png image and returns a canvas of the decoded image. It's not perfect.  

 * Usage:  

   ```javascript
   PNGDecoder( 'urltopng.png', function( PNGcanvas ) {  
         //PNGCanvas is a document canvas element   
   } );
   ```  

      If you'd like to change the image to be decoded, open up scripts/js/app.js and change/comment/uncomment the url parameter for PNGDecoder, save and refresh the page.

* The PNG File Format  
  (Bytes are all unsigned big-endian)  
  This image format begins with a file signature followed by chunks.  
  * Signature:  
    * Detect Channel: 1 Byte  
      Non-ASCII to decrease chances of being interpreted as a text file and formatted in such a way to detect if a bit was cut off.
    * P: 1 Byte  
    * N: 1 Byte  
    * G: 1 Byte  
    * Carriage Return Character: 1 Byte  
    * Line Feed Character: 1 Byte  
    * DOS End Of File Character: 1 Byte  
    * Unix Line Feed Character: 1 Byte  

    The signature is always (as decimals):  
    `137 80 78 71 13 10 26 10`  

    ---  

  * Chunks:  
    PNGs main data structure is a chunk.  

    A chunk consists of:
    * Length: 4 Bytes  
        Length of the data section
    * Chunk Type: 4 Bytes
    * Data: Length Bytes
    * CRC: 4 Bytes  
        Cyclic Redundancy Code to check for corruption.  
    
    Chunk naming:  
      The chunk name indicates what is stored in its data.  
      Each letter in its name can be uppercase [U] or lowercase [l] to indicate more information about the chunk:  
    * First byte: [U] = critical, [l] = ancillary
        Critical chunks must be understood by both encoders and decoder while ancillary, or supportive, chunks need not be.  
    * Second byte: [U] = public, [l] = private
    * Third byte: currently unused  
    * Fourth byte: [U] = unsafe to copy, [l] = safe to copy  

    Types of critical chunks:  
    * IHDR: Image HeaDeR, data about the image, always the first chunk  
      * Length: 4 Bytes
      * Chunk Type: 4 Bytes (IHDR)
      * Width: 4 Bytes
      * Height: 4 Bytes
      * Bit Depth: 1 Byte  
          Bits per channel
      * Color Type: 1 Byte  
          Such as greyscale, rgb, rgba, indexed color...
      * Compression Method: 1 Byte
      * Filter Method: 1 Byte
      * Interlace Method: 1 Byte
      * CRC: 1 Byte  
    * PLTE: PaLeTtE, used for indexed color, at most one and always before IDAT  
      The PLTE chunk's data stores rgb values like so: rgbrgbrgbrgbrgbrgb... where the first triplet shall be index 0, the second index 1 and so on.  
    * IDAT: Image DATa, store the main pixel data, at least zero of them  
      Compressed and filtered image data.  
    * IEND: Image END, indicates the end of the file, always at the end  

    ---  

  * Compression:  
    All IDAT chunk data is compressed with the deflate algorithm. The deflate algorithm is a combination Huffman prefix coding and LZ77. Deflate algorithm by [Pako.js](https://github.com/nodeca/pako).  
    * Huffman coding:  
      Huffman coding relies on using the frequency of elements and gives those elements that are most frequent a shorter identifier. It's like renaming the most frequent word in English 'the' to just be 'e'. It also ensures that no identifier is a prefix to another identifier. So if we rename 'the' to 'e', none of our other English words can start with 'e'.  
    * LZ77:  
      Where Huffman coding relied on frequency, LZ77 compression relies on repetition. Take the sentence 'the end is never the end is never the end is never the end' for example. Using LZ77, we find the best repetitions and replace them with the length of the repetition as well as how many spaces but we'd have to go to the previous repetition. So our sentence can become 'the end is never [17,34]the end'. 17 because the start of the repetition is 17 characters back and 34 because from that start we take the next 34 characters (this makes us take some characters that are already taken in our repetition block. 

    ---  

  * Filtering:  
    Filtering further compresses down data by relating it to previous data. For example if I have to follow numbers '89 89 90 92', I could compress it into '89 0 1 3' by storing the difference with what the previous number represents. PNG currently has four filtering methods as well as no filtering. Each scaline/row in the image can have its own filter and it's indicated by the first byte in that row. The four filtering methods are:  
    * Sub: Value = Current pixel band value - previous pixel band value on same row  
    * Up: Value = Current pixel band value - corresponding pixel on previous row value  
    * Average: Value = Current pixel band value - the average of the previous pixel band value on same row and corresponding pixel on previous row value  
    * Paeth: Value = Current pixel band value - paeth predicted value which takes into account the top, left and top left pixel values  
      
 
* Algorithm
 1. Get the raw image data  
 1. Check the signature  
 1. Get the header chunk  
 1. Iterate over all chunks after the header chunk until the end chunk  
 1. Check for a palette chunk and create the palette if there is one
 1. Decompress the data with [Pako.js](https://github.com/nodeca/pako)  
 1. Write the data to a canvas  
    * If it has a palette, read bytes as indices from the palette  
    * If not, read bytes while applying the above filters  
 1. Return that canvas  

* Resources
    * [PNG Specification](https://www.w3.org/TR/PNG/)
    * [PNG Compression](http://www.zlib.org/feldspar.html) 


---
