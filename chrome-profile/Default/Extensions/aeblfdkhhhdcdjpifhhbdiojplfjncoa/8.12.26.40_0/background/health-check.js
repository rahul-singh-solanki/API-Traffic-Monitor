"use strict";
(() => {
chrome.runtime.onMessage.addListener((r,e,a)=>{r.name==="health-check-request"&&(console.info("[Background]","HealthCheck: received request from tab "+e.tab?.id)||chrome.runtime[Symbol.for("com.1p.log")]?.report(["HealthCheck: received request from tab "+e.tab?.id],{severity:"info",fileName:"js/b5x/background/src/background/health-check.ts",lineNumber:17,srcLineNumber:9,prefix:"[Background]",highlight:!1,rawParams:'"HealthCheck: received request from tab " + sender.tab?.id'}),a({name:"health-check-response",data:"alive"}))});
})();
