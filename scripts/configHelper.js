#!/usr/bin/env node

"use strict";
 
// Imports
var fs = require('fs');
var files = require('./fileOperationHelper.js');
var paths = require('./pathsConstants.js');
var logger = require('./logger.js');

// Config File
var TAG_GENERAL = "GENERAL";
var TAG_MOBILE = "NATIVE";
var TAG_JSAGENT = "JSAGENT";

// JSAgent Properties
var APPMON_JSAGENT_PROPERTIES = ["appName", "profile", "username", "password", "url"];
var DYNATRACE_JSAGENT_PROPERTIES = ["apitoken", "url"];

// AGENT Properties
var APPMON_MOBILEAGENT_PROPERTIES = ["DTXApplicationID", "DTXAgentStartupPath"];
var DYNATRACE_SAAS_MOBILEAGENT_PROPERTIES = ["DTXApplicationID", "DTXAgentEnvironment"];
var DYNATRACE_MANAGED_MOBILEAGENT_PROPERTIES = ["DTXApplicationID", "DTXAgentEnvironment", "DTXManagedCluster", "DTXClusterURL"];

// General Properties
var PROPERTY_UPDATE = "AUTO_UPDATE";
var PROPERTY_UPDATE_DEFAULT = "false";

// Platforms
var PLATFORM_ALL = 0;
var PLATFORM_IOS = 1;
var PLATFORM_ANDROID = 2;

// Dynatrace System
var DYNATRACE_APPMON = 0;
var DYNATRACE_SAAS = 1;
var DYNATRACE_MANAGED = 2;

// Environment Variables
var CUSTOM_SRC_DIR = "custom_src_dir";
var CUSTOM_WWW_DIR = "custom_www_dir";
var CUSTOM_HTML_FILE = "custom_html_file";
var ALTERNATIVE_CONFIG = "--config=";

// Constants
var allConfigs = {};

// Exports
exports.readSettings = readSettings;

exports.PLATFORM_ANDROID = PLATFORM_ANDROID;
exports.PLATFORM_IOS = PLATFORM_IOS;
exports.DYNATRACE_APPMON = DYNATRACE_APPMON;
exports.DYNATRACE_MANAGED = DYNATRACE_MANAGED;
exports.DYNATRACE_SAAS = DYNATRACE_SAAS;

exports.CUSTOM_SRC_DIR = CUSTOM_SRC_DIR;
exports.CUSTOM_WWW_DIR = CUSTOM_WWW_DIR;
exports.CUSTOM_HTML_FILE = CUSTOM_HTML_FILE;

if(process.env.TESTING){
	exports.resetConfig = resetConfig;
}

function resetConfig(){
	allConfigs = {};
}

// Checks if there will be an alternative configuration used 
function checkIfAlternativeConfig(){
	return new Promise(function(resolve, reject){
		for(let i = 0; i < process.argv.length; i++){
			if(process.argv[i].startsWith(ALTERNATIVE_CONFIG)){
				let fileConfig = process.argv[i].substring(ALTERNATIVE_CONFIG.length);
				fileConfig = paths.PATH_APPLICATION + paths.PATH_SEPERATOR + fileConfig;
				logger.logMessageSync("Found alternative configuration file: " + fileConfig, logger.INFO);
				return files.checkIfFileExists(fileConfig)
				.then((file) => {
					process.env.CUSTOM_CONFIG = file;
					resolve(file);
					return;
				})
				.catch((err) => {
					logger.logMessageSync("The alternative configuration file is not available! Check the path!", logger.ERROR);
					reject("The alternative configuration file is not available! Check the path!");
					return;
				});
			}
		}
		
		resolve(false);
		return;
	});
}

function readSettings(){
	if(Object.keys(allConfigs).length != 0){
		return Promise.resolve(allConfigs);
	}

	allConfigs = {};
	
	return checkIfAlternativeConfig()
	.then(() => {
		return readJSAgentProperties();
	})
	.then((jsAgentConfig) => {
		allConfigs.jsAgentConfig = jsAgentConfig;
		return readGeneralProperties();
	})
	.then((generalConfig) => {
		allConfigs.generalConfig = generalConfig;
		return readAgentProperties();
	})
	.then((agentConfig) => {
		allConfigs.agentConfig = agentConfig;
		allConfigs.type = parseTypeFromAgentConfig(agentConfig);
		
		// Check if Configs are valid
		if(checkSettingProperties(allConfigs)){
			return allConfigs;
		}else{
			throw("Settings of JSAgent or Mobile Agent are wrong! Setup not possible!");
		}
	})
	.then(() => {
		// Read all the paths
		return Promise.resolve()

		// Read Source Dir
		.then(() => {
			allConfigs.paths = {};
			return paths.getSourcePath();
		})

		// Read WWW Dir
		.then((sourceDir) => {
			allConfigs.paths.srcDir = sourceDir;
			return paths.getWWWPath();
		})

		.then((wwwDir) => {
			allConfigs.paths.wwwDir = wwwDir;
			return paths.getCustomHTML();
		})

		.then((customHTML) => {
			allConfigs.paths.customHTML = customHTML;
			return paths.getMainPath();
		})

		.then((mainPath) => {
			allConfigs.paths.mainDir = mainPath;
		});
	})
	
	.then(() => {
		return allConfigs;
	});
}

// Read the settings for the api js agent download
function readJSAgentProperties(){
	return Promise.resolve()
	// Check if a Credentials File was defined over a ENV variable
	.then(() => {
		if(process.env.DTX_CRED_FILE != undefined && process.env.DTX_CRED_FILE != "undefined"){
			return process.env.DTX_CRED_FILE;
		}else{
			// Check if the user made a credentials file
			return files.checkIfFileExists(paths.getCredentialsPath())
			.catch((err) => {
				// Credential file is not available. Continue
				return false;
			});
		}
	})
	.then((_customCredentialAvailable) =>{
		if(_customCredentialAvailable){
			// Credentials File Read
			// logger.logMessageSync("Using credentials file for downloading JSAgent!", logger.INFO);
			return _customCredentialAvailable;
		}else{
			// Read Plugin
			return files.checkIfFileExists(paths.getConfigFilePath());
		}
	})
	.then((_file) => {return readPropertiesFromFile(_file, TAG_JSAGENT)})
	.then((_data) => {return parseJSAgentPropertyData(_data)});
}

// Read the DTX Properties
function readAgentProperties(){
	return files.checkIfFileExists(paths.getConfigFilePath())
	.then((_file) => {return readPropertiesFromFile(_file, TAG_MOBILE)})
	.then((_data) => {return parseAgentPropertyData(_data)});
}

// Read the config file of the application
function readGeneralProperties(){
	return Promise.resolve()
	.then(() => {return files.checkIfFileExists(paths.getConfigFilePath())})
	.then((_file) => {return readPropertiesFromFile(_file, TAG_GENERAL)})
	.then((_data) => {return parseGeneralPropertyData(_data)});
}

// Read the properties form the config file
function readPropertiesFromFile(_file, _tag){
	return new Promise(function(resolve, reject){
		fs.readFile(_file, "utf8", (err, data) => {
			if(err){
				reject("File can not be read: " + _file);
				return;
			}
			
			let pluginStart = data.indexOf("<" + _tag);
			
			if(pluginStart == -1){
				// Tag is not even there 
				logger.logMessageSync("The whole " + _tag + " tag is missing! Make sure the dynatrace.config is correct!", logger.WARNING);
				resolve(false);
			}else{
				pluginStart = data.indexOf("\n", pluginStart);
				let pluginEnd = data.indexOf("</" + _tag, pluginStart);
				let pluginData = data.substring(pluginStart, pluginEnd);
				let pluginDataLines = pluginData.split("\n");
				
				resolve(pluginDataLines);
			}
		});
	});
}

// Check if properties are correct and if not return false
function checkSettingProperties(_allConfigs){
	if(_allConfigs.type == DYNATRACE_APPMON){
		// AppMon
		return checkPropertiesList(_allConfigs.jsAgentConfig, APPMON_JSAGENT_PROPERTIES)
			&& checkPropertiesList(_allConfigs.agentConfig[0], APPMON_MOBILEAGENT_PROPERTIES)
			&& checkPropertiesList(_allConfigs.agentConfig[1], APPMON_MOBILEAGENT_PROPERTIES);
	}else{
		// Dynatrace
		let returnValue = checkPropertiesList(_allConfigs.jsAgentConfig, DYNATRACE_JSAGENT_PROPERTIES);
		
		if(_allConfigs.jsAgentConfig.url.indexOf("jsInlineScript") == -1){
			throw("Wrong Dynatrace JS Agent URL used! You have to use the URL which contains jsInlineScript!")
		}
		
		if(_allConfigs.type == DYNATRACE_SAAS){
			return returnValue && checkPropertiesList(_allConfigs.agentConfig[0], DYNATRACE_SAAS_MOBILEAGENT_PROPERTIES)
			&& checkPropertiesList(_allConfigs.agentConfig[1], DYNATRACE_SAAS_MOBILEAGENT_PROPERTIES);
		}else{
			return returnValue && checkPropertiesList(_allConfigs.agentConfig[0], DYNATRACE_MANAGED_MOBILEAGENT_PROPERTIES)
			&& checkPropertiesList(_allConfigs.agentConfig[1], DYNATRACE_MANAGED_MOBILEAGENT_PROPERTIES);;
		}
	}
	
	return false;
}

// Check a property set to a list of default properties
function checkPropertiesList(_propertiesSet, _propertiesDefault){
	for(let i = 0; i < _propertiesDefault.length; i++){
		let property = _propertiesDefault[i];
		if(_propertiesSet[property] == undefined){
			throw("Missing the property: " + property + ". Please Update the dynatrace.config !");
		}
	}
	
	return true;
}

// Parse the properties into an object
function parseJSAgentPropertyData(_lines){
	let propertyData = {};
	
	for(let i = 0; i < _lines.length; i++){
		_lines[i] = _lines[i].replace(/^\s\s*/, '');

		if(!(_lines[i].startsWith("<!--"))){
			// Values should be read
			let indexValueStart = _lines[i].indexOf(">");
			let indexValueEnd = _lines[i].indexOf("<", indexValueStart);
			
			let propertyName = _lines[i].substring(1, indexValueStart);
			let propertyValue = _lines[i].substring(indexValueStart + 1, indexValueEnd);
			
			if(propertyName != "" && propertyValue != ""){
				propertyData[propertyName] = propertyValue;
			}
		}
		
		// Other values will be ignored by the script
	}

	return propertyData;
}

// Parse the general settings above into an object
function parseGeneralPropertyData(_lines){
	let propertyObject = getDefaultProperties();
			
	for(let i = 0; i < _lines.length; i++){
		if(_lines[i].indexOf(PROPERTY_UPDATE) > -1){
			let indexValueStart = _lines[i].indexOf(">");
			let indexValueEnd = _lines[i].indexOf("<", indexValueStart);
			propertyObject.autoUpdate = _lines[i].substring(indexValueStart + 1, indexValueEnd);
		}
	}
	
	return propertyObject;
}

// Returns default properties
function getDefaultProperties(){
	return {
		autoUpdate: PROPERTY_UPDATE_DEFAULT
	}
}

function parseAgentPropertyData(_lines){
	let propertyData = [{},{},{}];
	
	let platformType = PLATFORM_ALL;
	
	for(let i = 0; i < _lines.length; i++){
		_lines[i] = _lines[i].replace(/^\s\s*/, '');

		if(_lines[i].startsWith("<platform") || _lines[i].startsWith("</platform")){
			// Platform
			if(_lines[i].indexOf("android") > - 1){
				platformType = PLATFORM_ANDROID;
			}else if(_lines[i].indexOf("ios") > - 1){
				platformType = PLATFORM_IOS;
			}else{
				platformType = PLATFORM_ALL;
			}
		}else if(_lines[i].startsWith("<DTX")){
			// New Property
			let indexValueStart = _lines[i].indexOf(">");
			let indexValueEnd = _lines[i].indexOf("<", indexValueStart);
			
			let propertyName = _lines[i].substring(1, indexValueStart);
			let propertyValue = _lines[i].substring(indexValueStart + 1, indexValueEnd);
			
			propertyData[platformType][propertyName] = propertyValue;
		}
		
		// Other values will be ignored by the script
	}
	
	// Apply all data to single platforms if not set
	for(let key in propertyData[0]) {
		for(let i = 1; i < propertyData.length; i++){
			if(propertyData[i][key] == undefined){
				propertyData[i][key] = propertyData[0][key];
			}
		}
	}
	
	return [propertyData[1], propertyData[2]];
}

// Check which type is used
function parseTypeFromAgentConfig(_agentConfig){
	for(let key in _agentConfig[PLATFORM_ANDROID - 1]) {
		if(key == "DTXAgentStartupPath"){
			return DYNATRACE_APPMON;
		}else if(key == "DTXManagedCluster"){
			let value = _agentConfig[PLATFORM_ANDROID-1][key].toUpperCase();
			if(value == "TRUE"){
				return DYNATRACE_MANAGED;
			}
		}
	}
	
	return DYNATRACE_SAAS;
}