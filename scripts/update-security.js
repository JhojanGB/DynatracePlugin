#!/usr/bin/env node

"use strict"; 

var logger = require('./logger.js');
var files = require('./fileOperationHelper.js');
var configHelper = require('./configHelper.js');

var SEC_POLICY_IDENTIFIER = "Content-Security-Policy";
var HTML_IDENTIFIER = ["src=\"cordova.js\"", "<ion-app>"];
var CONNECT_SRC = "connect-src";

module.exports = function (_path, _config){
    if(_path === undefined){
        throw new Error("Path is not defined - can not update CSP!");
    }

    let promiseTmp = Promise.resolve();

    if(_config === undefined){
        promiseTmp = promiseTmp.then(() => configHelper.readSettings())
        .then((configRead) => updateSecurity(_path, configRead));
    }else{
        promiseTmp = promiseTmp.then(() => updateSecurity(_path, _config));
    }

	return promiseTmp
	.then((rV) => {
		return rV;
	});
}

// Update the Content Security Policy
function updateSecurity(_path, _config){
    logger.logMessageSync("Successfully read the settings for modifying CSP", logger.INFO);

    if(_config.generalConfig.cspUpdate == "false"){
        logger.logMessageSync("Updating the CSP is turned off!", logger.INFO);
        return false;
    }
    
    return files.searchFileExtInDirectoryNonRecursive(_path, ".html", [])
    .then((htmlFiles) => {

        // Check those HTML Files and look if there is some CSP
        let promiseArrFiles = [];
        for(let i = 0; i < htmlFiles.length; i++){
            promiseArrFiles.push(checkForPolicy(htmlFiles[i]));
        }

        return Promise.all(promiseArrFiles);
    }).then((filesHandled) => {
        let fileContainingPolicy = filesHandled.filter(function(val){ return val; });   
        if(fileContainingPolicy.length > 1){
            logger.logMessageSync("Will not update security policy as the policy is available in two different files.", logger.WARNING);
            return false;
        }else if(fileContainingPolicy.length == 0){
            logger.logMessageSync("Will not update security policy as the plugin didnt find a html file containg a csp.", logger.WARNING);
            return false;
        }else if(fileContainingPolicy.length == 1){
            logger.logMessageSync("Updating the CSP to allow communication with the server!", logger.INFO);
                
            return files.readTextFromFile(fileContainingPolicy[0])
            .then((contentFile) => {
                let indexCSP = contentFile.indexOf(SEC_POLICY_IDENTIFIER);
                let indexCSPEnd = contentFile.indexOf("\">", indexCSP);
                let indexCSPContentStart = contentFile.indexOf("content=", SEC_POLICY_IDENTIFIER);

                if(indexCSPContentStart > indexCSPEnd){
                    throw new Error("CSP not correctly formatted!");
                }

                // CSP correctly formatted and as expected
                let indexCSPConnectSrc = contentFile.indexOf(CONNECT_SRC, indexCSPContentStart);
                
                let newFileContent;

                if(indexCSPConnectSrc == -1){
                    // Insert conntect-src as it is not available
                    newFileContent = contentFile.slice(0, indexCSPEnd) + " " + CONNECT_SRC + " " + urlForPolicy(_config) + ";" + contentFile.slice(indexCSPEnd);
                }else{
                    // Insert the url into the connect-src
                    newFileContent = contentFile.slice(0, indexCSPConnectSrc + CONNECT_SRC.length) + " " + urlForPolicy(_config) + contentFile.slice(indexCSPConnectSrc + CONNECT_SRC.length);
                }

                return files.writeTextToFile(fileContainingPolicy[0], newFileContent);
            });
        }
    })

    .then((rV) => {
        if(rV){
            logger.logMessageSync("Successfully updated the CSP!", logger.INFO); 
        }
                
        return rV;  
    })
 
	.catch((err) => {errorHandling(err)});
}

function errorHandling(_message){
	logger.logMessageSync(_message, logger.ERROR);
	throw new Error(_message);
}

// Check if this is the .html file which contains main logic and policy
function checkForPolicy(htmlFile){
    return files.readTextFromFile(htmlFile)
    .then((contentFile) => {
        // Check for CSP
        return checkForPolicyContent(contentFile) ? htmlFile : false;
    });
}

function checkForPolicyContent(content){
    if(content.indexOf(SEC_POLICY_IDENTIFIER) > -1){
        // Check if Main index html file
        for(let i = 0; i < HTML_IDENTIFIER.length; i++){
            if(content.indexOf(HTML_IDENTIFIER[i])){
                return true;
            }
        }
    }

    return false;
}

// Returns the URL which is going to the Dynatrace/Appmon Server
function urlForPolicy(config){
    let agentConfig = config.agentConfig[configHelper.PLATFORM_ANDROID - 1];

    if(agentConfig.DTXAgentStartupPath != undefined){
        // AppMon
        return agentConfig.DTXAgentStartupPath;
    }else{
        // Dynatrace
        if(agentConfig.DTXManagedCluster != undefined && agentConfig.DTXManagedCluster != "false"){
            // Managed
            return agentConfig.DTXClusterURL;
        }else{
            // Saas 
            let indexHttp = agentConfig.DTXClusterURL.indexOf("://");
            if(indexHttp != -1){
                return agentConfig.DTXClusterURL.slice(0, indexHttp + 3) + agentConfig.DTXAgentEnvironment + "." + agentConfig.DTXClusterURL.slice(indexHttp + 3);
            }else{
                return "https://" + agentConfig.DTXAgentEnvironment + "." + agentConfig.DTXClusterURL;
            }
        }
    }
}