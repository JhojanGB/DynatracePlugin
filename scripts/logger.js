#!/usr/bin/env node

"use strict";
 
// Imports
var fs = require('fs');
var files = require('./fileOperationHelper.js');
var paths = require('./pathsConstants.js');

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
			let date = new Date().toISOString();
			date = date.replace("T", " ");
			date = date.substring(0, date.lastIndexOf("."));
			
			let logFileName = date.replace(":", "-").replace(":", "-") + ".txt";
			
			fs.rename(_file, paths.getLogPath() + paths.PATH_SEPERATOR + logFileName, (err) => {
				if(err){
					reject("Renaming of the log file failed!");
				}
				
				resolve(paths.getLogPath() + paths.PATH_SEPERATOR + logFileName);
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

	let date = new Date().toISOString();
	date = date.replace("T", " ");
	date = date.substring(0, date.lastIndexOf("."));
	
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
	
	let outputString = logString + "[" + date + "]: " + _message;
	console.log(outputString);
	fs.appendFileSync(paths.getCurrentLogPath(), outputString + "\r\n");
}