#import "DynatraceCordovaPlugin.h"
#import <Cordova/CDVPlugin.h>
#import "Dynatrace.h"


@implementation DynatraceCordovaPlugin

- (void)endVisit:(CDVInvokedUrlCommand*)command{
    DTX_StatusCode code = [DTXAction endVisit];

    CDVPluginResult* result;

    if(code == DTX_CaptureOn){
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                    messageAsString:@(code).stringValue];
    }else{
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR
                    messageAsString:@(code).stringValue];
    }
                              
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

@end