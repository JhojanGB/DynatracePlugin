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

if(process.env.TESTING){
	exports.isReleaseBuild = isReleaseBuild;
	exports.isAPKUnsigned = isAPKUnsigned;
}

exports.updateAndroidBuild = updateAndroidBuild;

async function updateAndroidBuild(){
	try{
		let properties = await config.readSettings();

		logger.logMessageSync("Updating the android build ..", logger.INFO);

		let androidPath = await paths.getAndroidAPKPath();
		let agentDir = paths.getAndroidAgentDir();
		let content = createPropertiesString(properties.agentConfig[config.PLATFORM_ANDROID - 1]);

		await files.writeTextToFile(path.join(agentDir, paths.FILE_ANDROID_PROPERTIES), content);
		let apkFiles = await files.searchFileExtInDirectoryRecursive(androidPath, ".apk", []);

		if(apkFiles.length == 0){
			throw("No APK available to instrument!");
		}

		if(process.env.DTX_PLUGIN_TEST == undefined){
			for(let i = 0; i < apkFiles.length; i++){
				await instrumentAPK(apkFiles[i]);
			}
		}

		logger.logMessageSync("Successfully replaced the android build files", logger.INFO);
	}catch(e){
		errorHandling(e);
	}
}

/**
 * Checks wheter this build is a release build
 * @param {*} options Context of the CLI call
 * @returns {boolean} True = Release build
 */
function isReleaseBuild(options){
	try{
		if(options.opts.options.release){
			return true;
		}
	}catch(e){
		return false;
	}

	return false;
}

/**
 * Checks wheter the apkfile is an unsigned one or not
 * @param {string} apkFile path of the apkfile 
 * @returns {boolean} True = unsigned
 */
function isAPKUnsigned(apkFile){
	try{
		let fileName = path.basename(apkFile);
		if(fileName.includes("unsigned")){
			return true;
		}
	}catch(e){
		return false;
	}

	return false;
}

/**
 * Instruments the APK file
 * @param {string} apkFile Path of the apk file
 * @returns {void}
 */
async function instrumentAPK(apkFile){
	await _instrumentAPK(paths.getAndroidAgentDir(), paths.FILE_ANDROID_PROPERTIES, apkFile);

	// APK(s) is/are instrumented - Now Overwrite File(s)
	let fileName = path.basename(apkFile, ".apk");
	let instrumentedFileName = fileName;

	if(!isAPKUnsigned(apkFile)){
		instrumentedFileName += "-final.apk";
	}else{
		instrumentedFileName += ".apk";
	}

	let instrumentedFile = path.join(path.dirname(apkFile), fileName, "dist", instrumentedFileName);

	await files.checkIfFileExists(instrumentedFile)

	// Delete Original APK
	await files.deleteFile(path.join(path.dirname(apkFile), fileName + ".apk"), "")
	// Move instrumented one to place of Original APK
	await files.copyFile(instrumentedFile, path.dirname(apkFile), path.basename(apkFile));
}

async function errorHandling(error){
	if(error.message == config.ERROR_CONFIG_NOT_AVAILABLE){
		logger.logMessageSync("Dynatrace Cordova Plugin configuration is not available! Skip instrumenting Android build.", logger.ERROR);
	}else{
		logger.logMessageSync("Updating the android build failed! See the following error:", logger.ERROR);
		logger.logMessageSync(error, logger.ERROR);
		await logger.closeLogFile()
		throw new Error(error);
	}
}

function _instrumentAPK(_dir, _properties, _apk){
	return new Promise(function(resolve, reject){
		logger.logMessageSync("Starting to instrument Android APK ..", logger.INFO);
		
		var cmd;
		if(os.platform() == "win32"){
			cmd = spawn('instrument.cmd', ["prop=" + _properties, "apk=\"" + _apk + "\""], { cwd: _dir, shell: true});
		}else{
			cmd = spawn('/bin/bash', [path.join(__dirname, "..", "files", "Android", "instrument.sh"), "prop=" + path.join(__dirname, "..", "files", "Android", _properties), "apk=\"" + _apk + "\""], {});
		}
	
		
		cmd.stdout.on('data', (data) => {
			logger.logMessageSync(data, logger.INFO);
		});

		cmd.stderr.on('data', (data) => {
			logger.logMessageSync(data, logger.INFO);
		});

		cmd.on('exit', () => {
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
		logger.logMessageSync("No Android application id (DTXApplicationID) available for instrumentation!", logger.ERROR);
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