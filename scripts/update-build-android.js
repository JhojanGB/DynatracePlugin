#!/usr/bin/env node

"use strict"; 

// Imports
var androidBuild = require('./update-build-android-helper');

module.exports = async function(){
	await androidBuild.updateAndroidBuild();
};
