#!/usr/bin/env node

"use strict"; 

var files = require('./fileOperationHelper.js');
var config = require('./configHelper.js');
var logger = require('./logger.js');

exports.PATH_SEPERATOR = "/";
exports.PATH_PLUGIN = __dirname + "/..";
exports.PATH_APPLICATION = exports.PATH_PLUGIN + "/../..";
exports.PATH_IOS = exports.PATH_APPLICATION + "/platforms/ios";

// PATHS
var PATH_LOGS = "/logs";
var PATH_WWW = "/www";
var PATH_ASSETS = "/assets";
var PATH_ANDROID = exports.PATH_APPLICATION + "/platforms/android";
var PATH_FILES = "/files";

exports.PATH_ANDROID_INSTR =  PATH_ANDROID + "/build/tmp/autoInstrumentDebug/logs";

// Files
var FILE_PACKAGE = "package.json";
var FILE_CREDENTIALS = "dynatrace.credentials";
var FILE_CONFIG = "dynatrace.config";
var FILE_CURRENT_LOG = "currentLog.txt";

exports.FILE_ANDROID_PROPERTIES = "cordova.properties";
exports.FILE_JSAGENT = "dtAgent.js";


// Build Path

exports.getConfigFilePath = function(){
	if(process.env.CUSTOM_CONFIG){
		return process.env.CUSTOM_CONFIG;
	}
	
	return exports.PATH_APPLICATION + exports.PATH_SEPERATOR + FILE_CONFIG;
}

exports.getAndroidAPKPath = function(){
	return PATH_ANDROID + "/build/outputs/apk";
}

exports.getDownloadJSAgentPath = function(){
	return exports.PATH_PLUGIN + PATH_FILES + exports.PATH_SEPERATOR + exports.FILE_JSAGENT;
}

exports.getJSAgentSubDir = function(){
	return PATH_ASSETS.substring(1, PATH_ASSETS.length);
}

exports.getAndroidAgentDir = function(){
	return exports.PATH_PLUGIN + PATH_FILES + "/Android/"
}

exports.getCurrentLogPath = function(){
	return exports.PATH_PLUGIN + PATH_LOGS + exports.PATH_SEPERATOR + FILE_CURRENT_LOG;
}

exports.getLogPath = function(){
	return exports.PATH_PLUGIN + PATH_LOGS;
}

exports.getAndroidLogPath = function(){
	return exports.PATH_PLUGIN + PATH_LOGS + "/android";
}

exports.getWWWPath = function(){
	return readEnv(config.CUSTOM_WWW_DIR)
	.then((wwwDir) => {
		if(wwwDir){
			if(wwwDir.startsWith("/")){
				return exports.PATH_APPLICATION + wwwDir;
			}else{
				return exports.PATH_APPLICATION + exports.PATH_SEPERATOR + wwwDir;
			}
		}else{
			// Property is not available - default src
			return exports.PATH_APPLICATION + PATH_WWW;
		}
	})
	.catch((err) => {
		// Package JSON is not available. Return the default src
		return exports.PATH_APPLICATION + PATH_WWW;
	});	
}

exports.getSourcePath = function(){
	return readEnv(config.CUSTOM_SRC_DIR)
	.then((sourceDir) => {
		if(sourceDir){
			logger.logMessageSync("Will use custom_src_dir: " + sourceDir, logger.INFO);

			if(sourceDir.startsWith("/")){
				return exports.PATH_APPLICATION + sourceDir;
			}else{
				return exports.PATH_APPLICATION + exports.PATH_SEPERATOR + sourceDir;
			}
		}else{
			// Property is not available => throw
			throw new Error("custom_src_dir not available - will try default src");
		}
	})
	.catch((err) => {
		// Package JSON is not available. Return the default src
		return files.checkIfFileExists(exports.PATH_APPLICATION + "/src")
		.catch(() => {
			logger.logMessageSync("Did not find the src directory will try www instead.", logger.WARNING);
			return exports.PATH_APPLICATION + PATH_WWW;
		});
	});	
}

exports.getMainPath = function(){
	return readEnv(config.IONIC_APP_ENTRY_POINT)
	.then((appEntry) => {
		if(appEntry){
			if(appEntry.startsWith("/")){
				return appEntry;
			}else{
				return exports.PATH_SEPERATOR + appEntry;
			}
		}else{
			return exports.PATH_MAIN + exports.PATH_SEPERATOR + exports.FILE_MAIN;
		}
	})
	.catch((err) => {
		// Package JSON is not available. Return the default src
		return exports.PATH_MAIN + exports.PATH_SEPERATOR + exports.FILE_MAIN;
	});	
}

exports.getCustomHTML = function(){
	return exports.getSourcePath()
	.then((sourcePath) => {
		return readEnv(config.CUSTOM_HTML_FILE)
		.then((htmlFile) => {
			if(htmlFile){
				if(htmlFile.startsWith("/")){
					return sourcePath + htmlFile;
				}else{
					return sourcePath + exports.PATH_SEPERATOR + htmlFile;
				}
			}else{
				return false;
			}
		});
	})
	.catch(() => {
		// Package JSON is not available. Return the default src
		return false;
	});	
}

exports.getCredentialsPath = function(){
	return exports.PATH_APPLICATION + exports.PATH_SEPERATOR + FILE_CREDENTIALS;
}

function readEnv(_env){
	return files.checkIfFileExists(exports.PATH_APPLICATION + exports.PATH_SEPERATOR + FILE_PACKAGE)
	.then((file) => { return files.readTextFromFile(file); })
	.then((fileData) => {	
		// Check if source directory is set
		let srcIndex = fileData.indexOf(_env);
		if(srcIndex > -1){
			let valueBegin = fileData.indexOf("\"", srcIndex + _env.length + 1);
			let property = fileData.substring(valueBegin + 1, fileData.indexOf("\"", valueBegin + 1));
			return property;
		}else{
			// Property is not available
			return false;
		}
	});
}