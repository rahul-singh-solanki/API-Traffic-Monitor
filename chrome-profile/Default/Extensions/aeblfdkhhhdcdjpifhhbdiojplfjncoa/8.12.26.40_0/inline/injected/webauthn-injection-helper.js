"use strict";
(() => {
var n=window.location.hostname.includes("dropbox")&&(window.location.pathname.includes("get")||window.location.search.includes("download_id"));window.hasWebauthnInjectionHelperRun!==!0&&!n&&o();function o(){window.hasWebauthnInjectionHelperRun=!0;let e=document.createElement("script");e.src=chrome.runtime.getURL("/inline/injected/webauthn-listeners.js"),document.documentElement.prepend(e),e.remove()}
})();
