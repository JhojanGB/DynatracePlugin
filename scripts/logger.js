#!/usr/bin/env node

"use strict";
 
// Imports
var fs = require('fs');
var files = require('./fileOperationHelper.js');
var paths = require('./pathsConstants.js');
var path = require('path');

// Const
var ERROR = 0;
var INFO = 1;
var WARNING = 2;

// Exports
exports.closeLogFile = closeLogFile;
exports.logMessageSync = logMessageSync;

exports.ERROR = ERROR;
exports.INFO = INFO;
exports.WARNING = WARNING;

function errorHandling(_message){
	console.log(_message);
}

// Close the log file by renaming it
function closeLogFile(){
	if(process.env.SILENT == "true"){
		return;
	}
	
	return files.checkIfFileExists(paths.getCurrentLogPath())
	.then((_file) => {
		return new Promise(function (resolve, reject){		
			let logFileName = currentDate().split(":").join("-") + ".txt";
			
			fs.rename(_file, path.join(paths.getLogPath(), logFileName), (err) => {
				if(err){
					reject("Renaming of the log file failed!");
				}
				
				resolve(path.join(paths.getLogPath(), logFileName));
			})
		});
	})
	.catch(errorHandling);
}

// Log a message but sync
function logMessageSync(_message, _logLevel){
	if(process.env.SILENT == "true"){
		return;
	}

	try {
		fs.mkdirSync(paths.getLogPath());
	} catch(e) {
		// We don't care
	}
	
	let logString;
	
	if(_logLevel == INFO){
		logString = "#INFO  ";
	}else if(_logLevel == WARNING){
		logString = "#WARN  ";
	}else if(_logLevel == ERROR){
		logString = "#ERROR ";
	}else{
		logString = "#NONE  ";
	}
	
	let outputString = logString + "[" + currentDate() + "]: " + _message;
	console.log(outputString);
	fs.appendFileSync(paths.getCurrentLogPath(), outputString + "\r\n");
}

function currentDate(){
	let tzoffset = (new Date()).getTimezoneOffset() * 60000; 
	let localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -5);
	return localISOTime.replace("T", " ");
}