var updateJs = require('./update-js.js');
var updateCsp = require('./update-security.js');
var updateIosPlistFile = require('./update-build-ios.js');

var paths = require('./pathsConstants.js');
var config = require('./configHelper.js');
var logger = require('./logger.js');
var files = require('./fileOperationHelper.js');
var pathModule = require('path');

module.exports = function (context){
	logger.logMessageSync("Reading settings for the Dynatrace instrumentation ..", logger.INFO);
	
	// Read the settings
	return config.readSettings()
	.then((configs) => {
		logger.logMessageSync("Successfully read the settings for the Dynatrace instrumentation!", logger.INFO);

		// Download / Update JS Agent
		return updateJs.downloadJSAgent(configs)

		// List All Platforms
		.then(() => {
			let promisePlatforms = Promise.resolve(); 

			// Going through platforms
			context.opts.platforms.forEach(platform => {
				let platformLow = platform.toLowerCase(); 
				if(platformLow.indexOf('android') != -1){
                    promisePlatforms = promisePlatforms.then(() => {
						return paths.getAndroidAssetsPath()
						.then((_path) => {
							// Get the APK path to delete it because new Cordova does not clean
							return paths.getAndroidAPKPath()
							.then((pathToDel) => {
								files.deleteDirectory(pathToDel)
								.catch(() => {return true;});
							})
							.then(() => preparePlatform(configs, _path));
						});
					});
				}else if(platformLow.indexOf('ios') != -1){
					promisePlatforms = promisePlatforms
					.then(() => preparePlatform(configs, paths.getIOSAssetsPath()))
					// Update the .plist file for iOS
					.then(() => updateIosPlistFile());
				}else{
					// If we dont know the platform we check if there is a www folder
					promisePlatforms = promisePlatforms.then(() => {
						let dirToCheck = pathModule.join(paths.getPlatformPath(), platformLow, paths.FOLDER_WWW);
						return files.checkIfFileExists(dirToCheck)
                        .then(() => preparePlatform(configs, dirToCheck));
					});
				}
			});

			return promisePlatforms;
		});
	})

	.then(() => {
		// No error so return true - the action was okay
		return true;
	})

	.catch((err) => {errorHandling(err)});
}

// Error Handler
function errorHandling(_message){
	if(_message.message == config.ERROR_CONFIG_NOT_AVAILABLE){
		logger.logMessageSync("Dynatrace Cordova Plugin configuration is not available! Skip Updating Files.", logger.ERROR);
	}else{
		logger.logMessageSync(_message, logger.ERROR);
		return logger.closeLogFile()
		.then(() => {
			throw new Error(_message);
		});
	}
}

// Prepare a platform - so you need to update the index.html
// copy the JSAgent and update the csp if needed
function preparePlatform(configs, path){
	if(configs.jsAgentConfig !== undefined){
		return updateJs.updateHTMLWithJSAgent(path)
		.then(() => updateCsp(path, configs));
	}else{
		return Promise.resolve();
	}
}