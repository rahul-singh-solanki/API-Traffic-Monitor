/**
 * API Traffic Capture - Background Service Worker
 * Implements Manifest V3 Network interceptor using chrome.debugger
 */

// Serialized storage queue to prevent race conditions on concurrent log updates
let storageQueue = Promise.resolve();
function queueStorage(task) {
  storageQueue = storageQueue.then(task).catch(err => console.error("Storage queue error:", err));
  return storageQueue;
}

// Helper to append a request ID to the list of log IDs in storage
async function appendLogId(requestId) {
  return queueStorage(async () => {
    const { logIds = [] } = await chrome.storage.local.get('logIds');
    if (!logIds.includes(requestId)) {
      logIds.push(requestId);
      await chrome.storage.local.set({ logIds });
    }
  });
}

// Helper to clear all logs from storage
async function clearAllLogs() {
  return queueStorage(async () => {
    const items = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(items).filter(
      k => k.startsWith('log_') || k.startsWith('pending_') || k === 'logIds'
    );
    await chrome.storage.local.remove(keysToRemove);
    chrome.runtime.sendMessage({ type: "LOGS_CLEARED" }).catch(() => {});
  });
}

// Start capturing network requests for a tab
async function startCapturing(tabId) {
  const { capturingTabId } = await chrome.storage.local.get('capturingTabId');
  if (capturingTabId && capturingTabId !== tabId) {
    await stopCapturing(capturingTabId);
  }

  // Attach the debugger to the tab
  await chrome.debugger.attach({ tabId }, "1.3");
  
  // Enable Network tracking
  await chrome.debugger.sendCommand({ tabId }, "Network.enable");

  // Save capturing state
  await chrome.storage.local.set({
    captureState: 'capturing',
    capturingTabId: tabId
  });

  // Clear previous session logs for a fresh capturing run
  await clearAllLogs();

  // Set action badge to show active recording
  await chrome.action.setBadgeText({ text: 'REC' });
  await chrome.action.setBadgeBackgroundColor({ color: '#FF3B30' }); // iOS Alert Red

  chrome.runtime.sendMessage({ type: "CAPTURE_STARTED", tabId }).catch(() => {});
}

// Stop capturing network requests for a tab
async function stopCapturing(tabId) {
  try {
    await chrome.debugger.detach({ tabId });
  } catch (err) {
    // Ignore error if already detached
  }

  await chrome.storage.local.set({
    captureState: 'idle',
    capturingTabId: null
  });

  await chrome.action.setBadgeText({ text: '' });

  chrome.runtime.sendMessage({ type: "CAPTURE_STOPPED", tabId }).catch(() => {});
}

// Handle runtime messages from Popup UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "start") {
    (async () => {
      try {
        await startCapturing(message.tabId);
        sendResponse({ status: "started" });
      } catch (err) {
        console.error("Failed to start capture:", err);
        sendResponse({ status: "error", message: err.message });
      }
    })();
    return true; // Keep message port open for async response
  } else if (message.action === "stop") {
    (async () => {
      const { capturingTabId } = await chrome.storage.local.get('capturingTabId');
      if (capturingTabId) {
        await stopCapturing(capturingTabId);
      }
      sendResponse({ status: "stopped" });
    })();
    return true;
  } else if (message.action === "clear") {
    (async () => {
      await clearAllLogs();
      sendResponse({ status: "cleared" });
    })();
    return true;
  } else if (message.action === "getState") {
    (async () => {
      const { captureState, capturingTabId } = await chrome.storage.local.get(['captureState', 'capturingTabId']);
      sendResponse({
        isCapturing: captureState === 'capturing',
        activeTabId: capturingTabId
      });
    })();
    return true;
  }
});

// Helper to determine if a URL represents a static asset
function isLikelyStaticAsset(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|otf|mp4|mp3|wav|avi|webm|pdf|map)$/.test(pathname);
  } catch (e) {
    return false;
  }
}

// Intercept events from the DevTools debugger protocol
chrome.debugger.onEvent.addListener(async (source, method, params) => {
  const { captureState, capturingTabId } = await chrome.storage.local.get(['captureState', 'capturingTabId']);
  if (captureState !== 'capturing' || capturingTabId !== source.tabId) return;

  // 1. Capture Request
  if (method === "Network.requestWillBeSent") {
    // If resource type is known and is NOT XHR or Fetch, filter it out
    if (params.type !== undefined && params.type !== "XHR" && params.type !== "Fetch") {
      return;
    }
    
    const req = params.request;

    // If resource type is unknown, ignore likely static assets
    if (params.type === undefined && isLikelyStaticAsset(req.url)) {
      return;
    }

    let urlObj;
    try {
      urlObj = new URL(req.url);
    } catch (e) {
      urlObj = { origin: req.url, pathname: "", search: "" };
    }

    let postData = "No Request Body";
    if (req.postData) {
      postData = req.postData;
      // Format request body if it is JSON
      try {
        postData = JSON.stringify(JSON.parse(postData), null, 2);
      } catch (e) {
        // Keep as raw string
      }
    }

    const payload = {
      requestId: params.requestId,
      method: req.method,
      baseUrl: urlObj.origin,
      path: urlObj.pathname + urlObj.search,
      fullUrl: req.url,
      headers: req.headers || {},
      postData: postData,
      status: "pending",
      timestamp: Date.now()
    };

    // Save pending request state
    await chrome.storage.local.set({ [`pending_${params.requestId}`]: payload });

    // Send update to popup
    chrome.runtime.sendMessage({ type: "REQ_LOG", data: payload }).catch(() => {
      // Ignore errors when popup is closed
    });
  }

  // 2. Capture Response
  if (method === "Network.responseReceived") {
    const res = params.response;
    const requestId = params.requestId;
    const pendingKey = `pending_${requestId}`;

    const store = await chrome.storage.local.get(pendingKey);
    const reqData = store[pendingKey];
    if (!reqData) return; // Ignore if request was not tracked

    // If the resource type is now known and is NOT XHR or Fetch, discard it
    if (params.type && params.type !== "XHR" && params.type !== "Fetch") {
      await chrome.storage.local.remove(pendingKey);
      chrome.runtime.sendMessage({ type: "REMOVE_LOG", requestId }).catch(() => {});
      return;
    }

    let responseBody = "(No Response Body)";
    try {
      const bodyResult = await chrome.debugger.sendCommand(
        { tabId: source.tabId },
        "Network.getResponseBody",
        { requestId: requestId }
      );

      if (bodyResult) {
        responseBody = bodyResult.body;
        if (bodyResult.base64Encoded) {
          try {
            responseBody = atob(responseBody);
          } catch (e) {
            responseBody = "(Binary Base64 Content)";
          }
        }
        // Format response body if it is JSON
        try {
          responseBody = JSON.stringify(JSON.parse(responseBody), null, 2);
        } catch (e) {
          // Keep as raw text
        }
      }
    } catch (err) {
      responseBody = "(Response body unavailable or empty)";
    }

    const combinedLog = {
      ...reqData,
      status: res.status,
      responseHeaders: res.headers || {},
      responseBody: responseBody
    };

    // Save permanently and clean up pending key
    await chrome.storage.local.set({ [`log_${requestId}`]: combinedLog });
    await appendLogId(requestId);
    await chrome.storage.local.remove(pendingKey);

    // Send updated log to popup
    chrome.runtime.sendMessage({ type: "RES_LOG", data: combinedLog }).catch(() => {
      // Ignore error when popup is closed
    });
  }

  // 3. Capture Request Failure
  if (method === "Network.loadingFailed") {
    const requestId = params.requestId;
    const pendingKey = `pending_${requestId}`;

    const store = await chrome.storage.local.get(pendingKey);
    const reqData = store[pendingKey];
    if (!reqData) return; // Ignore if request was not tracked

    // If resource type is known and is NOT XHR or Fetch, discard it
    if (params.type && params.type !== "XHR" && params.type !== "Fetch") {
      await chrome.storage.local.remove(pendingKey);
      chrome.runtime.sendMessage({ type: "REMOVE_LOG", requestId }).catch(() => {});
      return;
    }

    const combinedLog = {
      ...reqData,
      status: "Failed",
      responseHeaders: {},
      responseBody: params.errorText || "Request failed or was blocked."
    };

    // Save permanently and clean up pending key
    await chrome.storage.local.set({ [`log_${requestId}`]: combinedLog });
    await appendLogId(requestId);
    await chrome.storage.local.remove(pendingKey);

    // Send updated log to popup
    chrome.runtime.sendMessage({ type: "RES_LOG", data: combinedLog }).catch(() => {
      // Ignore error when popup is closed
    });
  }
});

// Re-attach debugger automatically if we are capturing and it gets detached
async function reattachIfNeeded(tabId) {
  const { captureState, capturingTabId } = await chrome.storage.local.get(['captureState', 'capturingTabId']);
  if (captureState !== 'capturing' || capturingTabId !== tabId) return;

  // Use session storage to prevent concurrent attach operations on the same tab
  let isAttaching = false;
  if (chrome.storage && chrome.storage.session) {
    try {
      const { attachingTabId } = await chrome.storage.session.get('attachingTabId');
      if (attachingTabId === tabId) {
        console.log(`Debugger attachment already in progress for tab ${tabId}, skipping duplicate call.`);
        return;
      }
      await chrome.storage.session.set({ attachingTabId: tabId });
      isAttaching = true;
    } catch (e) {
      // Fallback if session storage isn't fully set up or errors
      console.warn("Session storage access failed:", e);
    }
  }

  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");
    console.log(`Successfully attached/re-attached debugger to tab ${tabId}`);
    chrome.runtime.sendMessage({ type: "CAPTURE_RESUMED", tabId }).catch(() => {});
  } catch (err) {
    const errMsg = err.message || "";
    if (errMsg.toLowerCase().includes("already attached")) {
      // If we are already attached, we might just need to ensure Network is enabled (e.g. after a reload/navigation)
      try {
        await chrome.debugger.sendCommand({ tabId }, "Network.enable");
        console.log(`Debugger was already attached to tab ${tabId}; successfully ensured Network is enabled.`);
      } catch (cmdErr) {
        console.warn(`Another debugger is attached to tab ${tabId}. Cannot command:`, cmdErr.message);
      }
    } else {
      console.error(`Failed to attach debugger to tab ${tabId}:`, err);
      // If it's a restricted page, stop capturing
      if (errMsg.includes("Cannot attach to the target") || errMsg.includes("restricted")) {
        await stopCapturing(tabId);
      }
    }
  } finally {
    if (isAttaching && chrome.storage && chrome.storage.session) {
      try {
        await chrome.storage.session.remove('attachingTabId');
      } catch (e) {
        // Ignore cleanup failures
      }
    }
  }
}

// Re-attach debugger automatically on tab reload/navigation
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
    await reattachIfNeeded(tabId);
  }
});

// Monitor debugger detach events
chrome.debugger.onDetach.addListener(async (source, reason) => {
  console.log(`Debugger detached from tab ${source.tabId}. Reason: ${reason}`);
  const { captureState, capturingTabId } = await chrome.storage.local.get(['captureState', 'capturingTabId']);
  
  if (capturingTabId === source.tabId && captureState === 'capturing') {
    if (reason === 'canceled_by_user') {
      // User closed the debugger warning banner manually
      await stopCapturing(source.tabId);
    } else {
      // Detached due to page navigation, tab crash, or reload.
      // Verify if the tab still exists. If so, attempt to re-attach immediately.
      try {
        await chrome.tabs.get(source.tabId);
        console.log(`Tab ${source.tabId} still exists. Attempting immediate re-attach...`);
        await reattachIfNeeded(source.tabId);
      } catch (e) {
        console.log(`Tab ${source.tabId} closed. Stopping capturing.`);
        await stopCapturing(source.tabId);
      }
    }
  }
});

// Clean up state on browser startup
chrome.runtime.onStartup.addListener(async () => {
  await chrome.storage.local.set({ captureState: 'idle', capturingTabId: null });
  await chrome.action.setBadgeText({ text: '' });
});

// Initialize default state on extension installation
chrome.runtime.onInstalled.addListener(async () => {
  const { captureState } = await chrome.storage.local.get('captureState');
  if (!captureState) {
    await chrome.storage.local.set({ captureState: 'idle', capturingTabId: null });
  }
});