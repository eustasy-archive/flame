<?php



$Request  = basename( filter_input(INPUT_SERVER, 'REQUEST_URI'    ) );
$HTTP     =           filter_input(INPUT_SERVER, 'SERVER_PROTOCOL');
$Verbose  =           filter_input(INPUT_GET,    'verbose'        );

if ( $Verbose ) {
	$Suffix['JS'] = '.js';
} else {
	$Suffix['JS'] = '.min.js';
}


// IF SCRIPT
if ( 'script' == substr($Request, 0, 6) ) {

	header('Content-Type: application/javascript');

	$Script = file_get_contents(__DIR__.'/script'.$Suffix['JS']);
	echo $Script;

// END IF SCRIPT



// IF INLINE
} else if ( 'inline' == substr($Request, 0, 6) ) {

	header('Content-Type: application/javascript');

	$Inline = file_get_contents(__DIR__.'/flame.inline'.$Suffix['JS']);
	echo $Inline;

// END IF INLINE



// IF FLAME
} else {

	header('Content-Type: application/javascript');

	// TODO Settings

	$Scripts[] = file_get_contents(__DIR__.'/_flame/lib.platform'.$Suffix['JS']);

	// TODO Use suffix
	$Scripts[] = file_get_contents(__DIR__.'/_flame/function.getElementsByAttribute.js');//.$Suffix['JS']);
	$Scripts[] = file_get_contents(__DIR__.'/_flame/flame.session.js');//.$Suffix['JS']);
	$Scripts[] = file_get_contents(__DIR__.'/_flame/flame.language.js');//.$Suffix['JS']);
	$Scripts[] = file_get_contents(__DIR__.'/_flame/flame.page.js');//.$Suffix['JS']);
	$Scripts[] = file_get_contents(__DIR__.'/_flame/flame.timezone.js');//.$Suffix['JS']);
	$Scripts[] = file_get_contents(__DIR__.'/_flame/flame.processor.js');//.$Suffix['JS']);

	foreach ( $Scripts as $Script ) {
		echo $Script;
		echo "\n";
	}

// END IF FLAME


// ELSE REDIRECT
//} else {

	//header($HTTP.' 301 Moved Permanently');
	//header('Location: http://extinguisher.io');
	// TODO HTTPS When available

} // END ELSE REDIRECT
