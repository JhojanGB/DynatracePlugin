declare module DynatracePlugin {
	
	interface DynatraceBridge{
		enterAction(actionName: string) : any;
		leaveAction(actionId: any) : any;
		flushEvents() : any;
		reportErrorInteger(errorName: string, errorValue: any) : any;
		reportErrorString(errorName: string, exceptionValue: any) : any;
		enterActionParentId(actionName: string, parentID: any) : any;
		reportEvent(eventName: string, actionId: any) : any;
		reportErrorIntegerWithAction(errorName: string, errorValue: any, actionId: any) : any;
		reportErrorStringWithAction(errorName: string, exceptionValue: any, actionId: any) : any;
		reportValueInt(valueName: string, intValue: any, actionId: any) : any;
		reportValueDouble(valueName: string, doubleValue: any, actionId: any): any;
		reportValueString(valueName: string, stringValue: any, actionId: any): any;
		setGpsLocation(longitude: any, latitude: any): any;
		lastErrorCode(): any;
		lastErrorMsg(): any;
		startTaggingRequests(actionId: string): any;
		getCookieForAction(actionId: string): any;
		endVisit(actionId: string): any;
		tagXmlHttpRequest(xmlHttpReq: any, actionId: any);
		getServerId(): any;
		setDtPc(cookie: any);
	}
	
	
	interface DynatraceMobileAndroid{
		getCaptureStatus(success: any, error: any) : any;
	}
	
}

declare var DynatraceJsBridge : DynatracePlugin.DynatraceBridge;
declare var DynatraceMobile : DynatracePlugin.DynatraceMobileAndroid;