#!/usr/bin/env node

"use strict"; 

// Imports
var os = require('os');
var config = require('./configHelper.js');
var paths = require('./pathsConstants.js');
var path = require('path');
var files = require('./fileOperationHelper.js');
var logger = require('./logger.js');
var spawn = require('child_process').spawn;

// Constants
var DTX_APPLICATION_ID = "DTXApplicationID";
var DTX_FIELD_NAME = ["DTXAgentEnvironment", "DTXClusterURL", "DTXAgentStartupPath"];

module.exports = function(){
	return config.readSettings()
	// Make the build (Android) from the properties
	.then((properties) => {
		logger.logMessageSync("Updating the android build ..", logger.INFO);
	
		// Change Gradle File
		return files.checkIfFileExists(paths.getAndroidAPKPath())
		.then(() => {	
			let agentDir = paths.getAndroidAgentDir();
			let content = createPropertiesString(properties.agentConfig[config.PLATFORM_ANDROID - 1]);

			return Promise.resolve()
			// Writing properties into properties file
			.then(() => files.writeTextToFile(agentDir + paths.FILE_ANDROID_PROPERTIES, content))
			.then(() => files.searchFileExtInDirectoryNonRecursive(paths.getAndroidAPKPath(), ".apk", []))
			.then((apkFile) => {
				if(apkFile.length == 0){
					throw("No APK available to instrument!");
				}
				
				// We do not want to instrument the APK if it is a Config Test
				if(process.env.DTX_PLUGIN_TEST == undefined){
					return instrumentAPK(agentDir, paths.FILE_ANDROID_PROPERTIES, apkFile[0])
				
					// APK is instrumented - Now Overwrite File
					.then(() => {
						let fileName = path.basename(apkFile[0], ".apk");
						let instrumentedFile = paths.getAndroidAPKPath() + paths.PATH_SEPERATOR + fileName + paths.PATH_SEPERATOR + "dist" + paths.PATH_SEPERATOR + fileName + "-final.apk";
						return files.checkIfFileExists(instrumentedFile)
						.then(() => files.deleteFile(paths.getAndroidAPKPath() + paths.PATH_SEPERATOR + fileName + ".apk", ""))
						.then(() => files.copyFile(instrumentedFile, paths.getAndroidAPKPath(), path.basename(apkFile[0])));
					});
				}
			});
		});
	})
	
	// Finish!
	.then(() => logger.logMessageSync("Successfully replaced the android build files", logger.INFO))

	.catch(errorHandling);
}

function errorHandling(error){
	logger.logMessageSync("Updating the android build failed! See the following error:", logger.ERROR);
	logger.logMessageSync(error, logger.ERROR);
	return logger.closeLogFile()
	.then(() => {
		throw new Error(error);
	});
}

function instrumentAPK(_dir, _properties, _apk){
	return new Promise(function(resolve, reject){
		logger.logMessageSync("Starting to instrument Android APK ..", logger.INFO);
		
		var cmd;
		if(os.platform() == "win32"){
			cmd = spawn('instrument.cmd', ["prop=" + _properties, "apk=\"" + _apk + "\""], { cwd: _dir, shell: true});
		}else{
			cmd = spawn('/bin/bash', ["instrument.sh", "prop=" + _properties, "apk=\"" + _apk + "\""], { cwd: _dir, shell: true});
		}
	
		
		cmd.stdout.on('data', (data) => {
			logger.logMessageSync(data, logger.INFO);
		});

		cmd.stderr.on('data', (data) => {
			logger.logMessageSync(data, logger.INFO);
		});

		cmd.on('exit', (code) => {
			resolve(true);
		});
	});
}

// Configure the Properties File
function createPropertiesString(_properties){
	let propertiesContent;
	
	// Application ID is mandatory
	if(_properties[DTX_APPLICATION_ID] != undefined){
		propertiesContent = DTX_APPLICATION_ID + "=" + _properties[DTX_APPLICATION_ID] + "\n";
	}else{
		reject("No Android application id (DTXApplicationID) available for instrumentation!");
		return;
	}
	
	// Look after other three 
	for(let i = 0; i < DTX_FIELD_NAME.length; i++){
		if(_properties[DTX_FIELD_NAME[i]] != undefined){
			propertiesContent += DTX_FIELD_NAME[i] + "=" + _properties[DTX_FIELD_NAME[i]] + "\n";
		}
	}
	
	// Set properties
	for(let key in _properties){
		if(key != DTX_APPLICATION_ID && DTX_FIELD_NAME.indexOf(key) == -1){
			propertiesContent += key + "=" + _properties[key] + "\n";
		}
	}
	
	return propertiesContent;
}