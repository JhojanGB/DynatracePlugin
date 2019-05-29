#!/usr/bin/env node

"use strict"; 

// Imports
var fs = require('fs');
var path = require('path');
var paths = require('./pathsConstants.js');
var logger = require('./logger.js');

// Messages
var FILE_COPY_FAILED = "Failed to copy File: ";

// EXPORTS - FUNCTIONS
exports.checkIfFileExists = checkIfFileExists;
exports.writeTextToFile = writeTextToFile;
exports.readTextFromFile = readTextFromFile;
exports.searchFilesInDirectoryRecursive = searchFilesInDirectoryRecursive;
exports.searchFileExtInDirectoryRecursive = searchFileExtInDirectoryRecursive;
exports.searchFileExtInDirectoryNonRecursive = searchFileExtInDirectoryNonRecursive;
exports.copyFile = copyFile;
exports.cutFile = cutFile;
exports.createDirectory = createDirectory;
exports.isDirectory = isDirectory;
exports.deleteDirectory = deleteDirectory;
exports.deleteFile = deleteFile;

// Check if a File exists
function checkIfFileExists(_file){
	return new Promise(function(resolve, reject){
		fs.stat(_file, function(err, stat) {
			if(err){
				reject("File not available: " + path.resolve(_file));
				return;
			}
			
			resolve(_file);
		});
	});
}

// Reads the gradle file and returns the content of the gradle file
function readTextFromFile(_file){
	return new Promise(function(resolve, reject){
		fs.readFile(_file, "utf8", (err, data) => {
			if (err){
				reject("Could not read the file: " + path.resolve(_file));
			}
			
			resolve(data);
		});
	});
}

// Write the new changes to the gradle file
function writeTextToFile(_file, _text){
	return new Promise(function(resolve, reject){
		fs.writeFile(_file, _text, (err) => {
			if(err){
				reject(err + " Could not write to file: " + path.resolve(_file));
			}
			
			resolve(_file);
		})
	});
}

// Is the file a directory or not
function isDirectory(_pathNew){
	return new Promise(function(resolve, reject){
		fs.stat(_pathNew, function(err, stats){
			if(err){
				logger.logMessageSync("Directory could not be read: " + path.resolve(_pathNew), logger.ERROR);
				reject(err);
			}
			
			let info = {
				isDirectory: stats.isDirectory(),
				path: _pathNew
			}
			
			resolve(info);
		});
	});
}

// Is the directory name filtered
function isDirectoryFiltered(_dirPath, _filteredDirectories){
	let dirName = path.basename(_dirPath);
	for(let i = 0; i < _filteredDirectories.length; i++){
		if(dirName == _filteredDirectories[i]){
			return true;
		}
	}
	
	return false;
}

// Wrapper for Search File function
function searchFilesInDirectoryRecursive(_path, _filePattern, _filteredDirectories){
	return _searchFilePatternInDirectory(_path, [], _filePattern, _filteredDirectories, true, compareFileNames);
}

function searchFileExtInDirectoryRecursive(_path, _fileExt, _filteredDirectories){
	return _searchFilePatternInDirectory(_path, [], _fileExt, _filteredDirectories, true, compareExt);
}

function searchFileExtInDirectoryNonRecursive(_path, _fileExt, _filteredDirectories){
	return _searchFilePatternInDirectory(_path, [], _fileExt, _filteredDirectories, false, compareExt);
}

// Compare function which comes a pattern to a file name
function compareFileNames(_file, _filePattern){
	let fileName = path.basename(_file);
			
	return fileName.indexOf(_filePattern) > -1;
}

// Compare function which matches extensions with a file extension
function compareExt(_file, _ext){
	let extName = path.extname(_file);
	return extName == _ext;
}

// Search for files in a directory
function _searchFilePatternInDirectory(_path, _foundFiles, _pattern, _filteredDirectories, _recursive, _fileCompare){
	return new Promise(function(resolve, reject){
		// Read Dir - Which Files
		fs.readdir(_path, function(err, files){
			if(err){
				reject("Directory could not be read: " + path.resolve(_path));
				return;
			}
			
			// Simultanous Execution - Check If Directory or Not
			let promiseArr = [];
			for(let i = 0; i < files.length; i++){
				promiseArr.push(isDirectory(path.join(_path, files[i])));
			}
			
			Promise.all(promiseArr).then(values => {
				let dirArr = [];
		
				for(let i = 0; i < promiseArr.length; i++){
					if(values[i].isDirectory){
						if(!isDirectoryFiltered(values[i].path, _filteredDirectories) && _recursive){
							dirArr.push(values[i].path);
						}
					}else{
						if(_fileCompare(values[i].path, _pattern)){
							// Found the file 
							_foundFiles.push(values[i].path);
						}
					}
				}
				
				let anotherPromise = Promise.resolve(_foundFiles);
				for(let ii = 0; ii < dirArr.length; ii++){
					anotherPromise = anotherPromise.then((foundFiles) => {
						return _searchFilePatternInDirectory(dirArr[ii], foundFiles, _pattern, _filteredDirectories, _recursive, _fileCompare);	
					})
				}
				
				if(dirArr.length == 0){
					resolve(_foundFiles);
				}else{
					resolve(anotherPromise);
				}
			});
		});
	});
}

// Copy File from A to B
function copyFile(_srcPath, _destPath, _destFileName){
	return new Promise(function(resolve, reject){
		let fileName = path.basename(_srcPath);
		let srcFile = fs.createReadStream(_srcPath);
		
		srcFile.on("error", function(err) {
			reject(FILE_COPY_FAILED  + err);
		});
		
		let destFile;
		
		if(_destFileName != undefined){
			destFile = fs.createWriteStream(path.join(_destPath, _destFileName));
		}else{
			destFile = fs.createWriteStream(path.join(_destPath, fileName));
		}
		
		destFile.on("error", function(err) {
			reject(FILE_COPY_FAILED + err);
		});
		
		destFile.on("close", function() {
			resolve(path.join(_destPath, fileName));
		});
		
		srcFile.pipe(destFile);
	});
}

// Makes a copy of the file and will cut it afterwards
function cutFile(_srcPath, _destPath){
	return createDirectory(_destPath)
	.then(() => {return copyFile(_srcPath, _destPath)})
	.then(() => {return deleteFile(_srcPath, "")});
}

// Create the a new directory
function createDirectory(_dir){
	return new Promise(function(resolve, reject){
		fs.mkdir(_dir, function(){
			resolve(_dir);
		})
	});
}

// Delete file
function deleteFile(dir, file) {
    return new Promise(function (resolve, reject) {
        var filePath = path.join(dir, file);
        fs.lstat(filePath, function (err, stats) {
            if (err) {
                return reject(err);
            }
            if (stats.isDirectory()) {
                resolve(deleteDirectory(filePath));
            } else {
                fs.unlink(filePath, function (err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            }
        });
    });
}

// Delete directory
function deleteDirectory(dir) {
    return new Promise(function (resolve, reject) {
        fs.access(dir, function (err) {
            if (err) {
                return reject(err);
            }
            fs.readdir(dir, function (err, files) {
                if (err) {
                    return reject(err);
                }
                Promise.all(files.map(function (file) {
                    return deleteFile(dir, file);
                })).then(function () {
                    fs.rmdir(dir, function (err) {
                        if (err) {
                            return reject(err);
                        }
                        resolve();
                    });
                }).catch(reject);
            });
        });
    });
}
