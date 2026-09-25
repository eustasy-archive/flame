////	Timezone and Daylight-Savings-Time Detection
export function timezone() {
	var Now = new Date();
	var January = new Date(Now.getFullYear(), 0, 1).getTimezoneOffset();
	var July = new Date(Now.getFullYear(), 6, 1).getTimezoneOffset();
	return {
		offset: ( Now.getTimezoneOffset() / -60 ),                  // 1 / -2.5
		dst:    Now.getTimezoneOffset() < Math.max(January, July)  // true / false
	};
}
