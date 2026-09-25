(
	function(e, x, t, i, n, g, u) {
		// Name of the queue function, so the loaded script can find it.
		e['flm'] = n;
		// Array to hold values passed to the function, and timestamp.
		e[n] = e[n] || function() {
			(
				e[n].q = e[n].q || []
			).push(arguments);
		},
		e[n].l = 1 * new Date();
		// Create an Asynchronous Script element
		g = x.createElement(t),
		u = x.getElementsByTagName(t)[0],
		g.async = 1,
		g.src = i,
		u.parentNode.insertBefore(g, u);
	}
)
// Replace flame.example.com with your Worker's hostname.
(
	window,                                            // e
	document,                                          // x
	'script',                                          // t
	'https://flame.example.com/flame.js?v=1',          // i
	'flame'                                            // n
	// New script element                              // g
	// First script element in document                // u
);
