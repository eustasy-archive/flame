////	Timezone and Daylight-Savings-Time Detection
var flame_timezone_offset = ( new Date().getTimezoneOffset() / -60 ); // 1 / -2.5
var flame_timezone_dst = (function() {
	var Now = new Date();
	var January = new Date(Now.getFullYear(), 0, 1).getTimezoneOffset();
	var July = new Date(Now.getFullYear(), 6, 1).getTimezoneOffset();
	return Now.getTimezoneOffset() < Math.max(January, July);
})(); // true / false
