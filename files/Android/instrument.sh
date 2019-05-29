#!/bin/bash

APK_FILE=
APK_INSTR_PROP_FILE=
# Absolute path to the installation (location of this script)
INSTALL_FOLDER="$(cd "$(dirname "$0")" && pwd -P)"
TOOLS=${INSTALL_FOLDER}/tools
# Optionally user can define JVM options such as -Xmx
JAVA_OPTIONS=-Xmx1024m
# Dependency libraries
export CLASSPATH="${INSTALL_FOLDER}/libs/*" 

#-----------------------------------------------------------------------------------------
# Error Messages
function showUsage()
{
	echo "Usage: $0 apk=apk-file prop=instr-property-file"
}

function apkFileInvalid() {
    echo "There was a problem verifying the integrity of your APK file."
}

#-----------------------------------------------------------------------------------------
# Depending on the OS the TOOLS_OS is set to point to the required tools
function setPaths()
{
	if [ `uname` == "Darwin" ]; then
		TOOLS_OS=${TOOLS}/MacOS
		APK_NAME_NO_EXT=`basename -s'.apk' "$APK_FILE"`
	else
		TOOLS_OS=${TOOLS}/linux
		export LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${TOOLS}/linux
		APK_NAME_NO_EXT=`basename "$APK_FILE" .apk`
	fi
}

#-----------------------------------------------------------------------------------------
# Parsing the arguments
while [ "$1" != "" ]; do
    PARAM=`echo "$1" | awk -F= '{print $1}'`
    VALUE=`echo "$1" | awk -F= '{print $2}' | sed -e 's/^"//'  -e 's/"$//'`
	case $PARAM in
		-h | --help)
			showUsage
			exit 0
			;;
		apk)
			APK_FILE="$VALUE"
			;;
		prop)
			APK_INSTR_PROP_FILE="$VALUE"
			;;
        fwdir)
            export FW_APK_DIR="$VALUE"
            ;;
		*)
			echo "ERROR: unknown parameter \"$PARAM\""
			showUsage
			exit 1
			;;
	esac
	shift
done

if [ "${APK_FILE}" == "" ]; then
	showUsage
	exit 1
fi

if [ "${APK_INSTR_PROP_FILE}" == "" ]; then
	showUsage
	exit 1
fi

#-----------------------------------------------------------------------------------------
# set the paths to OS depending tools and ensure execution permissions
setPaths
chmod +x "${TOOLS_OS}"/*

#-----------------------------------------------------------------------------------------
# Make sure that a proper Java installation is set in the JAVA_HOME variable.
# If not, try to find one
export JAVA_HOME
# source find java feature
source "${TOOLS}/findjava.sh"
if [ "$?" != "0" ] ; then
	exit 1
fi
# if no java is found it stops here


#-----------------------------------------------------------------------------------------
# Check if APK is well formed
"${JAVA_HOME}/bin/jar" -tf "${APK_FILE}" > /dev/null

if [ "$?" != "0" ] ; then
	apkFileInvalid
	exit 1
fi


#-----------------------------------------------------------------------------------------
# Instrument the given APK
"${JAVA_HOME}/bin/java" ${JAVA_OPTIONS} -cp "${CLASSPATH}" com.dynatrace.android.instrumentation.AdkInstrumentor "${APK_FILE}" -prop "${APK_INSTR_PROP_FILE}" -wdir "${INSTALL_FOLDER}"

if [ "${?}" != "0" ]; then
	echo Instrumentation failed
	exit 5
fi

#-----------------------------------------------------------------------------------------
# When the instrumentation is done, the result files are in these folders

APK_DIR=`dirname "$APK_FILE"`
APK_WORK_DIR="${APK_DIR}/${APK_NAME_NO_EXT}"

INSTRUMENTED_APK="${APK_WORK_DIR}/dist/${APK_NAME_NO_EXT}.apk"
ZIPALIGNED_APK="${APK_WORK_DIR}/dist/${APK_NAME_NO_EXT}-zipaligned.apk"
FINAL_APK="${APK_WORK_DIR}/dist/${APK_NAME_NO_EXT}-final.apk"

#-----------------------------------------------------------------------------------------

if [ -f "${INSTRUMENTED_APK}" ]; then
	echo Instrumentation completed - Instrumented APK: "${INSTRUMENTED_APK}"
else
    echo Instrumentation failed
	exit 2
fi

#-----------------------------------------------------------------------------------------
# Zipalign the signed APK

"${TOOLS_OS}/zipalign" -p -f 4 "${INSTRUMENTED_APK}" "${ZIPALIGNED_APK}"

if [ -f "${ZIPALIGNED_APK}" ]; then
	echo Zipaligning completed - Instrumented and zipaligned APK: ${ZIPALIGNED_APK}
else
	echo Zipaligning failed
	exit 4
fi

#-----------------------------------------------------------------------------------------
# Sign the instrumented APK

echo Signing non-release APK ...

"${JAVA_HOME}/bin/java" -jar "${TOOLS}/apksigner.jar" sign --ks "${TOOLS}/debug.keystore" --ks-pass pass:android --out "${FINAL_APK}" "${ZIPALIGNED_APK}"

#-----------------------------------------------------------------------------------------

if [ ! -f "${FINAL_APK}" ]; then
	echo Signing failed
	exit 3
fi

echo -----------------------------------------------------------------------------------------
echo Resulting APK files----------------------------------------------------------------------
echo Original: ${APK_FILE}
echo Instrumented: ${INSTRUMENTED_APK}
echo Instrumented and zipaligned: ${ZIPALIGNED_APK}
echo Instrumented, signed and zipaligned: ${FINAL_APK}
echo -----------------------------------------------------------------------------------------
echo -----------------------------------------------------------------------------------------

exit 0

