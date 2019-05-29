#!/usr/bin/env node

"use strict";
 
// Imports
var fs = require('fs');
var path = require('path');

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
var DYNATRACE_MOBILEAGENT_BEACON_PROPERTIES = ["DTXApplicationID", "DTXBeaconURL"];
var DYNATRACE_MANAGED_MOBILEAGENT_PROPERTIES = ["DTXApplicationID", "DTXAgentEnvironment", "DTXManagedCluster", "DTXClusterURL"];
var ALL_MOBILEAGENT_PROPERTIES = APPMON_MOBILEAGENT_PROPERTIES
	.concat(DYNATRACE_SAAS_MOBILEAGENT_PROPERTIES)
	.concat(DYNATRACE_MANAGED_MOBILEAGENT_PROPERTIES)
	.concat(DYNATRACE_MOBILEAGENT_BEACON_PROPERTIES);

// General Properties
var PROPERTY_UPDATE = "auto_update";
var PROPERTY_SEC_POLICY = "update_csp";
var PROPERTY_UPDATE_DEFAULT = "false";
var PROPERTY_CSP_DEFAULT = "true";

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

// Errors
var ERROR_CONFIG_NOT_AVAILABLE = -1;

// Constants
var allConfigs = {};

// Exports
exports.readSettings = readSettings;

exports.PLATFORM_ANDROID = PLATFORM_ANDROID;
exports.PLATFORM_IOS = PLATFORM_IOS;
exports.DYNATRACE_APPMON = DYNATRACE_APPMON;
exports.DYNATRACE_MANAGED = DYNATRACE_MANAGED;
exports.DYNATRACE_SAAS = DYNATRACE_SAAS;

exports.ERROR_CONFIG_NOT_AVAILABLE = ERROR_CONFIG_NOT_AVAILABLE;

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
				fileConfig = path.join(paths.PATH_APPLICATION, fileConfig);
				logger.logMessageSync("Found alternative configuration file: " + path.resolve(fileConfig), logger.INFO);
				return files.checkIfFileExists(fileConfig)
				.then((file) => {
					process.env.CUSTOM_CONFIG = file;
					resolve(file);
					return;
				})
				.catch(() => {
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
		return files.checkIfFileExists(paths.getConfigFilePath());
	})
	.catch(() => {
		// Config File is not available. 
		throw new Error(ERROR_CONFIG_NOT_AVAILABLE)
	})
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
		allConfigs.type = parseTypeFromConfig(allConfigs);

		// Check if Configs are valid
		checkSettingProperties(allConfigs);
		return allConfigs;
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
			return paths.getCustomHTML(allConfigs.paths.srcDir);
		})

		.then((customHTML) => {
			allConfigs.paths.customHTML = customHTML;
		});
	})
	.then(() => {
		return allConfigs;
	});
}

// Read the settings for the api js agent download
function readJSAgentProperties (){
	return Promise.resolve()
	// Check if a Credentials File was defined over a ENV variable
	.then(() => {
		if(process.env.DTX_CRED_FILE != undefined && process.env.DTX_CRED_FILE != "undefined"){
			return process.env.DTX_CRED_FILE;
		}else{
			// Check if the user made a credentials file
			return files.checkIfFileExists(paths.getCredentialsPath())
			.catch(() => {
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
			return paths.getConfigFilePath();
		}
	})
	.then((_file) => {return readPropertiesFromFile(_file, TAG_JSAGENT)})
	.then((_data) => {return parseJSAgentPropertyData(_data)});
}

// Read the DTX Properties
function readAgentProperties(){
	return readPropertiesFromFile(paths.getConfigFilePath(), TAG_MOBILE)
	.then((_data) => {return parseAgentPropertyData(_data)})
	.then((_data) => {return stripAgentPropertyData(_data)});
}

// Read the config file of the application
function readGeneralProperties(){
	return readPropertiesFromFile(paths.getConfigFilePath(), TAG_GENERAL)
	.then((_data) => {return parseGeneralPropertyData(_data)});
}

// Read the properties form the config file
function readPropertiesFromFile(_file, _tag){
	return new Promise(function(resolve, reject){
		fs.readFile(_file, "utf8", (err, data) => {
			if(err){
				reject("File can not be read: " + path.resolve(_file));
				return;
			}
			
			let pluginStart = data.indexOf("<" + _tag);
			
			if(pluginStart == -1){
				// Tag is not even there 
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
		checkPropertiesList(_allConfigs.jsAgentConfig, APPMON_JSAGENT_PROPERTIES, true);
		checkPropertiesList(_allConfigs.agentConfig[0], APPMON_MOBILEAGENT_PROPERTIES, true);
		checkPropertiesList(_allConfigs.agentConfig[1], APPMON_MOBILEAGENT_PROPERTIES, true);
	}else{
		// Dynatrace
		checkPropertiesList(_allConfigs.jsAgentConfig, DYNATRACE_JSAGENT_PROPERTIES, true);

		if(_allConfigs.jsAgentConfig !== undefined && _allConfigs.jsAgentConfig.url.indexOf("jsInlineScript") == -1){
			throw("Wrong Dynatrace JS Agent URL used! You have to use the URL which contains jsInlineScript!")
		}

		let propertiesAllowed = checkPropertiesList(_allConfigs.agentConfig[0], DYNATRACE_MOBILEAGENT_BEACON_PROPERTIES, false)
			&& checkPropertiesList(_allConfigs.agentConfig[0], DYNATRACE_MOBILEAGENT_BEACON_PROPERTIES, false);
		
		if(!propertiesAllowed){
			if(_allConfigs.type == DYNATRACE_SAAS){
				checkPropertiesList(_allConfigs.agentConfig[0], DYNATRACE_SAAS_MOBILEAGENT_PROPERTIES, true);
				checkPropertiesList(_allConfigs.agentConfig[1], DYNATRACE_SAAS_MOBILEAGENT_PROPERTIES, true);
			}else{
				checkPropertiesList(_allConfigs.agentConfig[0], DYNATRACE_MANAGED_MOBILEAGENT_PROPERTIES, true);
				checkPropertiesList(_allConfigs.agentConfig[1], DYNATRACE_MANAGED_MOBILEAGENT_PROPERTIES, true);
			}
		}
	}
}

// Check a property set to a list of default properties
function checkPropertiesList(_propertiesSet, _propertiesDefault, _throwError){
	// It is now possible to have an empty list

	if(_propertiesSet != undefined){
		for(let i = 0; i < _propertiesDefault.length; i++){
			let property = _propertiesDefault[i];
			if(_propertiesSet[property] == undefined){
				if(_throwError){
					throw("Missing the property: " + property + ". Please Update the dynatrace.config!");
				}else{
					return false;
				}
			}
		}
	}
	
	return true;
}

// Parse the properties into an object
function parseJSAgentPropertyData(_lines){
	if(!_lines){
		return undefined;
	}

	let propertyData = {};
	let property;

	let propertyArray = APPMON_JSAGENT_PROPERTIES.concat(DYNATRACE_JSAGENT_PROPERTIES);
	
	for(let i = 0; i < _lines.length; i++){
		_lines[i] = _lines[i].replace(/^\s\s*/, '');

		if(!(_lines[i].startsWith("<!--"))){
			// Values should be read
			property = parsePropertyXML(_lines[i]);

			for(let i = 0; i < propertyArray.length; i++){
				if(property.name.toLowerCase() == propertyArray[i].toLowerCase()){
					property.name = propertyArray[i];
				}
			}
			
			if(property.name != "" && property.value != ""){
				propertyData[property.name] = property.value;
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
		let line = _lines[i].toLowerCase();
		if(line.indexOf(PROPERTY_UPDATE) > -1){
			propertyObject.autoUpdate = parsePropertyXML(line).value;
		}else if(line.indexOf(PROPERTY_SEC_POLICY) > -1){
			propertyObject.cspUpdate = parsePropertyXML(line).value;
		}
	}
	
	return propertyObject;
}

// Parse property from the XML file
function parsePropertyXML(_line){
	let property = {
		name: "",
		value: ""
	};

	if(_line.length == 0){
		return property;
	}

	let indexValueStart = _line.indexOf(">");
	let indexValueEnd = _line.indexOf("<", indexValueStart);

	if(indexValueEnd != -1 && indexValueStart != -1 && indexValueStart < indexValueEnd){
		property.name = _line.substring(1, indexValueStart);
		property.value = _line.substring(indexValueStart + 1, indexValueEnd);
	}else{
		logger.logMessageSync("Property config line is formatted wrong! " + _line, logger.ERROR);
	} 

	return property;
}

// Returns default properties
function getDefaultProperties(){
	return {
		autoUpdate: PROPERTY_UPDATE_DEFAULT,
		cspUpdate: PROPERTY_CSP_DEFAULT
	}
}

// If both DTXClusterURL and DTXBeaconURL are detected - remove DTXClusterURL and others
function stripAgentPropertyData(_data){
	for(let i = 0; i < _data.length; i++){
		if(_data[i].DTXBeaconURL != undefined){
			delete _data[i].DTXAgentEnvironment; 
			delete _data[i].DTXClusterURL;
			delete _data[i].DTXManagedCluster;
		}
	}
	
	return _data;
}

function parseAgentPropertyData(_lines){
	let propertyData = [{},{},{}];
	let property;

	let platformType = PLATFORM_ALL;
	
	for(let i = 0; i < _lines.length; i++){
		_lines[i] = _lines[i].replace(/^\s\s*/, '');
		let _lineUpperCase = _lines[i].toUpperCase();

		if(_lines[i].startsWith("<platform") || _lines[i].startsWith("</platform")){
			// Platform
			if(_lines[i].indexOf("android") > - 1){
				platformType = PLATFORM_ANDROID;
			}else if(_lines[i].indexOf("ios") > - 1){
				platformType = PLATFORM_IOS;
			}else{
				platformType = PLATFORM_ALL;
			}
		}else if(_lineUpperCase.startsWith("<DTX")){
			// New Property
			property = parsePropertyXML(_lines[i]);

			for(let i = 0; i < ALL_MOBILEAGENT_PROPERTIES.length; i++){
				if(property.name.toLowerCase() == ALL_MOBILEAGENT_PROPERTIES[i].toLowerCase()){
					property.name = ALL_MOBILEAGENT_PROPERTIES[i];
				}
			}

			if(property.name != "" && property.value != ""){
				propertyData[platformType][property.name] = property.value;
			}
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
function parseTypeFromConfig(_allConfig){
	let type = parseTypeFromAgentConfig(_allConfig.agentConfig);
	if(type === undefined){
		type = parseTypeFromJSAgentConfig(_allConfig.jsAgentConfig);
	}
	return type;
}

// Check which type is used
function parseTypeFromAgentConfig(_agentConfig){
	if(_agentConfig === undefined || Object.keys(_agentConfig[PLATFORM_ANDROID - 1]).length == 0){
		return undefined;
	}

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

// Check which type is used
function parseTypeFromJSAgentConfig(_jsAgentConfig){
	if(_jsAgentConfig === undefined){
		return undefined;
	}

	for(let key in _jsAgentConfig) {
		if(key == "profile" || key == "username" || key == "password"){
			return DYNATRACE_APPMON;
		}
	}
	
	return DYNATRACE_SAAS;
}