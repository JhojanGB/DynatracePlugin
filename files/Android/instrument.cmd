@echo off

setlocal

:: -----------------------------------------------------------------------------------------
:: Define the runtime environment variables
:: -----------------------------------------------------------------------------------------

set "APK_FILE=null"
set "APK_INSTR_PROP_FILE=null"
:: Location of this instrumtation script
set "INSTALL_FOLDER=%~dp0"
:: Remove tailing \ if any
IF %INSTALL_FOLDER:~-1%==\ SET INSTALL_FOLDER=%INSTALL_FOLDER:~0,-1%
set "TOOLS=%INSTALL_FOLDER%\tools"
set "WIN_TOOLS=%TOOLS%\win"
set "LIB_FOLDER=%INSTALL_FOLDER%\libs"
set "CLASSPATH=%LIB_FOLDER%\*"

:: Optionally, user can define JVM options such as -Xmx
set JAVA_OPTIONS=-Xmx1024m

:: -----------------------------------------------------------------------------------------
:: Parsing the arguments that are passed to the instrument.cmd script
:: -----------------------------------------------------------------------------------------

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

:: -----------------------------------------------------------------------------------------
:: Find a suitable Java installation or exit
:: -----------------------------------------------------------------------------------------

for /f "tokens=1* delims=" %%a in ('call "%TOOLS%\findjava.bat"') do (
	:: react to JNF (Java not found) code with script termination
	if %%a == JNF (
		goto :end
	) else (
		:: print findjava.bat output
		echo %%a
		set JAVA_HOME=%%a
	)
)

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

"%JAVA_HOME%\bin\java" %JAVA_OPTIONS% -cp "%CLASSPATH%" com.dynatrace.android.instrumentation.AdkInstrumentor %APK_FILE% -prop %APK_INSTR_PROP_FILE% -wdir "%INSTALL_FOLDER%"

if %errorLevel% neq 0 goto :instrumentation_failed

:: -----------------------------------------------------------------------------------------
:: When the instrumentation is done, the result files are in these folders
:: -----------------------------------------------------------------------------------------

set FULLFILE=%APK_FILE%
for /F "tokens=*" %%i in (%FULLFILE%) do set BASEFILE=%%~ni
set APK_DIR=%BASEFILE%
set APK_NAME_NO_EXT=%BASEFILE%
for /F "tokens=*" %%i in (%FULLFILE%) do set BASEDIR=%%~dpi
IF %BASEDIR:~-1%==\ SET BASEDIR=%BASEDIR:~0,-1%
set APK_WORK_DIR=%BASEDIR%\%APK_DIR%

set "INSTRUMENTED_APK=%APK_WORK_DIR%\dist\%APK_NAME_NO_EXT%.apk"
set "ZIPALIGNED_APK=%APK_WORK_DIR%\dist\%APK_NAME_NO_EXT%-zipaligned.apk"
set "FINAL_APK=%APK_WORK_DIR%\dist\%APK_NAME_NO_EXT%-final.apk"

if not exist "%INSTRUMENTED_APK%" goto :instrumentation_failed

:: -----------------------------------------------------------------------------------------

"%WIN_TOOLS%\zipalign" -p -f 4 "%INSTRUMENTED_APK%" "%ZIPALIGNED_APK%"

if not exist "%ZIPALIGNED_APK%" goto :zipaligned_failed

:: -----------------------------------------------------------------------------------------
:: Sign the instrumented APK
:: -----------------------------------------------------------------------------------------
:sign_apk
echo Signing non-release APK ...

"%JAVA_HOME%\bin\java" -jar "%TOOLS%\apksigner.jar" sign --ks "%TOOLS%\debug.keystore" --ks-pass pass:android --out "%FINAL_APK%" "%ZIPALIGNED_APK%"
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
