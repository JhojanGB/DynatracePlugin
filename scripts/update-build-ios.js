#!/usr/bin/env node

"use strict"; 

// Imports
var fs = require('fs');
var config = require('./configHelper.js');
var paths = require('./pathsConstants.js');
var files = require('./fileOperationHelper.js');
var logger = require('./logger.js');

// Const
var DIR_SEARCH_EXCEPTION = ["build", "cordova", "CordovaLib"];
var PROPERTIES_IOS_INSET = "    ";

module.exports = function(){
	logger.logMessageSync("Updating the iOS build ..", logger.INFO);
	
	return config.readSettings()
	// Make the two builds (Android and Ios) from the properties
	.then((properties) => {
		// Ios Build
		return files.searchFilesInDirectoryRecursive(paths.PATH_IOS, "-Info.plist", DIR_SEARCH_EXCEPTION)
		.then((file) => {
			if(file.length > 1){
				logger.logMessageSync("Found several -Info.plist files, will take the first one: " + file[0], logger.WARN);
			}else if(file.length == 0){
				throw("No -Info.plist file found. iOS Instrumentation can not be completed by the script");
			}
			return configureIosBuild(properties[config.PLATFORM_IOS - 1], file[0])
			.then((pListContent) => files.writeTextToFile(file[0], pListContent));
		})
		.then(() => {logger.logMessageSync("Successfully configured iOS build!", logger.INFO);})
		.catch(errorHandling);
	})

	.catch(errorHandling);
}

function errorHandling(error){
	logger.logMessageSync("Updating the ios build failed! See the following error:", logger.ERROR);
	logger.logMessageSync(error, logger.ERROR);
	return logger.closeLogFile()
	.then(() => {
		throw new Error(error);
	});
}

// Read the plist file and remove the old elements
function configureIosBuild(_properties, _file){
	return new Promise(function(resolve, reject){
		fs.readFile(_file, "utf8", (err, data) => {
			if(err){
				reject("Could not configure ios build because plist file is not available!");
				return;
			}
			
			let lines = data.split("\n");
			let markedIndexes = [];
			let lastDictIndex = 0;
			
			// Searching for our Properties - They will be removed
			for(let i = 0; i < lines.length; i++){
				if(lines[i].indexOf("<key>DTX") > -1){
					// Property found which is ours
					markedIndexes.push(i);
				}else if(lines[i].indexOf("</dict>") > -1){
					lastDictIndex = i;
				}
			}
			
			let deletedLines = 0;
			
			// Remove our properties
			for(let i = 0; i < markedIndexes.length; i++){
				lines.splice(markedIndexes[i] - deletedLines, 2);
				deletedLines += 2;
			}
			
			// Check if mandatory properties are here
			if(_properties["DTXApplicationID"] == undefined){
				reject("No iOS application id available for instrumentation!");
				return;
			}
			
			// Build Properties
			let newProperties = "";
			for(let key in _properties){
				newProperties += createPropertyKeyLine(key) + "\n" + createPropertyValueLine(_properties[key]) + "\n";
			}
			
			newProperties = newProperties.substring(0, newProperties.length - 1);
			lines.splice(lastDictIndex - deletedLines, 0, newProperties);
			resolve(lines.join("\n"));
		})
	});
}

// Create the line which contains a property key
function createPropertyKeyLine(_key){
	return PROPERTIES_IOS_INSET + "<key>" + _key + "</key>";
}

// Creates the line which contains the string for a key
function createPropertyValueLine(_value){
	return PROPERTIES_IOS_INSET + "<string>" + _value + "</string>";
}
