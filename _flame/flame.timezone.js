////	Timezone and Daylight-Savings-Time Detection
var d = new Date()
Date.prototype.stdTimezoneOffset = function() {
	var jan = new Date(this.getFullYear(), 0, 1)
	var jul = new Date(this.getFullYear(), 6, 1)
	return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())
}
Date.prototype.dst = function() {
	return this.getTimezoneOffset() < this.stdTimezoneOffset()
}
var flame_timezone_offset = (d.getTimezoneOffset()/-60) // 1 / -2.5
var flame_timezone_dst = d.dst() // true / false
