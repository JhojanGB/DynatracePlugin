#!/bin/bash

APK_FILE=
APK_INSTR_PROP_FILE=

function showUsage()
{
	echo "Usage: $0 apk=apk-file prop=instr-property-file"
}

function javaNotFound() {
    echo "Unable to find java in ${JAVA_HOME}\bin."
    echo "Please set the JAVA_HOME variable in your environment to match the location of your Java Development Kit (JDK) installation."
}

function jdkNotFound() {
    echo "A Java Runtime Environment (JRE) was detected in ${JAVA_HOME}. Java Development Kit (JDK) version 1.8 is required."
    echo "Please set the JAVA_HOME variable in your environment to match the location of your JDK installation."
}

function jdkWrongVersion() {
    echo "An unsupported version of the Java Development Kit (JDK) was detected in ${JAVA_HOME}. Java Development Kit (JDK) version 1.8 is required."
    echo "Please set the JAVA_HOME variable in your environment to match the location of your JDK installation."
}

function apkFileInvalid() {
    echo "There was a problem verifying the integrity of your APK file."
}

function setPaths()
{
	if [ `uname` == "Darwin" ]; then
		export JAVA_HOME=`/usr/libexec/java_home`
		TOOLS_HOME=${INSTALL_FOLDER}/tools/MacOS
		APK_NAME_NO_EXT=`basename -s'.apk' "$APK_FILE"`
	else
		TOOLS_HOME=${INSTALL_FOLDER}/tools/linux
		export LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${INSTALL_FOLDER}/tools/linux
		APK_NAME_NO_EXT=`basename "$APK_FILE" .apk`
	fi
}

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
# set the paths for JAVA_HOME and the SDK tools depending on if we are Mac or Linux

INSTALL_FOLDER="$(cd "$(dirname "$0")" && pwd -P)"
setPaths

#-----------------------------------------------------------------------------------------
# User may need to define JAVA_HOME environment variable

if [ ! -e "${JAVA_HOME}/bin/java" ]; then
    javaNotFound
    exit 1
fi

if [ ! -e "${JAVA_HOME}/bin/jar" ]; then
    jdkNotFound
    exit 1
fi

jver=$("${JAVA_HOME}/bin/java" -version 2>&1 | sed 's/.*version ".*\.\(.*\)\..*"/\1/; 1q')
if [ "${jver}" -lt 8 ]; then
    jdkWrongVersion
    exit 1
fi

"${JAVA_HOME}/bin/jar" -tf "${APK_FILE}" > /dev/null

if [ "$?" != "0" ] ; then
	apkFileInvalid
	exit 1
fi

#-----------------------------------------------------------------------------------------
# Optionally user can define JVM options such as -Xmx

JAVA_OPTIONS=-Xmx1024m

#-----------------------------------------------------------------------------------------
# Define the runtime environment based on our installation - keying off the path of this script

LIB_FOLDER="${INSTALL_FOLDER}/libs"
ASMDEX_LIB=${LIB_FOLDER}/asmdex.jar
DDX_LIB=${LIB_FOLDER}/ddx1.26.jar
APKTOOL_LIB=${LIB_FOLDER}/apktool.jar
DEX_LIB=${LIB_FOLDER}/dx.jar
ADK_LIB="${LIB_FOLDER}/Dynatrace.jar"
ADK_CB_LIB=${LIB_FOLDER}/Callbacks.jar
ADK_JSI_LIB=${LIB_FOLDER}/com.dynatrace.android.ext.jsi.jar
JACK_LIB=${LIB_FOLDER}/jack.jar
JILL_LIB=${LIB_FOLDER}/jill.jar
OKHTTP_LIB=${LIB_FOLDER}/com.dynatrace.android.okhttp.jar

if [ ! -f "$ADK_LIB" ]; then
	echo Agent library jar file not found.
	exit 1
fi

# -----------------------------------------------------------------------------------------
# Remove old framework dir for apktool
# -----------------------------------------------------------------------------------------
"${JAVA_HOME}/bin/java" ${JAVA_OPTIONS} -jar "${APKTOOL_LIB}" empty-framework-dir &> /dev/null

# This variable points to a COMMA delimited list of libraries the instrumented code will need at runtime.
# These libraries are converted to Dex files and then merged into a given classes.dex/APK

DEPENDENT_LIBS=${ADK_CB_LIB},${ADK_LIB},${ADK_JSI_LIB},${OKHTTP_LIB}

# Ensure Android SDK (aapt/zipalign/etc.) are on our path

PATH=${TOOLS_HOME}:${PATH}
export PATH

# Auto Instrumentation (dexify and merge) sub-processes need this environment variable to point to apktool.jar and dx.jar

TOOL_PATHS=${APKTOOL_LIB}:${DEX_LIB}
export TOOL_PATHS

# Auto Instrumentation dependent libs/paths

RUNTIME_LIBS=${LIB_FOLDER}/Common.jar:${LIB_FOLDER}/CommonJava.jar:${LIB_FOLDER}/APKit.jar
CLASSPATH=${JACK_LIB}:${JILL_LIB}:${ASMDEX_LIB}:${DDX_LIB}:${DEX_LIB}:${RUNTIME_LIBS}

# Ensure execution permissions

chmod +x "${TOOLS_HOME}"/*

#-----------------------------------------------------------------------------------------
# Instrument the given APK

"${JAVA_HOME}/bin/java" ${JAVA_OPTIONS} -cp "${CLASSPATH}" com.dynatrace.android.instrumentation.AdkInstrumentor "${APK_FILE}" -dep "${DEPENDENT_LIBS}" -prop "${APK_INSTR_PROP_FILE}"

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

zipalign -f 4 "${INSTRUMENTED_APK}" "${ZIPALIGNED_APK}"

if [ -f "${ZIPALIGNED_APK}" ]; then
	echo Zipaligning completed - Instrumented and zipaligned APK: ${ZIPALIGNED_APK}
else
	echo Zipaligning failed
	exit 4
fi

#-----------------------------------------------------------------------------------------
# Sign the instrumented APK

echo Signing non-release APK ...

"${JAVA_HOME}/bin/java" -jar "${LIB_FOLDER}/apksigner.jar" sign --ks "${LIB_FOLDER}/debug.keystore" --ks-pass pass:android --out "${FINAL_APK}" "${ZIPALIGNED_APK}" 

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

