#!/usr/bin/env node

"use strict"; 

var logger = require('./logger.js');

// Close the log file after build
logger.closeLogFile()
.catch(errorHandling);

function errorHandling(_message){
	if(_message){
		logger.logMessageSync(_message, logger.ERROR);
	}
}

