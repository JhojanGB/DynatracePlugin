var exec = require('cordova/exec');
var emptyFunction = function(){};

module.exports = {
	
	getCaptureStatus: function(success, error){
		success = success || emptyFunction;
        error = error || emptyFunction;
		
		exec(success, error, "DynatraceCordovaPlugin", "getCaptureStatus", []);
	}
	
}