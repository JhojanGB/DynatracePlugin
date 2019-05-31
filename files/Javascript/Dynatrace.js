//
//  Dynatrace.js
//  Version: 1
//
//
// These materials contain confidential information and
// trade secrets of Dynatrace Corporation. You shall
// maintain the materials as confidential and shall not
// disclose its contents to any third party except as may
// be required by law or regulation. Use, disclosure,
// or reproduction is prohibited without the prior express
// written permission of Dynatrace Corporation.
//
// All Dynatrace products listed within the materials are
// trademarks of Dynatrace Corporation. All other company
// or product names are trademarks of their respective owners.
//
// Copyright (c) 2012-2017 Dynatrace LLC. All rights reserved.
//
//
var context = window;
// Create a debug namespace for public functions
context.DTXAgentDebug = (function() {

    // Private variables for this namespace
    var DEBUG = 0;          // Debugging is off by default

    // Public functions for this namespace
    // These functions should be called by the
    // Users app to set JS/Native bridge debugging on/off
    return {
        debugOn: function() {
            DEBUG = 1;
        },
        debugOff: function() {
            DEBUG = 0;
        },
        getDebug: function() {
            return DEBUG;
        }
    };
})();

// Create a namespace for our ADK JS Bridge internal functions
context.DTXAgentJSBridge = (function() {

    // Private variables for this namespace
    var iOSStatusRc = 0;    // iOS ADK status return code
    var iOSServerId = -1;   // iOS serverId
    var iOSMsgQueue = [];   // An array to hold request messages for iOS
    var _asyncCacheId = 1;
    var _asyncCache = {}; // open messagecache;

    // Public functions for this namespace
    return {

        isPromise: function(val) {
          return val instanceof Promise;
        },

        // WKWebView async handling
        createAsyncId: function() {
          _asyncCacheId = _asyncCacheId+1;
          return ""+_asyncCacheId;
        },

        asyncResultHandler:function (result) {
            if(_asyncCache && _asyncCache[result.id]) { // check the cache
                var cacheEntry = _asyncCache[result.id];
                _asyncCache[result.id] = null; // remove the cache entry
                if(!cacheEntry.resolve || !cacheEntry.reject) {
                  return {res:false,error:"Entry has no promise callbacks"};
                }
                if(result.err && result.err !== "" ) {
                    cacheEntry.reject(result.err);
                    return {res:true};
                }
                if(cacheEntry.validator) {
                  try {
                    cacheEntry.validator(result.data);
                  }
                  catch(ex) {
                    cacheEntry.reject(ex);
                    return {res:true,error:"Validator rejected data"};
                  }
                }
                cacheEntry.resolve(result.data);
                return {res:true};
            }
            return {res:false,error:"No entry in message cache"};
        },

        createMessageHandlerPromise:function (id,validator) {
          var cID = id;
          var cValidator = validator;
          var promise = new Promise(function(res,rej) {
              //register the message in the cache
              _asyncCache[cID] = {id:cID,resolve:res,reject:rej,validator:cValidator};
          });
          return promise;
        },

        // UIWebView handling
        // These functions are to be used by the ADK only
        iOSMsgQueueLength: function() {
            return iOSMsgQueue.length;
        },
        firstiOSMsgQueueItem: function() {
            var len = iOSMsgQueue.length - 1;
            var message = iOSMsgQueue[len];
            iOSMsgQueue.splice(len, 1);
            return message;
        },
        spliceiOSMsgQueue: function(key, elems) {
            var msg = "";
            if(elems) {
              msg = elems.join(","); // join the elements to the a parameter string
            }
            iOSMsgQueue.splice(0, 0, key + "##" + msg);
        },
        setiOSStatusRc: function(str) {
            // set the iOSStatusRc global variable
            // called from the iOS Native Agent
            iOSStatusRc = str;
        },
        getiOSStatusRc: function() {
            // get the iOSStatusRc global variable
            return iOSStatusRc;
        },
        setIOSServerId:function(srvId){
            // set the iOSServerId global variable
            // salled from the iOS Native Agent
            iOSServerId = srvId;
        },
        getIOSServerId: function() {
            // get the iOSServerId global variable
            return iOSServerId;
        }
        
    };
})();

// This is the main JS/Native bridge object.
// Users should call the public functions from
// their native application's JS code
context.Dynatrace = function() {
    // Private variables
    var deviceType = null;	// Android, iOS, etc.
    var iOSActionId = 0;    // iOS ADK action Id
    var retPromise = false; // use Promises as return. needed to support webkit
    var serverUpdateIntervalId = false;
    // Private functions
    function wrapReturn(value) {
      if(retPromise) {
        return new Promise(function(resolve,reject){resolve(value);});
      }
      return value;
    }

    function setDeviceType() {
        // Determines the type of device being used.
        // Android and iOS are the only two types supported now.

        if (deviceType == null) {
          try {
            if (navigator.userAgent.toLowerCase().indexOf("android") > -1) {
              deviceType = "android";
            }
            else {
              deviceType = "iOS";
              // check for webkit handler
              if(window && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.DTXAgent) {
                deviceType = "iOS#webkit";
              }
            }
          }
          catch(e) {
            errorMsg(e);
          }
        }

        // The navigator does not exist ... try again specifically when running with Kony based application
        if (deviceType == null) {
          try {
            deviceType = kony.string.trim("" + kony.os.deviceInfo().name);	// returns "android" if Android
          }
          catch(e) {
            errorMsg(e);
          }
        }
        return deviceType;
    }

    context.Dynatrace.prototype.usePromise = function(val) {
      return retPromise = val;
    };

    function isAndroid() {
        // Determines if the device type is Android
        if (deviceType == null) {
            setDeviceType();
        }
        return (deviceType == "android");
    }

    function errorMsg(e) {
      if(console) {
        console.log(e);
      }
      if(ADKDebug && ADKDebug.getDebug()) {
        alert(e);
      }
    }

    function createErrorMsg(funcName, rc) {
      return "DTXAgentJS Error in JS function: " + funcName + ", return code = " + rc;
    }

    function performRcCheck(funcName, rc) {
      var cFuncName = funcName;
      if(DTXAgentJSBridge.isPromise(rc)) {
        return rc.then(function (rcVal) {
          if(!DTXAgentJSBridge.isPromise(rcVal)) { // check rcVal is not a promise
            performRcCheck(cFuncName,rcVal);
          }
          return rcVal;
        });
      }
      else {
        // If the return code is an error (i.e. less than 2), throw an exception
        // check the rc!
        if(rc < 2) {
          throw(createErrorMsg(cFuncName,rc));
        }
      }
      return rc;
    }

    function iOSWebkit() {
      if (deviceType == null) {
          setDeviceType();
      }
      return (deviceType == "iOS#webkit");
    }

    function DTXiOSAgent(_key, _elems,customValidator) {
        if(iOSWebkit()) {
          var newID = DTXAgentJSBridge.createAsyncId(); // create a new id for async communicatoin
          var newHandler = DTXAgentJSBridge.createMessageHandlerPromise(newID,customValidator); // create the result promise
          var  promise =  Promise(function(resolve,reject) {
            try {
              window.webkit.messageHandlers.DTXAgent.postMessage({id:newID, key:_key, data:_elems});
              resolve(true);
            }
            catch(ex) {
                reject(ex);
            }
          }).then(function(val) {
            return newHandler;
          });

          if(retPromise) {
            return promise; // return should be async (change to promise)
          }
          return -3;	// not supported must be in promise mode!!!!
        }


        // This function creates a dummy iFrame and then removes it.
        // It will cause the iOS Objective-C shouldStartLoadWithRequest webView
        // delegate method to fire, passing the Value from the js setAttribute function
        // through the NSURLRequest parameter. We intercept the request parameter and
        // then cancel the shouldStartLoadWithRequest method so as not to fully execute it.
        //
        // We could also do this via the js function: window.location = "dtx:" + _key + ":##DTXiOSAgent##" + _msg"
        // But it has some nasty side effects such as:
        // - All setInterval and setTimeout calls immediatly stop on location change
        // - Every innerHTML won't work after a canceled location change
        // - If sequential window.location calls are made quickly, there may be a timing problem (iFrames are asynchronous)
        DTXAgentJSBridge.setiOSStatusRc(0);

        // To prevent losing messages, add it to an array and have Objective-C retrieve them
        DTXAgentJSBridge.spliceiOSMsgQueue(_key, _elems);
        var iframe = document.createElement("IFRAME");
        iframe.setAttribute("src", "uem:##DTXiOSAgent##");
        document.documentElement.appendChild(iframe);
        iframe.parentNode.removeChild(iframe);
        iframe = null;
        // Pass back the return code from the native side
        var rc = DTXAgentJSBridge.getiOSStatusRc();
        return rc;
    }

    // Public functions that can be called by a native app's JS code
    context.Dynatrace.prototype.flushEvents = function() {
        // Send all collected events immediately from Javascript.
        // To reduce network traffic/usage the collected events are usually sent in packages where the oldest
        // event has an age of up to 9 minutes. Using this method you can force sending of all collected
        // events regardless of their age.

        var rc = -1;
        try {
            if (isAndroid()) {
                DTXAndroidAgent.flushEvents();
                rc = 2;
            }
            else {
                rc = DTXiOSAgent("flushEvents", []);
            }
            rc = performRcCheck("flushEvents", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.reportErrorInteger = function(errorName, errorValue) {
        // Sends a error to dynaTrace with an error value from Javascript.

        // Because this is a class method, the error is not associated with an action.  It creates
        // its own mobile-only PurePath.

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.reportErrorInteger(errorName, errorValue);
            }
            else {
                rc = DTXiOSAgent("reportErrorWithNameErrorClass", [errorName , errorValue]);
            }
            rc = performRcCheck("reportErrorInteger",  rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.reportErrorString = function(errorName, exceptionValue)
    {
        // Sends a error to dynaTrace with an exception string value from Javascript.
        // Because this is a class method, the error is not associated with an action.  It creates
        // its own mobile-only PurePath.

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = -3;	// not supported
            }
            else {
                rc = DTXiOSAgent("reportErrorWithNameExceptionClass", [errorName , exceptionValue]);
            }
            rc = performRcCheck("reportErrorString", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    function __enterActionParentId (actionName, useParentId,parentId) {
        var actionId = 0;
        try {
            if (isAndroid()) {
                if(useParentId){
                  actionId = DTXAndroidAgent.enterAction(actionName, parentId);
                }
                else {
                  actionId = DTXAndroidAgent.enterAction(actionName);
                }
            }
            else {
                var context = useParentId?"enterActionParentId":"enterAction";
                iOSActionId++;
                actionId = iOSActionId;
                var rc = -1;
                if(useParentId) {
                  rc = DTXiOSAgent("enterActionWithNameParentId", [actionName , parentId , actionId]);
                }
                else {
                  rc = DTXiOSAgent("enterActionWithName", [actionName , actionId]);
                }

                //Promise.resolve(obj) == obj // alternative promise check
                if(DTXAgentJSBridge.isPromise(rc)) {
                    var resActionID = actionId;
                    // add check promise to result
                    actionId = rc.then(function(val) {
                      performRcCheck(context,val);
                      return resActionID;
                    }); //set the rc promise as method result;
                }
                else {
                  // not a promise
                  if(rc < 2) {
                      iOSActionId--;
                      actionId = 0;
                  }
                  // check returncode
                  performRcCheck(context, rc);
                }
            }

        }
        catch(e) {
            errorMsg(e);
            actionId = 0; // error so no action id
        }
        return wrapReturn(actionId);
    }

    context.Dynatrace.prototype.enterAction = function(actionName) {
        // Starts a top level action from Javascript. And returns an Id for the action object.

        // The top level action results in a new mobile action PurePath in dynaTrace. An action allows you
        // to time an interval in your code.  Call enterAction: at the point you want to start timing.
        // Call the leaveAction instance method on the returned object at the point you want to stop timing.
        return __enterActionParentId(actionName,false,false);
    };

    context.Dynatrace.prototype.enterActionParentId = function(actionName, parentId) {
        // Starts an action from Javascript that is a child of the parent action, and returns
        // an Id for the action object.

        // The action adds a node to an existing mobile action PurePath in dynaTrace. An action allows you
        // to time an interval in your code.  Call enterActionIdParentId: at the point you want to
        // start timing.  Call the leaveAction instance method on the returned object at the point you want
        // to stop timing.
        return __enterActionParentId(actionName,true,parentId);
    };

    context.Dynatrace.prototype.leaveAction = function(actionId) {
        // Ends an action and computes its interval from Javascript.
        // All reported events, values, and tagged web requests between start and end of an action are
        // nested in the mobile action PurePath. If this action has any child actions, they are ended
        // first. Call this method at the end of the code that you wish to time. The number of milliseconds
        // since the action began is stored as the interval.

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.leaveAction(actionId);
            }
            else {
                rc = DTXiOSAgent("leaveActionWithId", [actionId]);
            }
            rc = performRcCheck("leaveAction", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.reportEvent = function(eventName, actionId) {
        // Sends an event to dynaTrace from Javascript.
        // The error becomes a node of the mobile action PurePath.

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.reportEvent(eventName, actionId);
            }
            else {
                rc = DTXiOSAgent("reportEventWithName", [eventName , actionId]);
            }
            rc = performRcCheck("reportEvent", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.reportErrorIntegerWithAction = function(errorName, errorValue, actionId) {
        // Sends an error to dynaTrace with an error value from Javascript.
        // The error becomes a node of the mobile action PurePath.

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.reportErrorInteger(errorName, errorValue, actionId);
            }
            else {
                rc = DTXiOSAgent("reportErrorWithNameError", [errorName , errorValue , actionId]);
            }
            rc = performRcCheck("reportErrorIntegerWithAction", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.reportErrorStringWithAction = function(errorName, exceptionValue, actionId) {
        // Sends an error to dynaTrace with an exception string value from Javascript.
        // The error becomes a node of the mobile action PurePath.

        var rc = -1;
        try
        {
            if (isAndroid()) {
                rc = -3;	// not supported
            }
            else {
                rc = DTXiOSAgent("reportErrorWithNameException", [errorName , exceptionValue , actionId]);
            }
            rc = performRcCheck("reportErrorStringWithAction", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.reportValueInt = function(valueName, intValue, actionId) {
        // Sends a key/value pair to dynaTrace from Javascript.
        // The value becomes a node of the mobile action PurePath. The value can be processed by a measure and
        // thus be charted.

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.reportValueInteger(valueName, intValue, actionId);
            }
            else {
                rc = DTXiOSAgent("reportValueWithNameInt", [valueName , intValue , actionId]);
            }
            rc = performRcCheck("reportValueInt", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.reportValueDouble = function(valueName, doubleValue, actionId) {
        // Sends a key/value pair to dynaTrace from Javascript.
        // The value becomes a node of the mobile action PurePath. The value can be processed by a measure and
        // thus be charted.

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.reportValueDouble(valueName, doubleValue, actionId);
            }
            else {
                rc = DTXiOSAgent("reportValueWithNameDouble", [valueName , doubleValue , actionId]);
            }
            rc = performRcCheck("reportValueDouble", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.reportValueString = function(valueName, stringValue, actionId) {
        // Sends a key/value pair to dynaTrace from Javascript.
        // The value becomes a node of the mobile action PurePath. The value can be processed by a measure and
        // thus be charted.

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.reportValueString(valueName, stringValue, actionId);
            }
            else {
                rc = DTXiOSAgent("reportValueWithNameString", [valueName , stringValue , actionId]);
            }
            rc = performRcCheck("reportValueString", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.setGpsLocation = function(longitude, latitude) {
        // Set the current GPS location of the user from Javascript.
        // The DynatraceUEM library does not automatically collect location information.  If the
        // developer wants location information to be transmitted to dynaTrace, then this function should
        // be used to provide it.

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.setGpsLocation(longitude, latitude);
            }
            else {
                rc = DTXiOSAgent("setGpsLocation", [longitude , latitude]);
            }
            rc = performRcCheck("setGpsLocation", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };


    context.Dynatrace.prototype.lastErrorCode = function() {
        // Provides information regarding internal errors for Javascript.
        // Use this to obtain the error code associated with the most recent DTX_Error_InternalError or
        // enterAction. For the iOS ADK only

        var rc = -1;
        try {
            if (isAndroid()) {
                rc = -3;  // Not implemented in Android ADK
            }
            else {
                rc = DTXiOSAgent("lastErrorCode", []);
            }
            rc = performRcCheck("lastErrorCode", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.lastErrorMsg = function() {
        // Provides a string describing internal errors for Javascript.
        // Use this to obtain the error message associated with most recent DTX_Error_InternalError.
        // For the iOS ADK only
        var rc = -1;
        try {
            if (isAndroid()) {
                rc = -3;  // Not implemented in Android ADK
            }
            else {
                rc = DTXiOSAgent("lastErrorMsg", []);
            }
            rc = performRcCheck("lastErrorMsg", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.startTaggingRequests = function(actionId) {
        // Sends a cookie containing ADK information to the dT server
        // for the given action Id, from Javascript. In other words, start
        // grouping web requests under the given action until the action is closed´
        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.setRequestCookieForAction(actionId);
            }
            else {
                rc = DTXiOSAgent("startTaggingRequestsForActionId", [actionId]);
            }
            rc = performRcCheck("startTaggingRequests", rc);
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.getCookieForAction = function(actionId) {
      // get a cookie for the specific actionId
      var rc = 1;
      try
      {
        if (isAndroid()) {
          rc = DTXAndroidAgent.getCookieForAction(actionId);
        }
        else {
          rc = DTXiOSAgent("getCookieForActionId", [actionId]);
        }
        rc = performRcCheck("getCookieForAction", rc);
      }
      catch (e) {
        errorMsg(e);
      }
      return wrapReturn(rc);
    };

    context.Dynatrace.prototype.endVisit = function(actionId) {
      // endVisit can be called to end the current visit and start a new visit.  This
      // will flush all pending events to the dynaTrace server.
      // It can be used with or without an open actionId.

      var rc = 1;
      try {
        if (isAndroid()) {
          if (typeof actionId != "undefined") {
            rc = DTXAndroidAgent.endVisit(actionId);
          }
          else {
            rc = DTXAndroidAgent.endVisit(null);
          }
        }
        else {
          if (typeof actionId != "undefined") {
           rc = DTXiOSAgent("endVisit", [actionId]);
         }
         else {
           rc = DTXiOSAgent("endVisit", []);
         }
       }
       rc = performRcCheck("endVisit", rc);
     }
     catch (e) {
       errorMsg(e);
     }
     return wrapReturn(rc);
    };

    context.Dynatrace.prototype.tagXmlHttpRequest = function(xmlHttpReq, actionId) {
        // Tag an XMLHttpRequest object. Action ID may be null, in which case,
        // an attempt to determine the appropriate action ID is made.
        var tag = null;
        try {
            if (isAndroid()) {
                tag = DTXAndroidAgent.getRequestTag(actionId);
            }
            else {
                // not implemented
            }

            if (tag != null) {
                xmlHttpReq.setRequestHeader("x-dynatrace", tag);
            }
            else {
                errorMsg(e); //FIXME: this causes an exception e is undefined
            }
        }
        catch(e) {
            errorMsg(e);
        }
    };

    // dtPC + serverID API
    context.Dynatrace.prototype.setDtPc = function(dtPC) {
        var rc = true;
        try {
            if (isAndroid()) {
                DTXAndroidAgent.setDtPc(dtPC);
            }
            else {
                DTXiOSAgent("setDtPc", [dtPc]);
            }
        }
        catch(e) {
           errorMsg(e);
           rc = false;
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.getServerId = function() {
        var rc = -1;
        try {
            if (isAndroid()) {
                rc = DTXAndroidAgent.getServerID();
            }
            else {
                rc = DTXiOSAgent("getServerId", []);
                if(!retPromise) {
                    if(iOSWebkit()) {
                        // if webkit return the already stored value
                        rc = DTXAgentJSBridge.getIOSServerId();
                    }
                }
            }
        }
        catch(e) {
            errorMsg(e);
        }
        return wrapReturn(rc);
    };

    context.Dynatrace.prototype.updateServerId = function() {
        try {
            if (isAndroid()) {
                // not needed
            }
            else {
                DTXiOSAgent("updateServerID", []);
            }
        }
        catch(e) {
            errorMsg(e);
        }
    };

    context.Dynatrace.prototype.backgroundUpdate = function(onOff,timeout) {
        var res = true;
        try {
            if(isAndroid()) {
                // not supported
            }
            else {
                if(onOff) {
                    if(!serverUpdateIntervalId) {
                        var dtObj  = this;
                        var dtTimeout = timeout;
                        serverUpdateIntervalId = WindowOrWorkerGlobalScope.setInterval(function(){dtObj.updatedServerId();},dtTimeout);
                    }
                    else {
                        res = false;
                    }
                }
                else {
                    if(serverUpdateIntervalId) {
                        WindowOrWorkerGlobalScope.clearInterval(serverUpdateIntervalId);
                        serverUpdateIntervalId = false; 
                    }
                    else {
                        res = false;
                    }
                }
            }
        }
        catch(e) {
            errorMsg(e);
            res = false;
        }
        return res;
    };
};

// for existing customers
context.ADKDebug = context.DTXAgentDebug;
context.CompuwareUEM = context.Dynatrace;

module.exports = new context.Dynatrace();
