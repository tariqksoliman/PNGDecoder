//Compares two pngs canvases: one from PNGDecoder, the other the default one.
//type is a testUrls key to test a subset of images. Leave blank or set to 'all' to test all.
var Testing = function( type ) {

    //test pngs from resources/testPNGs/
    var testUrls = {
        basic:        ['resources/testPNGs/basn0g01.png', 'resources/testPNGs/basn0g02.png', 'resources/testPNGs/basn0g04.png', 'resources/testPNGs/basn0g08.png', 'resources/testPNGs/basn0g16.png',       'resources/testPNGs/basn2c08.png', 'resources/testPNGs/basn2c16.png', 'resources/testPNGs/basn3p01.png', 'resources/testPNGs/basn3p02.png', 'resources/testPNGs/basn3p04.png', 'resources/testPNGs/basn3p08.png', 'resources/testPNGs/basn4a08.png', 'resources/testPNGs/basn4a16.png', 'resources/testPNGs/basn6a08.png', 'resources/testPNGs/basn6a16.png'],
        interlacing:  [],
        odd:          [ 'resources/testPNGs/s01i3p01.png',
                        'resources/testPNGs/s01n3p01.png',
                        'resources/testPNGs/s02i3p01.png',
                        'resources/testPNGs/s02n3p01.png',
                        'resources/testPNGs/s03i3p01.png',
                        'resources/testPNGs/s03n3p01.png',
                        'resources/testPNGs/s04i3p01.png',
                        'resources/testPNGs/s04n3p01.png',
                        'resources/testPNGs/s05i3p02.png',
                        'resources/testPNGs/s05n3p02.png',
                        'resources/testPNGs/s06i3p02.png',
                        'resources/testPNGs/s06n3p02.png',
                        'resources/testPNGs/s07i3p02.png',
                        'resources/testPNGs/s07n3p02.png',
                        'resources/testPNGs/s08i3p02.png',
                        'resources/testPNGs/s08n3p02.png',
                        'resources/testPNGs/s09i3p02.png',
                        'resources/testPNGs/s09n3p02.png',
                        'resources/testPNGs/s32i3p04.png',
                        'resources/testPNGs/s32n3p04.png',
                        'resources/testPNGs/s33i3p04.png',
                        'resources/testPNGs/s33n3p04.png',
                        'resources/testPNGs/s34i3p04.png',
                        'resources/testPNGs/s34n3p04.png',
                        'resources/testPNGs/s35i3p04.png',
                        'resources/testPNGs/s35n3p04.png',
                        'resources/testPNGs/s36i3p04.png',
                        'resources/testPNGs/s36n3p04.png',
                        'resources/testPNGs/s37i3p04.png',
                        'resources/testPNGs/s37n3p04.png',
                        'resources/testPNGs/s38i3p04.png',
                        'resources/testPNGs/s38n3p04.png',
                        'resources/testPNGs/s39i3p04.png',
                        'resources/testPNGs/s39n3p04.png',
                        'resources/testPNGs/s40i3p04.png',
                        'resources/testPNGs/s40n3p04.png'
                        ],
        background:   [],
        gamma:        ['resources/testPNGs/g03n0g16.png', 'resources/testPNGs/g03n2c08.png', 'resources/testPNGs/g03n3p04.png', 'resources/testPNGs/g04n0g16.png', 'resources/testPNGs/g04n2c08.png',       'resources/testPNGs/g04n3p04.png', 'resources/testPNGs/g05n0g16.png', 'resources/testPNGs/g05n2c08.png', 'resources/testPNGs/g05n3p04.png', 'resources/testPNGs/g07n0g16.png', 'resources/testPNGs/g07n2c08.png', 'resources/testPNGs/g07n3p04.png', 'resources/testPNGs/g10n0g16.png', 'resources/testPNGs/g10n2c08.png', 'resources/testPNGs/g10n3p04.png', 'resources/testPNGs/g25n0g16.png', 'resources/testPNGs/g25n2c08.png', 'resources/testPNGs/g25n3p04.png'],
        filters:      ['resources/testPNGs/f00n0g08.png', 'resources/testPNGs/f00n2c08.png', 'resources/testPNGs/f01n0g08.png', 'resources/testPNGs/f01n2c08.png', 'resources/testPNGs/f02n0g08.png',       'resources/testPNGs/f02n2c08.png', 'resources/testPNGs/f03n0g08.png', 'resources/testPNGs/f03n2c08.png', 'resources/testPNGs/f04n0g08.png', 'resources/testPNGs/f04n2c08.png', 'resources/testPNGs/f99n0g04.png'],
        palettes:     [],
        ancillary:    [],
        order:        [],
        compression:  [],
        corrupt:      []
    }

    //Set which urls we're testing with
    var testingUrls = [];

    if( type === undefined || type == 'all' ) {
        for( var u in testUrls ) {
            testingUrls = testingUrls.concat( testUrls[u] );
        }
    }
    else {
        if( testUrls.hasOwnProperty( type ) ) {
            testingUrls = [testUrls[type][4]];
            testingUrls = testUrls[type];
        }
        else {
            console.warn( 'Unknown testing type.' );
            return;
        }
    }
    
    //Test each of those urls now
    testingURL( 0 );
    function testingURL( i ) {
        if( i >= testingUrls.length ) return; //Recursion terminator
        //Make Decoder canvas
        PNGDecoder( testingUrls[i],
            function( PNGcanvas ) {
                //Make regular canvas
                var img = new Image;
                var REGcanvas = document.createElement( 'canvas' );
                var ctx = REGcanvas.getContext( '2d' );
                document.body.appendChild( PNGcanvas );              

                img.onload = function() {
                    REGcanvas.width = img.width;
                    REGcanvas.height = img.height;                 
                    ctx.drawImage( img, 0, 0 );
                    document.body.appendChild( REGcanvas );
                    
                    if( compareCanvases( PNGcanvas, REGcanvas ) ) {
                        console.info( 'PASSED: ' + testingUrls[i] );
                    }
                    else {
                        console.warn( 'FAILED: ' + testingUrls[i] );
                    }
                    testingURL( i + 1 );
                };
                img.src = testingUrls[i];
            }
        );
    }

    function compareCanvases( canvasA, canvasB ) {
        //Get each canvas' data
        var dataUrlA = canvasA.toDataURL('image/png');
        var dataUrlB = canvasB.toDataURL('image/png');
        //Then simply compare
        return dataUrlA == dataUrlB;
    }

}    