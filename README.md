[![N|Solid](https://assets.dynatrace.com/content/dam/dynatrace/misc/dynatrace_web.png)](https://dynatrace.com)

# Dynatrace Cordova Plugin

This plugin gives you the ability to use the Dynatrace instrumentation in your hybrid application (Cordova, Ionic, ..). It uses the Mobile Agent, the JavaScript Agent and the Javascript Bridge. The Mobile Agent will give you all device specific values containing lifecycle information and the Javascript Bridge will allow you to manually instrument your JavaScript/TypeScript code out of the box (Typescript definitions included). The JavaScript Agent will cover the network calls and will automatically detect them.

## Requirements

* Bash (on Linux)

## Table of Contents

* [Installation for AppMon](#installationAppMon)
* [Installation for Dynatrace](#installationDynatrace)
* [General - Properties](#generalProperties)
* [Configuration - Credentials](#configurationCredentials)
* [Usage - JavaScript Bridge](#usageJsBridge)
* [Usage - Mobile Agent](#usageMobileAgent)
* [Make A Build](#makeABuild)
* [Custom Directories](#customDirectories)
* [Official Documentation](#documentation)
* [Troubleshooting & Current Restrictions](#trouble)

## <a name="installationAppMon"></a>Installation for AppMon

To install the plugin in your Cordova based project you must enter the following command in the root directory of your cordova project. 

```
ionic cordova plugin add dynatrace-cordova-plugin --save
```

The plugin can be used with both Dynatrace or AppMon, but in this section it will be explained how to use it with AppMon (If you are using Dynatrace then skip to the next chapter). This is a sample configuration for AppMon which you must insert in a file called *dynatrace.config*. This file name can not be changed. This file should be place in the *root of your project* (same place where the *config.xml* is stored). If the file is not available the instrumentation will not work. Be aware that a lot of values are containing a placeholder like *http://agent.startup.path.com:PORT/* where you must enter your AppMon data.

```
<GENERAL>
	<AUTO_UPDATE>true</AUTO_UPDATE>
</GENERAL>

<NATIVEAGENT>
	<DTXLogLevel>debug</DTXLogLevel>
	<DTXAgentStartupPath>http://agent.startup.path.com:PORT/</DTXAgentStartupPath>
	<DTXApplicationID>Application ID</DTXApplicationID>
	
	<platform name="android">
		<DTXAllowFileCookies>true</DTXAllowFileCookies>
	</platform>
	<platform name="ios">
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

In this example there are 4 different properties configured for the Mobile Agent (native agent). The 3 properties *DTXLogLevel*, *DTXAgentStartupPath* and *DTXApplicationId* are defined as global properties (not within platform tag) and will therefore be applied to both platforms (Android and iOS). The property *DTXAllowFileCookies* is only set for the Android platform and will only be applied there. iOS will not be affected by *DTXAllowFileCookies*. In general, all properties which are defined in a platform tag are overriding a duplicate global value. If for example *DTXApplicationId* is defined as a global property as well as an Android platform property, always the platform property will have a higher priority. 

The properties *DTXAgentStartupPath* and *DTXApplicationId* are the minimum requirement if you want to configure the Mobile Agent for AppMon. If one of those two is not available, an instrumentation with the Mobile Agent will fail.

The JavaScript Agent tag contains the settings for downloading the JavaScript Agent. All of these settings can be separated in an extra file outside the *dynatrace.config* (See Section: Configuration - Credentials). The JavaScript Agent should additionally be configured at the server to show web requests correctly. Under "System Profile" you will find a menu point called "User Experience". Select the correct application and activate the AngularJS feature for the JavaScript Agent. Additionally, you must configure the Agent location and the Monitor request path.

After this the configuration is finished, you can skip to the section: "Make a Build".

## <a name="installationDynatrace"></a>Installation for Dynatrace

To install the plugin in your Cordova based project you must enter the following command in the root directory of your cordova project. 

```
ionic cordova plugin add dynatrace-cordova-plugin --save
```

The plugin can be used with both Dynatrace or AppMon, but in this section it will be explained how to use it with Dynatrace (If you are using AppMon then read the previous chapter). This is a sample configuration for Dynatrace which you must insert in a file called *dynatrace.config*. This file name can not be changed. This file should be place in the *root of your project* (same place where the *config.xml* is stored). If the file is not available the instrumentation will not work. Be aware that a lot of values are containing a placeholder like *Application ID* where you must enter your Dynatrace data.

```
<GENERAL>
	<AUTO_UPDATE>true</AUTO_UPDATE>
</GENERAL>

<NATIVEAGENT>
	<DTXLogLevel>debug</DTXLogLevel>
	<DTXApplicationID>Application ID</DTXApplicationID>
	<DTXAgentEnvironment>Agent Environment</DTXAgentEnvironment>
	
	<platform name="android">
		<DTXAllowFileCookies>true</DTXAllowFileCookies>
	</platform>
	<platform name="ios">
	</platform>
</NATIVEAGENT>

<JSAGENT>
	<!-- Dynatrace -->
	<url>https://XXX.com/api/v1/rum/jsInlineScript/APPLICATION-XXXXX?Api-Token=YOUR_TOKEN</url>
	<apitoken>..</apitoken>
</JSAGENT>
```

In this example there are 3 different properties configured for the Mobile Agent (Native Agent). All properties which are available in the Mobile Agent can be used in the *\<NATIVEAGENT\>* tag. You can find all the available properties in the documentation of the mobile agent, see the [documentation](#documentation).

The 2 properties *DTXLogLevel* and *DTXApplicationId* are defined as global properties (not within platform tag) and will therefore be applied to both platforms (Android and iOS). The property *DTXAllowFileCookies* is only set for the Android platform and will only be applied there. iOS will not be affected by *DTXAllowFileCookies*. In general, all properties which are defined in a platform tag are overriding a duplicate global value. If for example *DTXApplicationId* is defined as a global property as well as an Android platform property, always the platform property will have a higher priority. 

The detailed settings for your application can be seen within the mobile application in the Dynatrace UI. Go to your mobile application settings and click on "Instrumentation". Under Google Android / Auto-Instrumentor or Apple iOS / Cocoapods you will find the properties which are mandatory within the *\<NATIVEAGENT\>* tag. 

The properties *DTXApplicationId* and *DTXAgentEnvironment* are the minimum requirement if you want to configure the Mobile Agent for Dyntrace. If one of those two is not available, an instrumentation with the Mobile Agent will fail. 

The JavaScript Agent tag includes the dynatrace properties like url and api token. Currently in Dynatrace the hybrid application consit of a mobile application and a web application. They are separated applications. (This will change in the future.) So you must create a web application (to get the JavaScript Agent) and a mobile application (to get the configuration for the Mobile Agent). In order to get the web request correctly you must additionally configure the JavaScript Agent within Dynatrace. Go to the Settings of your WebApplication and select "XHR (Ajax) detection". Within the "XHR (Ajax) detection" menu activate the AngularJS framework.

You can find the url for your web application in the setup menu point of your web application settings. There is a headline called "Rest API". If you click "More" you see "Gets the inline JavaScript code for an application:" Take this url (including the YOUR_TOKEN). The API token can be generated in the settings of Dynatrace.

After this the configuration is finished, you can skip to the section: "Make a Build".

## <a name="generalProperties"></a>General - Properties

The general settings contains the *AUTO_UPDATE* property. If you set this to false, the JS Agent will not make an update, even if there is a newer configuration. 

## <a name="configurationCredentials"></a>Configuration - Credentials

If you don't want to enter credentials in the *dynatrace.config* there is another way provided by the plugin. Just copy everything within the JavaScript Agent tag including the JavaScript Agent tag (\<JSAGENT\>) to a file called *dynatrace.credentials*. This file should be stored in the root of the project (same place where the *dynatrace.config* is stored). The credentials will be taken from this file by the configuration script. This file can be easily added to a .gitignore. Therefore, no credentials will ever be committed.

## <a name="usageJsBridge"></a>Usage - JavaScript Bridge

The JavaScript Bridge will be added by the plugin to the window object, so it can be used everywhere in your application by simply calling *DynatraceJSBridge*. A possible call might be *DynatraceJSBridge.enterAction("..");*. This gives you the possibility to instrument your code even further by manual instrumentation. If you like to know more about the manual instrumentation have a look into the Dynatrace [documentation](#documentation). To use the *DynatraceJSBridge* directly you must specify the typing definition file in the *tsconfig.json*. Add the following block to the *tsconfig.json*: 

```
"files": ["plugins/dynatrace-cordova-plugin/typings/Dynatrace.d.ts"] 
```

If "files" is already defined, just add the path to the already defined ones.

## <a name="usageMobileAgent"></a>Usage - Mobile Agent

Basically, you should always trigger every custom action and event over the JavaScript Bridge. But if you want to know for example if the Mobile Agent is really capturing and is not turned off you can use the window object *DynatraceMobile* (TypeScript definitions included). Calling *DynatraceMobile.getCaptureStatus(successCallback, errorCallback)* will return the *CaptureStatus*. A return value of 2 means the Mobile Agent is capturing the data and everything is okay.

## <a name="makeABuild"></a>Make a Build

After starting the Cordova or Ionic build, with *cordova build android* or *ionic build android* the instrumentation will be handled by the plugin.

## <a name="customDirectories"></a>Settings for Custom Directories

If you don't use a "src" or "www" folder and have your own project structure the plugin will fail to instrument. To prevent this behavior you can add in the package.json several properties. There are three properties available: *custom_src_dir*, *custom_www_dir*, *ionic_app_entry*. The app entry point path should be configured without the source directory path (because it is included usually in the src path). 

## <a name="documentation"></a>Official Documentation

Please look into the platform you want to instrument. Both platforms have different requirements. Also pay attention if you use Dynatrace Appmon or Dynatrace Saas/Managed, they mostly need different configurations.

  - Mobile Agent: https://www.dynatrace.com/support/doc/appmon/user-experience-management/mobile-uem/
  - Hybrid Instrumentation: https://www.dynatrace.com/support/doc/appmon/user-experience-management/mobile-uem/how-to-instrument-a-hybrid-app/

## <a name="trouble"></a>Troubleshooting & Current Restrictions:

Basically if you have problems with the plugin please have a look into the logs. They will tell you what went wrong. The logs can be found in the plugins folder of your Cordova project. There is a directory called "Logs". Please open an issue on GitHub if you found a bug.

* Do not use Cordova Run as it is triggering a new build and overwritting the instrumented apk. (only for Android)
* The Javascript Bridge is currently not updated because the version used in this plugin is currently not published. (Update will be turned on if it is published)
* Dynatrace UI is currently separating the instrumentation reports in a web application and a mobile application
* Settings for custom directories might not work in combination with Ionic, because we saw cases where Ionic is simply ignoring those individual settings
* If the build fails because of a message like "This APK contains the Dynatrace OneAgent (Android) but probably incorrectly obfuscated" then obfuscation is in use. Please exclude the Dynatrace.jar from obfuscation.




