declare module DynatracePlugin {
	
	interface JavaScriptAgentAppMon{

		/**
		 * Enter an action
		 * @param {string} actionName - name of action
		 * @param {string} actionType - type
		 * @param {number} time - time in milliseconds. if null, current time is used.
		 * @param {number|boolean} parentAction - optional id of parent action. if parameter is not passed=> appended to currently running action, if false => root action, if a number is passed, action is added as subaction to action with given id.
		 * @return id of created action
		 */
		enterAction(actionName: string, actionType: string, time?: number, parentID?: number) : number;

		/**
		 * Leaves an action
		 * @param {number} actionId - id of action to leave. must be the value returned by enterAction
		 * @param {number} time - end time in milliseconds
		 * @param {number} startTime - optional start time in milliseconds (necessary if start time should be modified)
		 */
		leaveAction(actionId: number, time?: number, startTime?: number) : void;

		/**
		 * Reports an error message
		 * @param {Error|string} error The error to be tracked. Any browser error object is supported, if error does not
		 *   have a stacktrace, it will attempt to generate one.
		 *   Alternatively you can create your own object to pass to this function, simply set the properties "message",
		 *   "file", "line", "column" & "stack" to the corresponding values and appmon will pick up the values. All values
		 *   except message are optional.
		 * @param {number} parentActionId parent action id. if not passed or null, error is added to current action
		 */
		reportError(error: string, parentActionId?: number) : void;

		/**
		 * Reports a warning message
		 * @param {string} warning - warning message
		 * @param {number} parentActionId - parent action id. if not passed or null, error is added to current action
		 */
		reportWarning(warning: string, parentActionId?: number) : void;

		/**
		 * Reports an event
		 * @param {string} msg - message text
		 * @param {number} parentActionId - parent action id. if not passed or null, error is added to current action
		 */
		reportEvent(msg: string, parentActionId?: number) : void;
		
		/**
		 * Reports a key value pair to the server. The data can e.g. be used to create charts.
		 * @param {string} key - the key to identify the value
		 * @param {number} value - the value to report
		 */
		reportValue(key: string, value: number) : void;

		/**
		 * Reports a key value pair to the server. The data can e.g. be used to create charts. The difference to the {@link reportValue} function is that here the value is a string.
		 * @param {string} key - the key to identify the value
		 * @param {string} value - the value to report
		 */
		reportString(key: string, str: string) : void;

		/**
		 * Tags a visit with a String value.
		 * @param {string} value - The value to tag the visit with (e.g. a username, a userid, an email address...)
		 */
		tagVisit(visit: string) : void;

		/**
		 * Indicates the start of a user input. User inputs must always be stopped by calling endUserInput.
		 * If an xhr call or a page load happens it is checked if a user input is active. If yes, the user input is set to have triggered the page action.
		 * @param {HTMLElement} domNode - Which triggered the action (button, etc) is used for determining its caption
		 * @param {string} type - Type of the user input: 'click', 'keypress', 'scroll',...
		 * @param {string} addInfo - Additional info for user input such as key, mouse button, etc ('F5', 'RETURN',...)
		 * @param {number} validTime - How long should the user input be able to open actions? default is 30ms
		 * @return UserInputObject - The object containing the user input information.
		 */
		beginUserInput(domNode: HTMLElement, type: string, addInfo: string, validTime?: number): any;

		/**
		 * Ends a user input.
		 * @param {*} userInputObject - the user input object returned by {@link beginUserInput}
		 */
		endUserInput(userInputObject: any): void;

		/**
		 * Initiate ajax action. Must be closed by {@link leaveXhrAction} afterwards.
		 * @param {string} type - Additional info about type of xhr (eg. framework name,etc)
		 * @param {number} mode - The action mode: 0 .. just extend running ajax actions 1 .. extend any running action 2 .. extend any running action - visible subaction 3 .. start action if user input is present
		 * @param {boolean} webSocket - Indicates if this action is a webSocket action or not
		 * @return id of action
		 */
		enterXhrAction(type: string, mode: number, webSocket: boolean): number;

		/**
		 * Indicates the end of an xhr action. Must be started by {@link leaveXhrAction} beforehand.
		 * @param {number} id - id of action (must be the value returned by enterXhrAction)
		 */
		leaveXhrAction(id: number): void;

		/**
		 * Enables/disables automatic action detection.
		 * @param {boolean} enabled - true/false
		 */
		setAutomaticActionDetection(enabled: boolean) : void;

	}
	
	interface JavaScriptAgentDynatrace{
		
		/**
		 * Enables/disables automatic action detection.
		 * @param {boolean} enabled - true/false
		 */
		setAutomaticActionDetection(enabled: boolean) : void;
		
		/**
		 * Tells the js agent to not automatically detect load end. Load start and load end must be set explicitly via signalLoadEnd.
		 * This function must be called immediately after the js agent script tag!
		 */
		setLoadEndManually() : void;
		
		/**
		 * Signals that the page has finished loading
		 */
		signalLoadEnd() : void;
		
		/**
		 * Enter an action
		 * @param {string} actionName name o action
		 * @param {string} actionType type
		 * @param {number=} time time in milliseconds. if null, current time is used.
		 * @param {string=} info additional information for this action, e.g. framework
		 * @return {number} id of the created action
		 */
		enterAction(actionName: string, actionType: string, time?: number, info?: string): number;

		/**
		 * Leaves an action
		 * @param {number} actionId id of the action to leave. must be the value returned by enterAction
		 * @param {number=} time end time in milliseconds
		 * @param {number=} startTime optional start time in milliseconds (necessary if start time should be modified)
		 */
		leaveAction(actionId: number, time?: number, startTime?: number): void;
		
		/**
		 * Reports an error message
		 *
		 * @public
		 * @param {Error|string} error The error to be tracked. Any browser error object is supported, if error does not
		 *   have a stacktrace, it will attempt to generate one.
		 *   Alternatively you can create your own object to pass to this function, simply set the properties "message",
		 *   "file", "line", "column" & "stack" to the corresponding values and dynatrace will pick up the values. All values
		 *   except message are optional.
		 * @param {number=} parentActionId parent action id. if not passed or null, error is added to current action
		 */
		reportError(error: Error | string, parentActionId?: number | boolean): void;
		
		/**
		 * Identifies a user
		 * @param {string} value - The value to name the user (e.g. a username, a userid, an email address...)
		 */
		identifyUser(value?: string): void;
		
		/**
		 * Indicates the start of a third party resource
		 * @param {char} type 'i'...image, 's'...script, 'c'... custom
		 * @param {string} url complete URL of resource
		 */
		startThirdParty(type: 'i'|'s'|'c', url: string): void;
		
		/**
		 * Indicates stop of a third party resource
		 * @param {string} url complete URL of resource (must match URL provided in startThirdParty)
		 * @param {boolean} success true if the resource was loaded successfully, false if not
		 * @param {number=} start absolute start time in milliseconds. Optional. When parameter is not passed or <=0, time of startThirdParty call is used
		 * @param {number=} stop absolute stop time in milliseconds. Optional. When parameter is not passed or <=0, time of stopThirdParty call is used
		 */
		stopThirdParty(url: string, success: boolean, start?: number, stop?: number): void;
		
		/**
		 * Adds a listener that is called when the user is leaving the page, but before the monitor signal is sent
		 * @param {function()} listener a function that will be called in case the user leaves the page
		 */
		addPageLeavingListener(listener: EventListener): void;
		
		/**
		 * Initiate ajax call
		 * @param {string} type optional additional info about type of xhr (eg framework name,etc)
		 * @param {number} xmode xhr action creation mode
		 *          0 .. just extend running ajax actions
		 *          1 .. extend any running action
		 *          2 .. extend any running action - visible subaction
		 *          3 .. start action if user input is present
		 * @param {string} xhrUrl url of the requested resource
		 * @return {number} id of the XhrAction
		 */
		enterXhrAction(type: string, xmode?: 0|1|2|3, xhrUrl?: string): number;
		
		/**
		 * Indicates the end of an xhr action
		 * @param {number} actionId id of the xhr Action
		 */
		leaveXhrAction(actionId: number): void;
		
		/**
		 * Indicates that an xhr callback is active (eg. XMLHttpRequest onreadystatechange). This is necessary to automatically add actions
		 * started during a callback as subactions. Xhr callback must be stopped by endXhrCallback
		 * @param {number} actionId id of the action where callback belongs to
		 */
		enterXhrCallback(actionId: number): void;
		
		/**
		 * Indicates the end of an xhr callback.
		 * @param {number} actionId id of the action where callback belongs to
		 */
		leaveXhrCallback(actionId: number): void;
		
		/**
		 * Indicates the start of a load action. Frameworks often have their own load callback functions
		 * this can be used when framework starts load before "DOMContentLoaded"
		 */
		signalOnLoadStart(): void;

		/**
		 * Tells the JavaScript agent to wait for an additional call of signalOnLoadEnd.
		 * When the last call of signalOnLoadEnd is performed the "onload" action is closed.
		 * Note: if this function is called, signalOnLoadEnd MUST be called afterwards to indicated the end of one load.
		 */
		incrementOnLoadEndMarkers(): void;

		/**
		 * Indicates the end of a load action. needs incrementOnLoadEndMarkers to be called before.
		 * When last signalOnLoadEnd is called, the "onload" action is closed
		 */
		signalOnLoadEnd(): void;

		/**
		 * Sets the actionName of the currently active Action
		 * @param {string} actionName the new name for the currently active action
		 */
		actionName(actionName: string): void;

		/**
		 * Returns the current time in milliseconds. It automatically chooses the most accurate way to determine the current time.
		 * @returns {number} the current time in milliseconds
		 */
		now(): number;

		/**
		 * Cookie Opt-In only: Enables the JavaScript agent in case it was disabled via Cookie Opt-In setting.
		 */
		enable(): void;

		/**
		 * Cookie Opt-In only: Disables the JavaScript agent and removes Dynatrace cookies for Cookie Opt-In
		 * mode in case dtrum.enable() has been called earlier
		 */
		disable(): void;

		/**
		 * Adds a listener to get triggered upon the creation of a new visit id
		 * @param listener
		 */
		addVisitTimeoutListener(listener: EventListener): void;
		
		/**
		 * Enables persistent values again. Only applies if 'disablePersistentValues' has been called previously.
		 */
		enablePersistentValues(): void;
	 
	}
	
	interface DynatraceMobile{
		/**
		 * Sends an endSession signal to the server, which will cause the session to end without waiting for a timeout
		 */
		endVisit(success: any, error: any) : number;
	}
	
}

declare var dtrum : DynatracePlugin.JavaScriptAgentDynatrace;
declare var dynaTrace : DynatracePlugin.JavaScriptAgentAppMon;
declare var dynatraceMobile : DynatracePlugin.DynatraceMobile;

