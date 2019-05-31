package com.dynatrace.cordova.plugin;
 
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaWebView;
import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;

import com.dynatrace.android.agent.Dynatrace;

public class DynatraceCordovaPlugin extends CordovaPlugin {
	
	public static final String ACTION_UEM_CAPTURE_STATUS = "getCaptureStatus"; 
	
	@Override
	public void initialize(CordovaInterface cordova, CordovaWebView webView) {
		super.initialize(cordova, webView);
		// your init code here
	}
	
	@Override
	public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
		try {
			if (ACTION_UEM_CAPTURE_STATUS.equals(action)) {
				int status = Dynatrace.getCaptureStatus();
				callbackContext.success(String.valueOf(status));
			    return true;
			}
			
			return false;
		} catch(Exception e) {
			System.err.println("Exception: " + e.getMessage());
			callbackContext.error(e.getMessage());
			return false;
		} 
	}
}