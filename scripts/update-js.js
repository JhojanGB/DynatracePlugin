#!/usr/bin/env node

"use strict"; 

const fs = require('fs');
const request = require('request');
const path = require('path');

const logger = require('./logger.js');
const paths = require('./pathsConstants.js');
const files = require('./fileOperationHelper.js');
const config = require('./configHelper.js');
const  { JSDOM } = require('jsdom');

// Consts
const HTML_IDENTIFIER = ["ion-app", "app-root"];
const AGENT_SRC = "assets/dtAgent.js";
const AGENT_CONFIG_BEGIN = "data-dtconfig=\"";
const AGENT_INTERNAL_CONFIG_BEGIN = "cfg:\"";

if(process.env.TESTING){
	exports.isAgentInHTMLDom = isAgentInHTMLDom;
	exports.isHTMLQualified = isHTMLQualified;
	exports.addAgentToHTMLDom = addAgentToHTMLDom;
	exports.loadHTMLFile = loadHTMLFile;
	exports.checkHTMLFile = checkHTMLFile;
	exports.removeAgentFromHTMLDom = removeAgentFromHTMLDom;
	exports.createDownloadAgentTagOptions = createDownloadAgentTagOptions;
}

exports.downloadJSAgent = downloadJSAgent;
exports.updateHTMLWithJSAgent = updateHTMLWithJSAgent;

// HTML Functions

/**
 * Checks if the Dom Tree contains the JavaScript agent
 * @param {JSDOM} domTree HTML Tree
 * @returns {Number} The position of the script tag. 0 = First script element. -1 not there at all
 */
function isAgentInHTMLDom(domTree){
	let scripts = domTree.window.document.getElementsByTagName("script");
			
	for(let i = 0; i < scripts.length; i++){
		if(scripts.item(i).src == AGENT_SRC){
			return i;
		}
	}

	return -1;
}

/**
 * Remove the JavaScript agent from the Dom Tree. If the agent is
 * not in the Dom Tree it returns the unmodified tree.
 * @param {JSDOM} domTree HTML Tree 
 * @returns {JSDOM} modified HTML Tree
 */
function removeAgentFromHTMLDom(domTree){
	let scripts = domTree.window.document.getElementsByTagName("script");
			
	for(let i = 0; i < scripts.length; i++){
		if(scripts.item(i).src == AGENT_SRC){
			scripts.item(i).parentNode.removeChild(scripts.item(i));
			return domTree;
		}
	}

	return domTree;
}

/**
 * Add the JavaScript Agent to the Dom Tree
 * @param {JSDOM} domTree HTML Tree
 * @returns {JSDOM} modified HTML Tree
 */
function addAgentToHTMLDom(domTree){
	let head = domTree.window.document.getElementsByTagName("head");

	if(head.length == 0){
		// Create a Header because it seems it is missing
		head = domTree.window.document.createElement("head");
		domTree.window.document.appendChild(head);
	}
	
	let script = domTree.window.document.createElement("script");
	script.src = AGENT_SRC;
	head.item(0).prepend(script);

	return domTree;
}

/**
 * Checks if the HTML is from Cordova or Ionic. We are checking
 * if the HTML contains several identifiers.
 * @param {JSDOM} domTree HTML Tree
 * @returns {boolean} True = Yes is qualified
 */
function isHTMLQualified(domTree){
	for(let i = 0; i < HTML_IDENTIFIER.length; i++){
		let tags = domTree.window.document.getElementsByTagName(HTML_IDENTIFIER[i]);

		if(tags.length > 0){
			return true;
		}	
	}

	let scripts = domTree.window.document.getElementsByTagName("script");
			
	for(let i = 0; i < scripts.length; i++){
		if(scripts.item(i).src == "cordova.js"){
			return true;
		}
	}

	return false;
}

/**
 * Load HTML File and return a Dom Tree
 * @param {string} htmlFile Path to HTML File
 * @returns {JSDOM} Dom Tree of the HTML File
 */
async function loadHTMLFile(htmlFile){
	let data = await files.readTextFromFile(htmlFile);
	return new JSDOM(data);
}

/**
 * Write a Dom Tree to a File
 * @param {JSDOM} domTree Dom Tree
 * @param {string} htmlFile Path of the file
 * @returns {void} Nothing
 */
async function writeHTMLTreeToFile(domTree, htmlFile){
	let content = domTree.serialize();
	await files.writeTextToFile(htmlFile, content);
}

// Other

function downloadJSAgent(_config){
	let promiseDownload;

	if(_config == undefined){
		promiseDownload = config.readSettings()
		.then((configRead) => _downloadJSAgent(configRead));
	}else{
		promiseDownload = _downloadJSAgent(_config);
	}

	return promiseDownload
	.catch((exception) => {
		logger.logMessageSync("Could not download the JSAgent! - " + exception, logger.ERROR);
	});
}

async function _downloadJSAgent(configs){
	// Check if the JSAgent config is available and includes some properties
	if(configs.jsAgentConfig == undefined){
		logger.logMessageSync("No Settings for JSAgent - Will not download or include JSAgent.", logger.INFO);
		return;
	}

	// Startup - Read Properties File
	logger.logMessageSync("Start with JSAgent Update.", logger.INFO);

	let download = false;

	// Check if AutoUpdate
	if(configs.generalConfig.autoUpdate == "true"){
		logger.logMessageSync("Auto-Update is turned on. Will try to update JSAgent.", logger.INFO);
		download = true;
	}else{
		// Check if Agent is already downloaded
		try{
			await files.checkIfFileExists(paths.getDownloadJSAgentPath());

			// Agent Exists
			logger.logMessageSync("Auto-Update is turned off. JSAgent is already downloaded!", logger.INFO);
		}catch(e){
			logger.logMessageSync("Auto-Update is turned off. JSAgent is not downloaded! Will download it.", logger.INFO);
			download = true;
		}
	}

	if(download){
		// File should be downloaded	
		logger.logMessageSync("Starting the download of the JSAgent ..", logger.INFO);
		await downloadJSAgentHttp(configs.jsAgentConfig, configs.type)
		logger.logMessageSync("JSAgent was downloaded successfully!", logger.INFO);
	}
}

async function updateHTMLWithJSAgent(pathOfPlatformAssets){
	logger.logMessageSync("Searching for HTML files ..", logger.INFO);
	
	let htmlFiles = await files.searchFileExtInDirectoryNonRecursive(pathOfPlatformAssets, ".html", []);
	let htmlFilesToInstrument = [];

	for(let i = 0; i < htmlFiles.length; i++){
		if(checkHTMLFile(htmlFiles[i])){
			htmlFilesToInstrument.push(htmlFiles[i]);
		}
	}

	if(htmlFilesToInstrument.length == 0){
		logger.logMessageSync("No HTML files to instrument! Maybe all files are already instrumented.", logger.INFO);
	}else{
		for(let i = 0; i < htmlFilesToInstrument.length; i++){
			await instrumentHTMLFile(htmlFilesToInstrument[i]);
		}
	}

	if(htmlFilesToInstrument.length > 0){
		logger.logMessageSync(htmlFilesToInstrument.length + " HTML file(s) are instrumented.", logger.INFO);
		for(let i = 0; i < htmlFilesToInstrument.length; i++){
			await copyAgent(path.join(htmlFilesToInstrument[i], ".."));
		}
	}

	logger.logMessageSync("Successfully updated the JSAgent in HTML file!", logger.INFO); 
}

/**
 * Check if the HTML file is containg the agent or is at 
 * least the right HTML file
 * @param {string} htmlFile Path to HTML file
 * @returns {boolean} True = Right HTML - Instrument it
 */
async function checkHTMLFile(htmlFile){
	const domTree = await loadHTMLFile(htmlFile);

	if(isAgentInHTMLDom(domTree) > -1){
		removeAgentFromHTMLDom(domTree);
		logger.logMessageSync("Updating instrumented HTML file: " + path.resolve(htmlFile), logger.INFO);
		return true;
	}else if(isHTMLQualified(domTree)){
		logger.logMessageSync("Found main HTML file: " + path.resolve(htmlFile), logger.INFO);
		return true;
	}

	return false;
}

/**
 * Instrument a HTML file provided by a string path
 * @param {string} htmlFile Path to file
 * @returns {string} path if instrumented correctly
 */
async function instrumentHTMLFile(htmlFile){
	let domTree = await loadHTMLFile(htmlFile);
	domTree = addAgentToHTMLDom(domTree);
	await writeHTMLTreeToFile(domTree, htmlFile);

	logger.logMessageSync("Successfully instrumented: " + path.resolve(htmlFile), logger.INFO);
	return htmlFile;
}

/**
 * Download the JSAgent depending on the configuration and type
 * @param {*} downloadConfig internal configuration object
 * @param {*} type if it is Managed, Saas or AppMon
 * @returns {void}
 */
async function downloadJSAgentHttp(downloadConfig, type){
	let options = createDownloadAgentTagOptions(downloadConfig, type);
	
	if(type == config.DYNATRACE_SAAS || type == config.DYNATRACE_MANAGED){
		// Download First Part which returns the right redirect to the file
		let content = await createHTTPRequest(options, "Download of agent options finished", "Could not download agent options");

		if(content.startsWith("<script")){
			let indexScriptStart = content.indexOf("\n") + 1;
			let indexScriptEnd = content.lastIndexOf("\n");
			let configurationAgent = content.substring(content.indexOf(AGENT_CONFIG_BEGIN) + AGENT_CONFIG_BEGIN.length, indexScriptStart - "\">".length - 2).trim();
			let scriptContent = content.substring(indexScriptStart, indexScriptEnd);
			let indexOfConfig = scriptContent.indexOf(AGENT_INTERNAL_CONFIG_BEGIN);
			let scriptContentBegin = scriptContent.substring(0, indexOfConfig + AGENT_INTERNAL_CONFIG_BEGIN.length);
			let scriptContentEnd = scriptContent.substring(scriptContent.indexOf("\"", indexOfConfig + AGENT_INTERNAL_CONFIG_BEGIN.length))
			return files.writeTextToFile(paths.getDownloadJSAgentPath(), scriptContentBegin + configurationAgent + scriptContentEnd);
		}else{
			throw("Wrong JS Agent file! Maybe the URL is wrong for the JS Agent?");
		}
	}else if(type == config.DYNATRACE_APPMON){
		// App Mon
		await createHTTPRequest(options, "Download of agent file finished", "Could not download agent file: ", path.resolve(paths.getDownloadJSAgentPath()));
	}
}

/**
 * Create HTTP Url and query
 * @param {*} downloadConfig Configuration for downloading 
 * @param {*} type if it is Managed, Saas or AppMon
 * @returns {*} options for downloading the agent
 */
function createDownloadAgentTagOptions(downloadConfig, type){
	let options = {};

	if(type == config.DYNATRACE_SAAS || type == config.DYNATRACE_MANAGED){
		if(downloadConfig.url != undefined && downloadConfig.apitoken != undefined){
			options.url = downloadConfig.url.replace("YOUR_TOKEN", downloadConfig.apitoken);

			if(options.url.indexOf("/jsInlineScript/") == -1){
				throw("JSAgent configuration wrong! Use jsInlineScript instead of jsTag in JSAgent url configuration!");
			}
		}else{
			let product = type == config.DYNATRACE_SAAS ? "Dynatrace Saas" : "Dynatrace Managed";
			throw("Script was automatically detecting " + product + " mode but settings are missing!");
		}
	}else if(type == config.DYNATRACE_APPMON){
		options.url = parseHTTPAddress(downloadConfig.url) + encodeURI("/api/v1/profiles/" + downloadConfig.profile + "/applications/" + downloadConfig.appName);
		options.url = options.url + "/javascriptagent";
		options.auth = {};
		options.auth.user = downloadConfig.username;
		options.auth.pass = downloadConfig.password;
	}else{
		throw("TYPE is wrong. Only DYNATRACE SAAS, DYNATRACE MANAGED or DYNATRACE APPMON is possible.");
	}

	if(downloadConfig.allowanycert == "true"){
		logger.logMessageSync("Ignoring certificate for downloading the JSAgent!", logger.WARNING);
		options.strictSSL = false;
	}
		
	return options;
}

/**
 * Parsing the HTTP Address (Adding http:// and removing trailing slash)
 * @param {string} httpHost http address
 * @returns {string} corrected http address 
 */
function parseHTTPAddress(httpHost){
	if(httpHost.indexOf("://") == -1){
		httpHost = "http://" + httpHost;
	}
	
	if(httpHost.endsWith("/")){
		// Remove this part
		httpHost = httpHost.substring(0, httpHost.length - 1);
	}
	
	return httpHost;
}

/**
 * Downloading JSAgent
 * @param {*} options internal download config
 * @param {*} finishMsg message which should be printed if successful
 * @param {*} errorMsg message which should be printed if not successful
 * @param {*} destFile destination file for download
 * @returns {void}
 */
function createHTTPRequest(options, finishMsg, errorMsg, destFile){
	return new Promise(function(resolve, reject){
		let httpReq = request.get(options);

		let file;
		let httpResponseContent = "";
	
		httpReq.on('response', function(response) {
			if (response.statusCode == 200) {
				if(destFile != undefined){
					file = fs.createWriteStream(destFile);
					httpReq.pipe(file);
					file.on('finish', function() {
						logger.logMessageSync(finishMsg, logger.INFO);
						file.close(resolve(destFile));
					});
				}else{
					response.setEncoding('utf8');
					logger.logMessageSync(finishMsg, logger.INFO);
					
					response.on("data", function(content) {
						httpResponseContent += content; 
					});
					
					response.on("end", function(){
						resolve(httpResponseContent);
					});
				}
			}else{
				reject(errorMsg + response.statusCode);	
			}
		});

		httpReq.on('error', function(err) { 
			reject(errorMsg + err);
		});
	});
}

/**
 * Copies the agent to a certain folder
 * @param {string} destDir Destination dir
 * @returns {Promise} a promise which resolves true
 */
function copyAgent(destDir){
	return new Promise(function(resolve, reject){
		// Create the directory where the agent will copied to
		files.createDirectory(path.join(destDir, paths.FOLDER_ASSETS))
		// Copy the agent
		.then((dest) => {
			let rd = fs.createReadStream(paths.getDownloadJSAgentPath());
			
			rd.on("error", function (err){
				reject("Could not read agent from download directory: " + err);
			});
			
			let wr = fs.createWriteStream(path.resolve(dest, paths.FILE_JSAGENT));
			wr.on("error", function (err){
				reject("Could not copy agent to " + path.resolve(dest) + " directory: " + err);
			});
			
			wr.on("close", function() {
				logger.logMessageSync("Copied agent to " + path.resolve(dest) + " directory", logger.INFO);
				resolve(true);
			});
			
			rd.pipe(wr);
		});
	});
}