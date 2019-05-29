[![N|Solid](https://assets.dynatrace.com/content/dam/dynatrace/misc/dynatrace_web.png)](https://dynatrace.com)

# Dynatrace Cordova Plugin

This plugin gives you the ability to use the Dynatrace instrumentation in your hybrid application (Cordova, Ionic, ..). It uses the Mobile Agent and the JavaScript Agent. The Mobile Agent will give you all device specific values containing lifecycle information and the JavaScript Agent will allow you to manually instrument your JavaScript/TypeScript code out of the box (Typescript definitions included). The JavaScript Agent will cover the network calls (depending on your used libraries) and will automatically detect them.

## Requirements

* For Linux users: Bash (Only a requirement if you are using Linux)
* For Android users: Minimum SDK version 15
* For iOS users: Minimum iOS 6
* For JSAgent: access to API of cluster

## Table of Contents

* [Installation of the plugin](#pluginVersion)
* [Configuration with Dynatrace](#installationDynatrace)
* [Configuration with AppMon](#installationAppMon)
* [General - Properties](#generalProperties)
* [Native - Properties](#nativeProperties)
* [JavaScript Agent - Properties](#jsagentProperties)
* [Configuration - Credentials](#configurationCredentials)
* [Manual Instrumentation - JavaScript Agent](#usageJsAgent)
* [Manual Instrumentation - Mobile Agent](#usageMobileAgent)
* [Make A Build](#makeABuild)
	* [Android build output](#androidBuildOutput)
* [Custom directories](#customDirectories)
* [Official documentation](#documentation)
* [Troubleshooting and current restrictions](#trouble)
* [Changelog](#changelog)

## <a name="pluginVersion"></a>Installation of the plugin

To install the plugin in your Cordova based project you must enter the following command in the root directory of your cordova based project. E.g. :

```
cordova plugin add dynatrace-cordova-plugin --save
```

This will always download the latest version of the plugin.

The old version of the plugin didnt have any versioning as it downloaded the Mobile Agent on the fly. This has been changed now since update scripts are very inconvenient and Cordova plugins were not designed that way.

Now the version can be used like any other npm package. You just have to use the @ sign if you want to specify a certain version:

```
cordova plugin add dynatrace-cordova-plugin@7.0.6-1002 --save
```

The version in front (e.g. 7.0.6) is the version of the Mobile agent which is directly bundled with the plugin. The number at the end (1002) represents the build number, in this case the second build. This number will rise when we fix something in the plugin.

## <a name="installationDynatrace"></a>Configuration with Dynatrace

The plugin can be used with both Dynatrace or AppMon, but in this section it will be explained how to use it with Dynatrace (If you are using AppMon then click [here](#installationAppMon)). 

If you want to instrument your Cordova application just go to your Dynatrace WebUI and select the menu point "Deploy Dynatrace". Choose to setup mobile monitoring and select Cordova. Afterwards it is possible for you to add the Web part (JSAgent) automatically and download the dynatrace.config file.
 
This file should be place in the *root of your project* (same place where the *config.xml* is stored). If the file is not available the instrumentation will not work. Be aware that a lot of values are containing a placeholder like *Application ID* where you must enter your Dynatrace data.

Example of a dynatrace.config file:

```
<GENERAL>
	<AUTO_UPDATE>true</AUTO_UPDATE>
</GENERAL>

<NATIVEAGENT>
	<DTXApplicationID>Application ID</DTXApplicationID>
	<DTXBeaconURL>Beacon Url</DTXBeaconURL>
	<DTXHybridApplication>true</DTXHybridApplication>
	<platform name="android">
		<DTXLogLevel>debug</DTXLogLevel>
	</platform>
	<platform name="ios">
		<DTXLogLevel>ALL</DTXLogLevel>
	</platform>
</NATIVEAGENT>

<JSAGENT>
	<!-- IMPORTANT TO USE jsInlineScript URL -->
	<url>https://XXX.com/api/v1/rum/jsInlineScript/APPLICATION-XXXXX?Api-Token=YOUR_TOKEN</url>
	<apitoken>..</apitoken>
</JSAGENT>
```

In this example there are 3 different properties configured for the Mobile Agent (Native Agent). All properties which are available in the Mobile Agent can be used in the *\<NATIVEAGENT\>* tag. You can find all the available properties in the documentation of the mobile agent, see the [documentation](#documentation).

The properties *DTXLogLevel*, *DTXBeaconURL* and *DTXApplicationId* are defined as global properties (not within platform tag) and will therefore be applied to both platforms (Android and iOS). The property *DTXHybridApplication* is only set for the Android platform and will only be applied there. iOS will not be affected by *DTXHybridApplication*. In general, all properties which are defined in a platform tag are overriding a duplicate global value. If for example *DTXApplicationId* is defined as a global property as well as an Android platform property, always the platform property will have a higher priority. 

After this the configuration is finished, you can skip to the section: "Make a Build".

## <a name="installationAppMon"></a>Configuration with AppMon

The plugin can be used with both Dynatrace or AppMon, but in this section it will be explained how to use it with AppMon (If you are using Dynatrace then skip to the next chapter). This is a sample configuration for AppMon which you must insert in a file called *dynatrace.config*. This file name can not be changed. This file should be place in the *root of your project* (same place where the *config.xml* is stored). If the file is not available the instrumentation will not work. Be aware that a lot of values are containing a placeholder like *http://agent.startup.path.com:PORT/* where you must enter your AppMon data.

```
<GENERAL>
	<AUTO_UPDATE>true</AUTO_UPDATE>
</GENERAL>

<NATIVEAGENT>
	<DTXAgentStartupPath>http://agent.startup.path.com:PORT/</DTXAgentStartupPath>
	<DTXApplicationID>Application ID</DTXApplicationID>
	<DTXHybridApplication>true</DTXHybridApplication>
	<platform name="android">
		<DTXLogLevel>debug</DTXLogLevel>
	</platform>
	<platform name="ios">
		<DTXLogLevel>ALL</DTXLogLevel>
	</platform>
</NATIVEAGENT>

<JSAGENT>
	<url>http://url.com:PORT/</url>
	<appName>Application Name</appName>
	<profile>Profile Name</profile>
	<username>..</username>
	<password>..</password>
</JSAGENT>
```

Basically the *DTXAgentStartupPath* is making the difference, because this property is only needed by AppMon. The script knows now that you want to use AppMon and will search for the AppMon configuration in the JavaScript Agent tag (*\<JSAGENT\>*). All properties which are available in the Mobile Agent can be used in the *\<NATIVEAGENT\>* tag. You can find all the available properties in the documentation of the mobile agent, see the [documentation](#documentation).

In this example there are 4 different properties configured for the Mobile Agent (native agent). The 3 properties *DTXLogLevel*, *DTXAgentStartupPath* and *DTXApplicationId* are defined as global properties (not within platform tag) and will therefore be applied to both platforms (Android and iOS). The property *DTXHybridApplication* is only set for the Android platform and will only be applied there. iOS will not be affected by *DTXHybridApplication*. In general, all properties which are defined in a platform tag are overriding a duplicate global value. If for example *DTXApplicationId* is defined as a global property as well as an Android platform property, always the platform property will have a higher priority. 

The properties *DTXAgentStartupPath* and *DTXApplicationId* are the minimum requirement if you want to configure the Mobile Agent for AppMon. If one of those two is not available, an instrumentation with the Mobile Agent will fail.

The JavaScript Agent tag contains the settings for downloading the JavaScript Agent. The url in the JSAGENT tag should be filled with the url and port of your AppmonServer where the REST API can be accessed. To check if http://url.com:PORT/ is correct, the following link  should show you the documentation for the REST API:

```
http://url.com:PORT/api-docs/current/index.html
```

From the values in the JSAGENT tag we will construct a url which looks like this:

```
http://url.com:PORT/profiles/Your_Profile_Name/applications/Your_Application_Name/javascriptagent/initcode
```

All of these settings can be separated in an extra file outside the *dynatrace.config* (See Section: Configuration - Credentials). The JavaScript Agent should additionally be configured at the server to show web requests correctly. Under "System Profile" you will find a menu point called "User Experience". Select the correct application and activate the AngularJS feature for the JavaScript Agent. Additionally, you must configure the Agent location and the Monitor request path.

After this the configuration is finished, you can skip to the section: "Make a Build".

## <a name="generalProperties"></a>General - Properties

The general settings contains the *AUTO_UPDATE* property. If you set this to false, the JS Agent will not make an update, even if there is a newer configuration. 

Additionally there is flag for updating the CSP (Content Security Policy). By default this is turned on and the plugin will modify the CSP to allow connections to the Dynatrace/AppMon server. If you don't like this option, just add into the <GENERAL> tag:

```
<UPDATE_CSP>false</UPDATE_CSP>
```

## <a name="nativeProperties"></a>Native - Properties

The native settings contain all the properties which are necessary for the Mobile Agent(s). You can find all the available properties in the documentation of the mobile agent, see the [documentation](#documentation).

Here we list the properties which are especially important if you are instrumenting a Hybrid application.

* *DTXHybridApplication* : Set to `true` if you have a Hybrid application. The default value is `false`.

```
<DTXHybridApplication>true</DTXHybridApplication>
```

* *DTXSetCookiesForDomain* : For hybrid applications using the JavaScript agent, cookies need to be set for each instrumented domain or server the application communicates with. You can specify domains, host or IP addresses. Domains or sub-domains must start with a dot. Separate the list elements with a comma.

```
<DTXSetCookiesForDomain>dynatrace.com,dynatrace.at</DTXSetCookiesForDomain>
```

## <a name="jsagentProperties"></a>JavaScript Agent - Properties

Basically all properties for the JSAgent are given by the Dynatrace WebUI. Those are url and token. In AppMon you need to do this configuration yourself. As seen in the [configuration part](#installationAppMon) you need to define url, appName, profile, user and password for AppMon. Be aware that you can exclude those configs into a seperate file, this is explained in the [next section](#configurationCredentials).

### <a name="allowanycert"></a>Allow Any Certificate

If you have got an issue with downloading the JSAgent and see an error messages with a certificate issue like this:

```
Could not download the JSAgent! - Could not download agent optionsError: unable to verify the first certificate
```

You are able to bypass those errors at your **OWN RISK** by using `<allowanycert>true</allowanycert>` within the `<JSAgent>` tag. This will ignore the fact that the SSL connection is not secure (e.g. because of invalid certificate) and will download the JSAgent anyways.

## <a name="configurationCredentials"></a>Configuration - Credentials

If you don't want to enter credentials in the *dynatrace.config* there is another way provided by the plugin. Just copy everything within the JavaScript Agent tag including the JavaScript Agent tag (\<JSAGENT\>) to a file called *dynatrace.credentials*. This file should be stored in the root of the project (same place where the *dynatrace.config* is stored). The credentials will be taken from this file by the configuration script. This file can be easily added to a .gitignore. Therefore, no credentials will ever be committed.

## <a name="usageJsAgent"></a>Manual Instrumentation - JavaScript Agent

The JavaScript Agent interface will be provided by the JavaScript Agent, so it can be used everywhere in your application by simply calling *dynaTrace* (Or if you use AppMon you need to use *dtrum*.). A possible call might be:

```
// Dynatrace
dynaTrace.enterAction(..);

// AppMon
dtrum.enterAction(..);
```

This gives you the possibility to instrument your code even further by manual instrumentation. If you like to know more about the manual instrumentation have a look into the Dynatrace [documentation](#documentation). It is also possible to look into the definition file (described below) to see the API documentation.

To use the interface of the JavaScript Agent directly you must specify the typing definition file in the *tsconfig.json*. Add the following block to the *tsconfig.json*: 

```
"files": ["plugins/dynatrace-cordova-plugin/typings/main.d.ts"] 
```

If "files" is already defined, just add the path to the already defined ones.

## <a name="usageMobileAgent"></a>Manual Instrumentation - Mobile Agent

In a hybrid scenario it is only possible for the mobile agent to end a session/visit. That's why we expose the endVisit function of the Mobile Agent. 

The interface is available with the name *dynatraceMobile* (TypeScript definitions included). Calling *dynatraceMobile.endVisit(successCallback, errorCallback)* will end the session/visit. Example how this call looks like:

```
dynatraceMobile.endVisit(() => {
	// Success
	console.log("Visit was ended!");
}, () => {
	// Error
	console.log("Visit wasn't ended!");
});
```

## <a name="makeABuild"></a>Make a build

After starting the Cordova or Ionic build, with *cordova build android* the instrumentation will be handled by the plugin. Of course *android* can be substitued with any other platform. Of course you can also use *cordova run android*.

### <a name="androidBuildOutput"></a>Android build output

The final message of the Android build might look similiar to this:

```
Original: "C:\AndroidBuildFolder\outputs\apk\debug\app-debug.apk"

Instrumented: C:\AndroidBuildFolder\outputs\apk\debug\app-debug\dist\app-debug.apk

Instrumented and zipaligned: C:\AndroidBuildFolder\outputs\apk\debug\app-debug\dist\app-debug-zipaligned.apk

Instrumented, signed and zipaligned: C:\AndroidBuildFolder\outputs\apk\debug\app-debug\dist\app-debug-final.apk
```

The original file will always be overwritten with instrumented version after the instrumentation finishes. This happens in order to be able to directly run the instrumented application with *ionic cordova run android*.

The overwrite happens depending on the filename. Should the filename contain the keyword *unsigned*, the plugin will overwrite the original file with the unsigned & instrumented one. In any other way the plugin will use the instrumented, signed & zipaligned one.

## <a name="customDirectories"></a>Settings for custom directories

If you don't use a "src" or "www" folder and have your own project structure the plugin will fail to instrument. To prevent this behavior you can add in the package.json several properties. There are three properties available: *custom_src_dir*, *custom_www_dir*, *custom_html_file*. The custom html file path should be configured relative from the source directory path. 

## <a name="documentation"></a>Official documentation

Please look into the platform you want to instrument. Both platforms have different requirements. Also pay attention if you use Dynatrace Appmon or Dynatrace Saas/Managed, they mostly need different configurations.

  - Mobile Agent: https://www.dynatrace.com/support/doc/appmon/user-experience-management/mobile-uem/
  - Hybrid Instrumentation: https://www.dynatrace.com/support/doc/appmon/user-experience-management/mobile-uem/how-to-instrument-a-hybrid-app/
  - JavaScript Agent Interface:
  https://www.dynatrace.com/support/doc/appmon/integrations-and-extensions/development-kits/javascript-adk-and-javascript-ajax-adk/

## <a name="trouble"></a>Troubleshooting and current restrictions:

Basically if you have problems with the plugin please have a look into the logs. They will tell you what went wrong. The logs can be found in the plugins folder of your Cordova project. There is a directory called "Logs". 

* Settings for custom directories might not work in combination with Ionic, because we saw cases where Ionic is simply ignoring those individual settings
* If the build fails because of a message like "This APK contains the Dynatrace OneAgent (Android) but probably incorrectly obfuscated" then obfuscation is in use. Please exclude the Dynatrace.jar from obfuscation.
* If you see a message like "Error: Could not download agent file: Error: self signed certificate in certificate chain" try to switch the JSAgent configuration from HTTPS to HTTP.
* If you use live reload (e.g. ionic cordova run android -l) be aware that Ionic/Cordova doesn't use files from the platform folder, so the JavaScript Agent injection will not take place, as we only instrument the temporary platform folder. You are still able to add the dtAgent.js manually by adding *&lt;script src="assets/dtAgent.js">* to your index.html (in the source directory). Auto-Instrumentation with the Mobile Agent still takes place.
* If you have problems downloading the JSAgent and you get error messages that the JSAgent can not be downloaded you probably don't have access to the API or there is a certificate issue. If this is the certificate use the [allowanycert feature](#allowanycert). In any other case a workaround is possible to change AUTO_UPDATE to false (in dynatrace.config) and download the full Javascript Agent and copy it to files/dtAgent.js - With this the plugin will not download a new agent and will use the one that is in the files folder.

## <a name="changelog"></a>Changelog

7.2.4
* Fixed endVisit call for older OS versions
* Feature for ignoring certificate when downloading JSAgent
* Fixed inserting JSAgent into minified HTML
* Fixed internal cookies for WKWebView
* Correctly insert JSAgent for Ionic 4 application
* Build considers now if APK is unsigned or not

7.2.3
* Added EndVisit support - dynatraceMobile.endVisit()
* Improved instrumentation of CookieManager in Android

7.2.2
* Fixed Unsupported Schema Log Spam in iOS

7.2.1
* Fixed build for browser platform
* Improved web request instrumentation for applications using the IBM MobileFirst Platform
* Changed communication between JSAgent and Mobile Agent for better correlation
* JavaScript Agent API replaced the JavaScript Native Bridge (Android minSDK Level is back to 15)
* Removed support for Crosswalk as the framework is deprecated
