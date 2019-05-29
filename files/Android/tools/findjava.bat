@echo off
:: This script identifies the location of a suitable Java installation
:: If a Java installation is found it verifies if its version is compatible
:: to the auto instrumentor. This is when the version is higher or equal to 1.8
:: Furthermore it checks whether the Java executable is part of a JDK and not
:: just a JRE. If one of the environment variables point to a JRE, this script
:: checks if this JRE is located inside of a JDK installation and then uses the 
:: JDK.
::
:: Java is searched in the following locations and in this order:
:: %JAVA_HOME%, %JRE_HOME%, %PATH%
::
:: Once a suitable Java installation is found the search is stopped and as
:: the last line in the output the Java location is dumped.
:: When there is no suitable Java "null" is dumped as last line of output
::
:: If you want to make sure a specific java installation is used, declare it 
:: as %JAVA_HOME%
set VERBOSE_OUTPUT=0

setlocal
setlocal EnableDelayedExpansion

set TEMPFILE=%TEMP%\javainstallations
if exist %TEMPFILE% ( del %tempfile% )

set REQUIRED_JAVA_MAJOR=1
set REQUIRED_JAVA_MINOR=8


echo "%JAVA_HOME%">> %TEMPFILE%
echo "%JRE_HOME%">> %TEMPFILE%
where java >> %TEMPFILE%
set FOUND_JAVA_HOME=0
if %VERBOSE_OUTPUT% == 1 (
	echo Looking for Java...
)
for /f "usebackq tokens=* delims= " %%j in (%TEMPFILE%) do (
	:: only continue if java not found yet
	if !FOUND_JAVA_HOME! == 0 (
		set "originalpath=%%j"

		:: remove quotes
		set originalpath=!originalpath:"=!

		:: remove tailing backslash if any
		set "tail=!originalpath:~-1!!"
		if "!tail!" == "\" (
			set "originalpath=!originalpath:~0,-1!"
			if %VERBOSE_OUTPUT% == 1 (
				echo removed tail !originalpath!
			)
		)
		if "!tail!" == "/" (
			set "originalpath=!originalpath:~0,-1!"
			if %VERBOSE_OUTPUT% == 1 (
				echo removed tail !originalpath!
			)
		)

		:: check if path is valid
		if exist "!originalpath!" (
			call :process "!originalpath!"
		) 
	)
)
:: all done, delete temp file
del %tempfile%
goto :FINISHED


:process
if %VERBOSE_OUTPUT% == 1 (
	echo ======================================
)
set filename=0
set fullpath=0
set abspath=0
set passedpath=%1

for /f "delims="  %%I in (!passedpath!) do (
	:: nxI --> expands %I to a file name and extension only
	set "filename=%%~nxI!"
	:: dpI --> expands %I to a drive letter and path only
	set "fullpath=%%~dpI!"
	:: fI --> expands %I to a fully qualified path name
	set "abspath=%%~fI!"
)

if %VERBOSE_OUTPUT% == 1 (
	echo Check Java installation in !abspath! ...
)
set binfolder=!fullpath:~-4,-1!
:: path points to java.exe
if !filename! == java.exe (
	:: if java.exe lies in a bin folder
	if !binfolder! == bin (
		set JH=!fullpath!..
	) else (
		echo !abspath! is not part of a full JDK
		goto :EOF
	)
) else if !filename! == bin (
	set JH=!abspath!\..
) else (
	set JH=!abspath!
)

set JAVA_EXE=!JH!\bin\java.exe
set JAR_EXE=!JH!\bin\jar.exe
set JDK_HOME=0

:: check if java_home is set correctly
if exist "!JAVA_EXE!" (
	if %VERBOSE_OUTPUT% == 1 (
		echo Found a java.exe in !JAVA_EXE!
	)
	goto :CHECK_JDK
) else (
	if %VERBOSE_OUTPUT% == 1 (
		echo Found no java.exe in !JH!
	)
	:: next loop run
	goto :EOF
)

:: check if the java installation is a JDK and not a JRE
:CHECK_JDK
if %VERBOSE_OUTPUT% == 1 (
	echo Checking if java.exe is part of a JDK... 
)
if exist "!JAR_EXE!" (
	:: found a jar.exe which is only present in JDK
	if %VERBOSE_OUTPUT% == 1 (
		echo Found a JDK in !JH! 
	)
	goto :CHECK_JAVA_VERSION
) else (
	:: seems to be a JRE, go and check if this JRE is inside a JDK
	if %VERBOSE_OUTPUT% == 1 (
		echo !JH! is NOT part of the JDK. Probably its in a JRE.
		echo Trying find the JDK in the parent folder of the JRE...
	)
	set JDK_HOME=!JH!\..
	set JAR_EXE=!JDK_HOME!\bin\jar.exe
	goto :CHECK_NEARBY_JDK
)

:: check if this JRE is located beside a JDK
:CHECK_NEARBY_JDK
if exist "!JAR_EXE!" (
	:: found a JDK, set JAVA_HOME to this installation
	if %VERBOSE_OUTPUT% == 1 (
		echo Found a JDK nearby the JRE in "!JDK_HOME!"
	)
	set JH=!JDK_HOME!
	goto :CHECK_JAVA_VERSION
) else (
	:: no JDK found
	echo Found no JDK in "!JDK_HOME!"
	echo A Java Runtime Environment ^(JRE^) was detected in "!JDK_HOME!". Java Development Kit ^(JDK^) version %REQUIRED_JAVA_MAJOR%.%REQUIRED_JAVA_MINOR% is required.
	goto :eof
)

:CHECK_JAVA_VERSION
if %VERBOSE_OUTPUT% == 1 (
	echo Checking Java version...
)
:: check if java version is supported


:: clean from quotes
set JH=!JH:"=!
set VERSIONSTRING=0

:: request the version from the java executable
:: use 'findstr' to select the line where the version is given
:: this step is required as the first line of 'java -version' does not necessarily contain the version when certain
:: environment variables are set.
:: we assume that a line contains the version when it starts with a non-numerical character and is followed by some
:: characters that depict the java manufacturing name, then a space and the keyword 'version' follows.
:: after that an optional quote is expected and followed by the version number.
:: Note that we have to use \"* instead of \"? for optional characters because 'findstr' only supports limited regex.

for /f "delims=" %%A in (
'call "!JH!\bin\java" -version 2^>^&1 ^| findstr /R /C:"[a-zA-z].* version \"*[0-9]"'
) do set "VERSIONSTRING=%%A"

:: the presumed line containing the version is now used to extract the version number
for /f "tokens=3 delims= " %%A in ("!VERSIONSTRING!") do (
	set version=%%A
	set version=!version:"=!
	
	for /f "tokens=1 delims=." %%B in ("!version!") do (
		set major=%%B
		
		for /f "delims=0123456789" %%i in ("!major!") do set isNumbr=%%i
		if defined isNumbr (
			goto :UNSUPPORTED_JAVA
		)
		:: major version is smaller than required minimum major -> not compatible
		if !major!  LSS %REQUIRED_JAVA_MAJOR% (
			goto :UNSUPPORTED_JAVA
		)
		:: major version is higher than required minimum major -> compatible
		if !major!  GTR %REQUIRED_JAVA_MAJOR% (
			goto :SUPPORTED_JAVA
		)

		:: major version is equal to minimum major -> check minor
		for /f "tokens=2 delims=." %%C in ("!version!") do (
			set minor=%%C
			:: check if minor is a number
			for /f "delims=0123456789" %%i in ("!minor!") do set isNumbr=%%i
			if defined isNumbr (
				goto :UNSUPPORTED_JAVA
			)
			if !minor!  GEQ %REQUIRED_JAVA_MINOR% (
				:: minor is equal or greater than minimum required
				goto :SUPPORTED_JAVA
			) else (
				:: not compatible
				goto :UNSUPPORTED_JAVA
			)
		)		
	)	
)
:: This point is reached when the extraction of the version failed, hence execute :UNSUPPORTED_JAVA next

:UNSUPPORTED_JAVA
:: is a java version < 1.8
if %VERBOSE_OUTPUT% == 1 (
	echo You are using %VERSIONSTRING% but version %REQUIRED_JAVA_MAJOR%.%REQUIRED_JAVA_MINOR% is required.
	echo Please set your JAVA_HOME variable to a JDK with version %REQUIRED_JAVA_MAJOR%.%REQUIRED_JAVA_MINOR%.
)
goto :eof

:SUPPORTED_JAVA
:: is a java version >= 1.8
if %VERBOSE_OUTPUT% == 1 (
	echo Java version is compatible.
)
set FOUND_JAVA_HOME=!JH!
goto :eof

:FINISHED
if %VERBOSE_OUTPUT% == 1 (
	echo.
)
if !FOUND_JAVA_HOME! == 0 (
	echo ERROR: No Java found
	echo Please set your JAVA_HOME variable to a JDK with version higher or equal to %REQUIRED_JAVA_MAJOR%.%REQUIRED_JAVA_MINOR% 
	:: Return JNF (Java Not Found) code to calling script
	echo JNF
	exit /B 1
) else (
	set JAVA_HOME=!FOUND_JAVA_HOME!
	echo local JAVA_HOME was set to: 
	echo !JAVA_HOME!
	exit /B 0
)
endlocal

