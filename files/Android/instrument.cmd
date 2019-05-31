@echo off

setlocal

set APK_FILE=null
set APK_INSTR_PROP_FILE=null
set INSTALL_FOLDER=%~dp0
set ANDROID_SDK_HOME=%~dp0\tools\win

:parseargs
if not "%1"=="" (
    if "%1"=="apk" (
        SET APK_FILE="%~2"
        SHIFT
    )
    if "%1"=="prop" (
        SET APK_INSTR_PROP_FILE="%~2"
        SHIFT
    )
    if "%1"=="fwdir" (
::      Quotes around the argument, e.g., fwdir="dir containing 1.apk" but no quotes here
        SET FW_APK_DIR=%~2
        SHIFT
    )
    SHIFT
    goto :parseargs
)

if not exist %APK_FILE% (
    echo Please specify an APK file using the option apk=filename.apk
    goto :usage
)

if not exist %APK_INSTR_PROP_FILE% (
    echo Please specify an instrumentation properties file using the option prop=filename.properties
    goto :usage
)

:: Optionally, user can define JVM options such as -Xmx

set JAVA_OPTIONS=-Xmx1024m

:: -----------------------------------------------------------------------------------------
:: Do java and jar exist and can we execute them?
:: -----------------------------------------------------------------------------------------

"%JAVA_HOME%\bin\java.exe" -version 1> NUL 2> NUL
if not %errorLevel%==0 goto :java_not_found

for /F "tokens=1-3" %%A in ('"%JAVA_HOME%\bin\java.exe" -version 2^>^&1') do (
    if /I "%%A %%B" == "java version" (
        set "JavaVersion=%%~C"
    )
)

for /F "tokens=2 delims=." %%I in ("%JavaVersion%") do set "jver=%%I"

if %jver% LSS 8 (
	goto :jdk_wrong_version
)

if exist "%JAVA_HOME%\bin\jar.exe" (
    "%JAVA_HOME%\bin\jar.exe" -tf %APK_FILE% 1> NUL 2> NUL
    if not %errorLevel%==0 goto :apk_file_invalid
) else (
    goto :jdk_not_found
)

:: -----------------------------------------------------------------------------------------
:: Define the runtime environment based on our installation - keying off the path of this script
:: -----------------------------------------------------------------------------------------

set LIB_FOLDER=%INSTALL_FOLDER%\libs
set ASMDEX_LIB=%LIB_FOLDER%\asmdex.jar
set DDX_LIB=%LIB_FOLDER%\ddx1.26.jar
set APKTOOL_LIB=%LIB_FOLDER%\apktool.jar
set DEX_LIB=%LIB_FOLDER%\dx.jar
set ADK_LIB=%LIB_FOLDER%\Dynatrace.jar
set ADK_CB_LIB=%LIB_FOLDER%\Callbacks.jar
set ADK_JSI_LIB=%LIB_FOLDER%\com.dynatrace.android.ext.jsi.jar
set JACK_LIB=%LIB_FOLDER%\jack.jar
set JILL_LIB=%LIB_FOLDER%\jill.jar
set OKHTTP_LIB=%LIB_FOLDER%\com.dynatrace.android.okhttp.jar

if ["%ADK_LIB%"]==[] goto :adk_file_missing

:: -----------------------------------------------------------------------------------------
:: Remove old framework dir for apktool
:: -----------------------------------------------------------------------------------------
"%JAVA_HOME%\bin\java" %JAVA_OPTIONS% -jar "%APKTOOL_LIB%" empty-framework-dir 1> NUL 2> NUL

:: -----------------------------------------------------------------------------------------
:: This variable points to a COMMA delimited list of libraries the instrumented code will need at runtime.
:: These libraries are converted to Dex files and then merged into a given classes.dex\APK
:: -----------------------------------------------------------------------------------------

set DEPENDENT_LIBS=%ADK_CB_LIB%,%ADK_LIB%,%ADK_JSI_LIB%,%OKHTTP_LIB%

:: -----------------------------------------------------------------------------------------
:: Ensure Android SDK (aapt) tools are on our path
:: -----------------------------------------------------------------------------------------

set PATH=%ANDROID_SDK_HOME%;%PATH%

:: -----------------------------------------------------------------------------------------
:: Auto Instrumentation (dexify and merge) sub-processes need this environment variable to point to apktool.jar and dx.jar
:: -----------------------------------------------------------------------------------------

set TOOL_PATHS=%APKTOOL_LIB%;%DEX_LIB%

:: -----------------------------------------------------------------------------------------
:: Auto Instrumentation dependent libs\paths
:: -----------------------------------------------------------------------------------------

set RUNTIME_LIBS=%LIB_FOLDER%\Common.jar;%LIB_FOLDER%\CommonJava.jar;%LIB_FOLDER%\APKit.jar

set CLASSPATH=%JACK_LIB%;%JILL_LIB%;%ASMDEX_LIB%;%DDX_LIB%;%DEX_LIB%;%RUNTIME_LIBS%

:: -----------------------------------------------------------------------------------------
:: Let's make sure we have everything we need
:: -----------------------------------------------------------------------------------------

if %APK_FILE%=="" GOTO :usage
if %APK_INSTR_PROP_FILE%=="" GOTO :usage
if not exist %APK_FILE% goto :apk_file_missing
if not exist %APK_INSTR_PROP_FILE% goto :prop_file_missing

:: -----------------------------------------------------------------------------------------
:: Instrument the given APK
:: -----------------------------------------------------------------------------------------

"%JAVA_HOME%\bin\java" %JAVA_OPTIONS% -cp "%CLASSPATH%" com.dynatrace.android.instrumentation.AdkInstrumentor %APK_FILE% -dep "%DEPENDENT_LIBS%" -prop %APK_INSTR_PROP_FILE%

if %errorLevel% neq 0 goto :instrumentation_failed

:: -----------------------------------------------------------------------------------------
:: When the instrumentation is done, the result files are in these folders
:: -----------------------------------------------------------------------------------------

set FULLFILE=%APK_FILE%
for /F "tokens=*" %%i in (%FULLFILE%) do set BASEFILE=%%~ni
set APK_DIR=%BASEFILE%
set APK_NAME_NO_EXT=%BASEFILE%
for /F "tokens=*" %%i in (%FULLFILE%) do set BASEDIR=%%~dpi
set APK_WORK_DIR=%BASEDIR%\%APK_DIR%

set "INSTRUMENTED_APK=%APK_WORK_DIR%\dist\%APK_NAME_NO_EXT%.apk"
set "ZIPALIGNED_APK=%APK_WORK_DIR%\dist\%APK_NAME_NO_EXT%-zipaligned.apk"
set "FINAL_APK=%APK_WORK_DIR%\dist\%APK_NAME_NO_EXT%-final.apk"

if not exist "%INSTRUMENTED_APK%" goto :instrumentation_failed

:: -----------------------------------------------------------------------------------------

zipalign -f 4 "%INSTRUMENTED_APK%" "%ZIPALIGNED_APK%"

if not exist "%ZIPALIGNED_APK%" goto :zipaligned_failed

:: -----------------------------------------------------------------------------------------
:: Sign the instrumented APK
:: -----------------------------------------------------------------------------------------
:sign_apk
echo Signing non-release APK ...

"%JAVA_HOME%\bin\java" -jar "%LIB_FOLDER%\apksigner.jar" sign --ks "%LIB_FOLDER%\debug.keystore" --ks-pass pass:android --out "%FINAL_APK%" "%ZIPALIGNED_APK%" 
if not exist "%FINAL_APK%" goto :apk_sign_failed

echo -----------------------------------------------------------------------------------------
echo Resulting APK files----------------------------------------------------------------------
echo Original: %APK_FILE%
echo Instrumented: %INSTRUMENTED_APK%
echo Instrumented and zipaligned: %ZIPALIGNED_APK%
echo Instrumented, signed and zipaligned: %FINAL_APK%
echo -----------------------------------------------------------------------------------------
echo -----------------------------------------------------------------------------------------

:: -----------------------------------------------------------------------------------------
:: End of logic
:: -----------------------------------------------------------------------------------------
goto :end

:apk_file_missing
echo APK file %APK_FILE% not found.
goto :usage

:prop_file_missing
echo Properties file %APK_INSTR_PROP_FILE% not found.
goto :usage

:adk_file_missing
echo Agent library jar file not found.
goto :end

:usage
echo Usage: instrument.cmd apk=apk-file prop=instr-property-file
goto :end

:java_not_found
echo Unable to find java.exe in %JAVA_HOME%\bin.
echo Please set the JAVA_HOME variable in your environment to match the location of your Java Development Kit (JDK) installation.
goto :end

:jdk_not_found
echo A Java Runtime Environment (JRE) was detected in %JAVA_HOME%. Java Development Kit (JDK) version 1.8 is required.
echo Please set the JAVA_HOME variable in your environment to match the location of your JDK installation.
goto :end

:jdk_wrong_version
echo An unsupported version of the Java Development Kit (JDK) was detected in %JAVA_HOME%. Java Development Kit (JDK) version 1.8 is required.
echo Please set the JAVA_HOME variable in your environment to match the location of a supported JDK installation.
goto :end

:apk_file_invalid
echo There was a problem verifying the integrity of your APK file.
goto :end

:instrumentation_failed
echo Unable to instrument %APK_FILE%. See log for details.
goto :end

:zipaligned_failed
echo Unable to zipalign %INSTRUMENTED_APK%.
goto :end

:apk_sign_failed
echo Unable to sign %ZIPALIGNED_APK%.
goto :end

:end
endlocal
