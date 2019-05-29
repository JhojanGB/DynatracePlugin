#!/usr/bin/env node

"use strict"; 

var files = require('./fileOperationHelper.js');
var config = require('./configHelper.js');
var logger = require('./logger.js');
var path = require('path');

// FOLDERS
const FOLDER_PLATFORMS = "platforms";
exports.FOLDER_ASSETS = "assets";
exports.FOLDER_WWW = "www";
const FOLDER_FILES = "files";
const FOLDER_LOGS = "logs";
const FOLDER_SRC = "src";
const FOLDER_ANDROID_APP = "app";

// Files
const FILE_PACKAGE = "package.json";
const FILE_CREDENTIALS = "dynatrace.credentials";
const FILE_CONFIG = "dynatrace.config";
const FILE_CURRENT_LOG = "currentLog.txt";

exports.FILE_JSAGENT = "dtAgent.js";
exports.FILE_ANDROID_PROPERTIES = "cordova.properties";

// Build Path
var rootPath = __dirname;

exports.setRoot = function(newRoot){
	rootPath = path.resolve(newRoot);
}

function getPluginPath(){
	return path.join(rootPath, "..");
}

exports.getApplicationPath = function(){
	return path.join(getPluginPath(), "..", "..");
}

exports.getIosPath = function(){
	return path.join(exports.getApplicationPath(), FOLDER_PLATFORMS, "ios");
}

exports.getAndroidPath = function(){
	return path.join(exports.getApplicationPath(), FOLDER_PLATFORMS, "android");
}

exports.getPlatformPath = function(){
	return path.join(exports.getApplicationPath(), FOLDER_PLATFORMS);
}

exports.getConfigFilePath = function(){
	if(process.env.CUSTOM_CONFIG){
		return process.env.CUSTOM_CONFIG;
	}
	
	return path.join(exports.getApplicationPath(), FILE_CONFIG);
}

exports.getAndroidAssetsPath = function(){
	return files.checkIfFileExists(path.join(exports.getAndroidPath(), exports.FOLDER_ASSETS, exports.FOLDER_WWW))
	.then((_file) => {
		return _file;
	})
	.catch(() => {return path.join(exports.getAndroidPath(), FOLDER_ANDROID_APP, "src", "main", exports.FOLDER_ASSETS, exports.FOLDER_WWW)});
}

exports.getIOSAssetsPath = function(){
	return path.join(exports.getIosPath(), exports.FOLDER_WWW);
}

exports.getAndroidAPKPath = function(){
	return files.checkIfFileExists(path.join(exports.getAndroidPath(), exports.FOLDER_ASSETS, exports.FOLDER_WWW))
	.then(() => {
		return path.join(exports.getAndroidPath(), "build", "outputs", "apk");
	})
	.catch(() => {return path.join(exports.getAndroidPath(), FOLDER_ANDROID_APP, "build", "outputs", "apk")});
}

exports.getDownloadJSAgentPath = function(){
	return path.join(getPluginPath(), FOLDER_FILES, exports.FILE_JSAGENT);
}

exports.getAndroidAgentDir = function(){
	return path.join(getPluginPath(), FOLDER_FILES, "Android");
}

exports.getCurrentLogPath = function(){
	return path.join(exports.getLogPath(), FILE_CURRENT_LOG);
}

exports.getLogPath = function(){
	return path.join(getPluginPath(), FOLDER_LOGS);
}

function _getWWWPath (){
	return path.join(exports.getApplicationPath(), exports.FOLDER_WWW);
}

exports.getWWWPath = function(){
	return readEnv(config.CUSTOM_WWW_DIR)
	.then((wwwDir) => {
		if(wwwDir){
			return path.join(exports.getApplicationPath(), wwwDir);
		}else{
			// Property is not available - default src
			return _getWWWPath();
		}
	})
	.catch(() => {
		// Package JSON is not available. Return the default src
		return _getWWWPath();
	});	
}

exports.getSourcePath = function(){
	return readEnv(config.CUSTOM_SRC_DIR)
	.then((sourceDir) => {
		if(sourceDir){
			logger.logMessageSync("Will use custom_src_dir: " + path.resolve(sourceDir), logger.INFO);
			return path.join(exports.getApplicationPath(), sourceDir);
		}else{
			// Property is not available => throw
			throw new Error("custom_src_dir not available - will try default src");
		}
	})
	.catch(() => {
		// Package JSON is not available. Return the default src
		return files.checkIfFileExists(path.join(exports.getApplicationPath(), FOLDER_SRC))
		.catch(() => {
			logger.logMessageSync("Did not find the src directory will try www instead.", logger.WARNING);
			return _getWWWPath();
		});
	});	
}

exports.getCustomHTML = function(sourcePath){
	if(sourcePath == undefined){
		return exports.getSourcePath()
		.then((sourcePathNew) => {
			return readCustomHTML(sourcePathNew);
		});
	}else{
		return readCustomHTML(sourcePath);
	}
}

function readCustomHTML(sourcePath){
	return readEnv(config.CUSTOM_HTML_FILE)
	.then((htmlFile) => {
		if(htmlFile){
			return path.join(sourcePath, htmlFile);
		}else{
			return false;
		}
	})
	.catch(() => {
		// Package JSON is not available. Return the default src
		return false;
	});	
}

exports.getCredentialsPath = function(){
	return path.join(exports.getApplicationPath(), FILE_CREDENTIALS);
}

function readEnv(_env){
	return files.checkIfFileExists(path.join(exports.getApplicationPath(), FILE_PACKAGE))
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