#!/usr/bin/env node

"use strict"; 

var fs = require('fs');
var path = require('path');
var request = require('request');

var logger = require('./logger.js');
var paths = require('./pathsConstants.js');
var files = require('./fileOperationHelper.js');
var config = require('./configHelper.js');

// Consts
var HTML_IDENTIFIER = ["src=\"cordova.js\"", "<ion-app>"];
var INSTR_IDENTIFIER = ["data-dtconfig", "dtAgent.js"];
var AGENT_TAG = "<script src=\"" + paths.getJSAgentSubDir() + paths.PATH_SEPERATOR + paths.FILE_JSAGENT + "\"></script>";
var INSTR_CODE = "\tif(window[\"dT_\"] && window[\"dT_\"].initAngularNg){" + "\n" + 
				"\t\twindow[\"dT_\"].initAngularNg(http, Headers);" + "\n" + 
				"\t}";

if(process.env.TESTING){
	exports.checkIfScriptShouldBeInstrumented = checkIfScriptShouldBeInstrumented;
	exports.checkIfHTMLShouldBeInstrumented = checkIfHTMLShouldBeInstrumented;
	exports.instrumentScriptFile = instrumentScriptFile;
	exports.removeInstrumentationLinesFromHTML = removeInstrumentationLinesFromHTML;
	exports.instrumentHTMLFile = instrumentHTMLFile;
}

module.exports = function (){
	return updateJS()
	.then(() => {
		return true;
	});
}

function updateJS(){
	// Startup - Read Properties File
	logger.logMessageSync("Start with JSAgent Update.", logger.INFO);
	logger.logMessageSync("Reading settings for the JSAgent instrumentation ..", logger.INFO);
	return config.readSettings()
	// All configurations are read
	.then((configs) => {	
		logger.logMessageSync("Successfully read the settings for the JSAgent instrumentation!", logger.INFO);
		
		// Check if AutoUpdate
		if(configs.generalConfig.autoUpdate == "true"){
			configs.generalConfig.download = true;
			logger.logMessageSync("Auto-Update is turned on. Will try to update JSAgent.", logger.INFO);
			return configs;
		}else{
			// Check if Agent is already downloaded
			return files.checkIfFileExists(paths.getDownloadJSAgentPath())
			.catch((err) => {
				// Files not available
				return false;
			})
			.then((_path) => {
				if(_path){
					// Agent Exists
					logger.logMessageSync("Auto-Update is turned off. JSAgent is already downloaded!", logger.INFO);
					configs.generalConfig.download = false;
				}else{
					logger.logMessageSync("Auto-Update is turned off. JSAgent is not downloaded! Will download it.", logger.INFO);
					configs.generalConfig.download = true;
				}
				
				return configs;
			});
		}
	})

	.then((configs) => {
		if(configs.generalConfig.download){
			// File should be downloaded
			logger.logMessageSync("Starting the download of the JSAgent ..", logger.INFO);
			return downloadJSAgent(configs.jsAgentConfig, configs.type)
			.then((fileDownloaded) => {
				logger.logMessageSync("JSAgent was downloaded successfully!", logger.INFO);
				return configs;
			});
		}
		
		return configs;
	})

	// Property Data is now correct and can be used to download the agent
	.then((configs) => {
		let promiseFileChecks = [];

		// Check if Source Dir is available
		promiseFileChecks.push(files.checkIfFileExists(configs.paths.srcDir)
		.catch((err) => {
			throw ("Source directory is not available. There is nothing to instrument. " + err);
		})
		// Source Dir is available
		.then((sourceDir) => {
			let promiseFileSearch = [];
            logger.logMessageSync("Searching for script files ..", logger.INFO);
            promiseFileSearch.push(files.searchFileExtInDirectoryRecursive(sourceDir, ".js", []));
            promiseFileSearch.push(files.searchFileExtInDirectoryRecursive(sourceDir, ".ts", []));
            return Promise.all(promiseFileSearch);
		})

		// Searched for ts and js files
        .then((fileSearched) => {
            let allFoundFiles = fileSearched[0].concat(fileSearched[1]);
            let promiseScriptCheck = [];
            for(let i = 0; i < allFoundFiles.length; i++){
                promiseScriptCheck.push(checkIfScriptShouldBeInstrumented(allFoundFiles[i]));
            }
            return Promise.all(promiseScriptCheck);
        })
        // Instrument all scripts which should be instrumented
        .then((scriptsToInstrument) => {
            let scriptsToInstrumentFiltered = scriptsToInstrument.filter(function(val){ return val; });
            
            if(scriptsToInstrumentFiltered.length < 1){
                logger.logMessageSync("No source files to instrument! Maybe all files are already instrumented.", logger.INFO);
            }else{
                let promiseInstrumentScript = [];
                for(let i = 0; i < scriptsToInstrumentFiltered.length; i++){
                    promiseInstrumentScript.push(instrumentScriptFile(scriptsToInstrumentFiltered[i]));
                }
                
                return Promise.all(promiseInstrumentScript);
            }
            
            return false;
        })
        // Instrumentation of script files finished
        .then((files) => {
            if(files){
                logger.logMessageSync(files.length + " script files are instrumented.", logger.INFO);
            }
            
            return files;
		})
		.catch(errorHandling));
		
		// Check if Source Dir is available
		promiseFileChecks.push(files.checkIfFileExists(configs.paths.srcDir)
		.catch(() => {
			return files.checkIfFileExists(configs.paths.wwwDir)
			.catch(() => {
				throw ("Are you sure this is an Ionic or Cordova Application? Could find www or src folder.");
			});
		})
		// Source Dir is available
		.then((sourceDir) => {
			logger.logMessageSync("Searching for HTML files ..", logger.INFO);
			return files.searchFileExtInDirectoryRecursive(sourceDir, ".html", []);
		})
		// Searched for html files
		.then((fileSearched) => {
			let promiseHTMLCheck = [];
			for(let i = 0; i < fileSearched.length; i++){
				promiseHTMLCheck.push(checkIfHTMLShouldBeInstrumented(fileSearched[i]));
			}
			
			if(fileSearched.indexOf(configs.paths.wwwDir + "/index.html") == -1){
				promiseHTMLCheck.push(checkIfHTMLShouldBeInstrumented(configs.paths.wwwDir + "/index.html"));
			}
			
			return Promise.all(promiseHTMLCheck);
		})
		// Check if the user added a custom HTML File
		.then((htmlsToInstrument) => {
			if(configs.paths.customHTML){
				return checkIfHTMLShouldBeInstrumented(configs.paths.customHTML)
				.then(() => {
					htmlsToInstrument.push({
						isInstrumented : false,
						pathFile: configs.paths.customHTML
					});
					return htmlsToInstrument;
				});
			}else{
				return htmlsToInstrument;
			}
		})
		// Instrument all scripts which should be instrumented
		.then((htmlsToInstrument) => {
			let htmlsToInstrumentFiltered = htmlsToInstrument.filter(function(val){ if(!val.isInstrumented){ return val }});
			
			if(htmlsToInstrumentFiltered.length < 1){
				logger.logMessageSync("No HTML files to instrument! Maybe all files are already instrumented.", logger.INFO);
			}else{
				let promiseInstrumentHTML = [];
				for(let i = 0; i < htmlsToInstrumentFiltered.length; i++){
					promiseInstrumentHTML.push(instrumentHTMLFile(htmlsToInstrumentFiltered[i].pathFile, AGENT_TAG));
				}
				
				return Promise.all(promiseInstrumentHTML)
				.then(() => { return htmlsToInstrument; });
			}
			
			return htmlsToInstrument;
		})
		.then((htmlsToInstrument) => {
			if(htmlsToInstrument){
				let instrumentedHTMLFilesFiltered = htmlsToInstrument.filter(function(val){ return val });
				let alreadyInstrumentedHTML = htmlsToInstrument.filter(function(val){ if(!val.isInstrumented){ return val }});
				let promiseCopyAgent = [];
				
				if(alreadyInstrumentedHTML.length > 0){
					logger.logMessageSync(alreadyInstrumentedHTML.length + " HTML file(s) are instrumented.", logger.INFO);
				}
				
				for(let i = 0; i < instrumentedHTMLFilesFiltered.length; i++){
					let pathStr = instrumentedHTMLFilesFiltered[i].pathFile.substring(0, instrumentedHTMLFilesFiltered[i].pathFile.lastIndexOf("/"));
					promiseCopyAgent.push(copyAgent(pathStr));
				}
				
				return Promise.all(promiseCopyAgent)
				.then(() => {
					return instrumentedHTMLFilesFiltered;
				})
			}else{
				return false;
			}
		}));
		
		return Promise.all(promiseFileChecks);
	})
	.then(() => {
		logger.logMessageSync("Finished the JSAgent instrumentation.", logger.INFO);
	})
	.catch((err) => {errorHandling(err)});
}

function errorHandling(_message){
	logger.logMessageSync(_message, logger.ERROR);
	throw new Error(_message);
}

// Check if the Script should be instrumented
function checkIfScriptShouldBeInstrumented(_path){
    return new Promise(function(resolve, reject){
        if(path.basename(_path) == paths.FILE_JSAGENT){
            resolve(false);
            return;
        }

		files.readTextFromFile(_path)
		.then((data) => {
			if(data.indexOf("initAngularNg") > -1){
                logger.logMessageSync("Already instrumented script file: " + _path, logger.INFO);
                resolve(false);
                return;
            }else if(data.indexOf("@angular/http") > -1){
                logger.logMessageSync("Found script HTTP file: " + _path, logger.INFO);
                resolve(_path);
                return;
            }
            
            resolve(false);
		})
		.catch((err) => {
			reject(err);
		});
    });
}

// Go through the script classes and check if http is in use
function instrumentScriptFile(_scriptFile){
	return new Promise(function(resolve, reject){
		files.readTextFromFile(_scriptFile)
		.then((data) => {
			let lines = data.split("\n");
			let modifiedLines = lines;
			let foundConstructor = false;
			
			for(let i = 0; i < lines.length; i++){
				if(lines[i].startsWith("import")){
					if(lines[i].indexOf("@angular/http") > -1){
						if(lines[i].indexOf("Headers") == -1){
							// No Headers available, but needed
							let indexEnd = lines[i].indexOf("}");
							let newLine = lines[i].substring(0, indexEnd) + ",Headers" + lines[i].substring(indexEnd, lines[i].length);
							
							// Found HTTP Import
							logger.logMessageSync("Added Header to script file: " + _scriptFile, logger.INFO);
							
							// Constructor found 
							modifiedLines.splice(i, 1, newLine);
						}
					}
				}else if(lines[i].indexOf("constructor") > -1){
					if(lines[i].indexOf("{") > -1){
						modifiedLines.splice(i + 1, 0, INSTR_CODE);
						logger.logMessageSync("Added Init Code to script file: " + _scriptFile, logger.INFO);
					}else{
						foundConstructor = true;
					}
				}else if(foundConstructor){
					if(lines[i].indexOf("{") > -1){
						modifiedLines.splice(i + 1, 0, INSTR_CODE);
						logger.logMessageSync("Added Init Code to script file: " + _scriptFile, logger.INFO);
						foundConstructor = false;
					}
				}
			}

			modifiedLines = modifiedLines.join("\n");
			
			// Write to file 
			resolve(files.writeTextToFile(_scriptFile, modifiedLines));
			logger.logMessageSync("Successfully instrumented: " + _scriptFile, logger.INFO);
			return;
		});
	});
}					

// Check if the HTML is one
function checkIfHTMLShouldBeInstrumented(_path){
	return new Promise(function(resolve, reject){
		fs.readFile(_path, function(err, data){
			if(err){
				reject("Could not read HTML: " + _path);
				return;
			}
			
			let htmlFile = {
				isInstrumented : false,
				pathFile: _path
			};

			for(let i = 0; i < INSTR_IDENTIFIER.length; i++){
				if(data.indexOf(INSTR_IDENTIFIER[i]) > -1){
					resolve(removeInstrumentationLinesFromHTML(htmlFile, INSTR_IDENTIFIER[i]));
					logger.logMessageSync("Updating instrumented HTML file: " + _path, logger.INFO);
					return;
				}
			}
			
			for(let i = 0; i < HTML_IDENTIFIER.length; i++){
				if(data.indexOf(HTML_IDENTIFIER[i]) > -1){
					// Found Main HTML
					logger.logMessageSync("Found main HTML file: " + _path, logger.INFO);
					resolve(htmlFile);
					return;
				}
			}
			
			resolve(false);
		});	
	});
}

// Removes the instrumentation lines
function removeInstrumentationLinesFromHTML(_htmlFile, _lineIdentifier){
	return files.readTextFromFile(_htmlFile.pathFile)
	.then((content) => {
		let lines = content.split("\n");
		
		for(let i = 0; i < lines.length; i++){
			if(lines[i].indexOf(_lineIdentifier) > -1){
				lines.splice(i, 1);
				return files.writeTextToFile(_htmlFile.pathFile, lines.join("\n"))
				.then(() => {
					return _htmlFile;
				});
			}
		}
		
		return _htmlFile;
	});
}

// Instrument the HTML File
function instrumentHTMLFile(_htmlFile, _tag){
	return new Promise(function(resolve, reject){
		if(_htmlFile){
			fs.readFile(_htmlFile, "utf8", (err, data) => {
				if(err){
					reject(err);
					return;
				}
				
				let lines = data.split("\n");
				
				// Find first script tag
				for(let i = 0; i < lines.length; i++){
					if(lines[i].indexOf("<script") > -1){
						lines.splice(i, 0, "  " + _tag);
						let text = lines.join("\n");
						resolve(files.writeTextToFile(_htmlFile, text));
						logger.logMessageSync("Successfully instrumented: " + _htmlFile, logger.INFO);
						return;
					}
				}
				
				resolve(false);
			});
		}else{
			resolve(false);
		}
	});
}

// Download the JS Agent
function downloadJSAgent(_config, _type){
	let options = createDownloadAgentTagOptions(_config, _type);
	
	if(_type == config.DYNATRACE_SAAS || _type == config.DYNATRACE_MANAGED){
		// Download First Part which returns the right redirect to the file
		return createHTTPRequest(options, "Download of agent options finished", "Could not download agent options")
		.then((content) => {
			if(content.startsWith("<script")){
				let indexScriptStart = content.indexOf("\n") + 1;
				let indexScriptEnd = content.lastIndexOf("\n");
				let scriptTag = content.substring(0, indexScriptStart).trim();
				AGENT_TAG = [scriptTag.slice(0, scriptTag.length - 1), " src=\"" + paths.getJSAgentSubDir() + paths.PATH_SEPERATOR + paths.FILE_JSAGENT + "\"", ">"].join('') + "</script>";
				let scriptContent = content.substring(indexScriptStart, indexScriptEnd);
				return files.writeTextToFile(paths.getDownloadJSAgentPath(), scriptContent);
			}else{
				throw("Wrong JS Agent file! Maybe the URL is wrong for the JS Agent?");
			}
		});
	}else if(_type == config.DYNATRACE_APPMON){
		// App Mon
		return createHTTPRequest(options, "Download of agent file finished", "Could not download agent file: ", paths.getDownloadJSAgentPath());
	}
}

// Create the HTTP Options
function createDownloadAgentTagOptions(_config, _type){
	let options = {};
	
	if(_type == config.DYNATRACE_SAAS){
		if(_config.url != undefined && _config.apitoken != undefined){
			options.url = _config.url.replace("YOUR_TOKEN", _config.apitoken);
		}else{
			throw("Script was automatically detecting Dynatrace Saas mode but settings are missing!");
		}
	}else if(_type == config.DYNATRACE_MANAGED){
		if(_config.url != undefined && _config.apitoken != undefined){
			options.url = _config.url.replace("YOUR_TOKEN", _config.apitoken);
		}else{
			throw("Script was automatically detecting Dynatrace Managed mode but settings are missing!");
		}
	}else if(_type == config.DYNATRACE_APPMON){
		options.url = parseHTTPAddress(_config.url) + encodeURI("/api/v1/profiles/" + _config.profile + "/applications/" + _config.appName);
		options.url = options.url + "/javascriptagent";
		options.user = _config.username;
		options.pass = _config.password;
	}else{
		throw("TYPE is wrong. Only DYNATRACE SAAS, DYNATRACE MANAGED or DYNATRACE APPMON is possible.");
	}
		
	return options;
}

// Parse the HTTP Address
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

// Download the Agent Tag
function createHTTPRequest(_options, _finishedStr, _errorStr, _file){
	return new Promise(function(resolve, reject){
		let httpReq, file;
		
		if(_options.user){
			httpReq = request.get(_options.url).auth(_options.user, _options.pass);
		}else{
			httpReq = request.get(_options.url);
		}
		
		let httpResponseContent = "";
	
		httpReq.on('response', function(response) {
			if (response.statusCode == 200) {
				if(_file != undefined){
					file = fs.createWriteStream(_file);
					httpReq.pipe(file);
					file.on('finish', function() {
						logger.logMessageSync(_finishedStr, logger.INFO);
						file.close(resolve(_file));
					});
				}else{
					response.setEncoding('utf8');
					logger.logMessageSync(_finishedStr, logger.INFO);
					
					response.on("data", function(content) {
						httpResponseContent += content; 
					});
					
					response.on("end", function(){
						resolve(httpResponseContent);
					});
				}
			}else{
				reject(_errorStr + response.statusCode);	
			}
		});

		httpReq.on('error', function(err) { 
			reject(_errorStr + err);
		});
	});
}

// Copies the Agent
function copyAgent(_destDir){
	return new Promise(function(resolve, reject){
		// Create the directory where the agent will copied to
		files.createDirectory(_destDir + paths.PATH_SEPERATOR + paths.getJSAgentSubDir())
		// Copy the agent
		.then((dest) => {
			let rd = fs.createReadStream(paths.getDownloadJSAgentPath());
			
			rd.on("error", function (err){
				reject("Could not read agent from download directory: " + err);
			});
			
			let wr = fs.createWriteStream(dest + "/" + paths.FILE_JSAGENT);
			wr.on("error", function (err){
				reject("Could not copy agent to " + dest + " directory: " + err);
			});
			
			wr.on("close", function(ex) {
				logger.logMessageSync("Copied agent to " + dest + " directory", logger.INFO);
				resolve(true);
			});
			
			rd.pipe(wr);
		});
	});
}