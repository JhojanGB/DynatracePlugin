#!/usr/bin/env node

"use strict"; 

var logger = require('./logger.js');
var files = require('./fileOperationHelper.js');
var paths = require('./pathsConstants.js');

// Close the log file after build
logger.closeLogFile()
.catch(errorHandling);

// Copy the log file from the auto instrumentor 
files.checkIfFileExists(paths.PATH_ANDROID_INSTR)
.catch(() => {
	throw(false);
})
.then((path) => { 
	return files.searchFileExtInDirectoryRecursive(path, ".log", [])
})
.then((foundFiles) => {
	let promiseFiles = [];
	for(let i = 0; i < foundFiles.length; i++){
		promiseFiles.push(files.cutFile(foundFiles[i], paths.getAndroidLogPath()));
	}
	return Promise.all(promiseFiles);
})
.catch(errorHandling);

function errorHandling(_message){
	if(_message){
		logger.logMessageSync(_message, logger.ERROR);
	}
}

