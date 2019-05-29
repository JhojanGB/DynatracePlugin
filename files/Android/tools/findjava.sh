#!/bin/bash
# This script identifies the location of a suitable Java installation
# If a Java installation is found it verifies if its version is compatible
# to the auto instrumentor. This is when the version is higher or equal to 1.8
# Furthermore it checks whether the Java executable is part of a JDK and not
# just a JRE. If one of the environment variables point to a JRE, this script
# checks if this JRE is located inside of a JDK installation and then uses the 
# JDK.
#
# Java is searched in the following locations and in this order:
# $JAVA_HOME, $JRE_HOME, *, $PATH
# * = in case of a Debian distribution it also checks in places that are
# dumped by the 'update-alternatives --list java' command
#
# once a suitable Java installation is found the search is stopped and the
# JAVA_HOME variable is modified to point to the found Java installation. 
#
# If you want to make sure a specific java installation is used, declare it 
# as JAVA_HOME
verbose=false

requiredMajor=1
requiredMinor=8

function printProgramStart(){
	if [ $verbose = true ]; then echo "Looking for Java..." ; fi
}

# Pass the path as argument
function printJDKNotFound() {
    echo "A Java Runtime Environment (JRE) was detected in $1. Java Development Kit (JDK) version $requiredMajor.$requiredMinor is required."
}
# Pass the path as argument
function printNoJavaExecutableFound() {
    echo "No Java found in $1"
}
function printJavaVersionIncompatible(){
   	echo "Your Java version is not compatible! Java Development Kit (JDK) version $requiredMajor.$requiredMinor is required."
}
function printSectionBegin(){
	if [ $verbose = true ]; then echo "======================================" ; fi
}
# Pass the path as argument
function printCheckJavaInstallation(){
	if [ $verbose = true ]; then echo "Check Java installation in $1" ;fi
}
function printFoundCompatibleJava(){
	if [ $verbose = true ]; then
		echo "Found Java in $1/bin"
		echo "Java version is compatible."
	fi
}
function printFoundJRE(){
	if [ $verbose = true ]; then
		echo "Found a Java Runtime Environment (JRE)"
		echo "Trying to find a Java Development Kit (JDK) in the parent folder..."
	fi
}
function printFoundJDK(){
	if [ $verbose = true ]; then echo "The found Java is part of the Java Development Kit (JDK)" ; fi
}
# Pass the path as argument
function printFoundJDKNearby(){
	if [ $verbose = true ]; then echo "Found a JDK nearby the JRE in $1" ; fi
}

# returns 0 if true and -1 if false
function isJDK(){
	local javapath="$1"
	if [ -f "$javapath/bin/jar" ]; then
		echo 0
	else
		echo -1
	fi
		
}

# returns 0 if java path is valid, 2 if invalid and an error message if java not compatible
function isValidJavaPath(){
	local jpath="$1/bin/java"

	if [ -f "$jpath" ]; then
		isCompatibleJavaVersion $jpath
		checkVersion=$?
		# Java version compatible
		if [ $checkVersion -eq 0 ]; then
			return 0
		elif [ $checkVersion -eq 1 ]; then
			printJavaVersionIncompatible
			return 2
		else
			printNoJavaExecutableFound $jpath
		fi
	else
		printNoJavaExecutableFound $jpath
	fi
	return 1
}



# returns 0 if compatible, 1 if not compatible, 2 if not existing
function isCompatibleJavaVersion(){
	local javapath="$1"
	# path ends with java
	if [ $(basename "$javapath") = java ] && [ -x "$javapath" ]; then

		# version determination:
		# first: call 'java -version' to get version info and redirect it from stderr (default) to stdout
		# second: find the line that contains the version number using grep. this is needed because we cannot
		# 		  assume that the first line contains the version. certain environment variables may prepend some lines.
		#		  grep regex pattern: line has to start with an alphabetic character followed by some arbitrary characters which
		#		  represent the java manufacturer. then we expect the keyword 'version' followed by an optional double quote.
		#		  after that the version number starts.
		# finally: the version is extracted using sed. It looks for multiple occurrences of any character followed by the 'version'
		# 		  keyword and then the optional double quote. The following combination of numbers and dots is packed into a group
		#		  using () brackets. Then all of the matching characters are replaced by the group content \1 with an added 0.
		#
		# example: 1.8.0.0 is returned for java with version "1.8.0_131"
		# 	       or 9.0 for java with version "9"
		#
		# the cut tool now separates major and minor number from the resulting version string by splitting it by the "." character
		# and using the first and the second field (-f1, -f2)
		# note: the tailing 0 added by sed ensures that the cut -f2 operation does not return the same value as cut -f1
		# as it would be the case for a single digit version like "9"

		local JV=$($javapath -version 2>&1 | grep -E "[a-zA-Z].* version \"?[0-9]" | sed -E 's/.*version "?([0-9\.]*).*/\1.0/;')
		maj=$(echo $JV | cut -f1 -d.)
		min=$(echo $JV | cut -f2 -d.)
		
		if [ -z "$maj" ]; then maj=0; fi
		if [ -z "$min" ]; then min=0; fi
		
		if [ $maj -lt $requiredMajor ]; then
			return 1
		elif [ $maj -gt $requiredMajor ]; then
			return 0
		# if $maj == $requiredMajor
		else
			if [ $min -ge $requiredMinor ]; then
				return 0
			else
				return 1
			fi

		fi
	else
		return 2
	fi

}

# get absolute path to file or directory
function getAbsPath(){
	if [ -f $1 ]; then
		cd $(dirname $1)
		echo $(pwd -P)/$(basename $1)
	elif [ -d $1 ]; then
		cd $1
		echo $(pwd -P)
	else
		echo "/dev/null"
	fi
}

# program starts here
printProgramStart

path=$PATH

# for Ubuntu, look for Java installation in alternative system
type update-alternatives >/dev/null 2>&1
if [ $? -eq 0 ]; then
	javaInstallations=$(update-alternatives --list java 2>/dev/null)
	javaInstallations=$(echo "$javaInstallations" | tr '\n' ':')
        path="$javaInstallations:$path"
fi

# for mac osx add /usr/libexec/java_home to search-path
if [ `uname` == "Darwin" ]; then
	path="$(/usr/libexec/java_home):$path"
fi

# add JRE_HOME and JAVA_HOME to the search options
if [ -d "$JRE_HOME" ] || [ -f "$JRE_HOME" ]; then
	path="$JRE_HOME:$path"
fi
if [ -d "$JAVA_HOME" ] || [ -f "$JAVA_HOME" ]; then
	path="$JAVA_HOME:$path"
fi

NEW_JAVA_HOME=0
# split the path by colon
splitPathList=$(echo "$path" | tr ':' '\n')
# store IFS value from user
SAVEIFS=$IFS
IFS=$(echo -en "\n\b")
# iterate throug all paths
for p in ${splitPathList}; do
	printSectionBegin
	bn="$(basename "$p")"

	# navigate to base directory
	if [ $bn = java ]; then 
		p=$(dirname "$p")/../
	elif [ $bn = bin ]; then 
		p=$p/../
	else 
		p=$p/
	fi

	# get absolute from relative path
	p=$(getAbsPath $p)

	# check if getAbsPath returns invalid path
	if [ $p = "/dev/null" ]; then
		continue
	fi

	# check if path points to valid and compatible java
	printCheckJavaInstallation $p	
	isValidJavaPath $p
	result=$?

	# is valid and compatible
	if [ $result = "0" ]; then
		printFoundCompatibleJava $p
		isjdk=$(isJDK $p)
		if [ "$isjdk" -eq 0 ]; then 
			printFoundJDK
			NEW_JAVA_HOME=$p
			break
		# ist not a jdk:
		else
			printFoundJRE
			#search again nearby
			p=$(getAbsPath $p/..)
			isValidJavaPath $p
			result=$?
	
			if [ $result = "0" ]; then
				isjdk=$(isJDK $p)
				if [ "$isjdk" -eq 0 ]; then 
					printFoundJDKNearby $p
					NEW_JAVA_HOME=$p
					break
				else 
					printJDKNotFound $p
				fi
			else
				printJDKNotFound $p
			fi
		fi
	fi
done
IFS=$SAVEIFS

if [ "$NEW_JAVA_HOME" = "0" ]; then
	echo "Unable to find java on your machine"
	echo "Please set the JAVA_HOME variable in your environment to match the location of your Java Development Kit (JDK) installation."
	export JAVA_HOME=0
	return 1
else
	# if the found JAVA_HOME is the root folder, strip the additional slash
	if [ $NEW_JAVA_HOME = "//" ]; then
		NEW_JAVA_HOME="/"
	fi
	export JAVA_HOME=$NEW_JAVA_HOME
	echo "JAVA_HOME was set to:"
	echo "$NEW_JAVA_HOME"
	return 0
fi

