/**
 * API Traffic Monitor - Popup UI Controller
 */

let activeTabId = null;
let isRecordingActive = false;

// HTML Elements
const toggleBtn = document.getElementById('toggleBtn');
const toggleIcon = document.getElementById('toggleIcon');
const toggleText = document.getElementById('toggleText');
const clearBtn = document.getElementById('clearBtn');
const searchInput = document.getElementById('searchInput');
const logCountBadge = document.getElementById('logCount');
const logContainer = document.getElementById('log-container');
const emptyState = document.getElementById('emptyState');
const pulseDot = document.getElementById('pulseDot');
const statusTxt = document.getElementById('statusTxt');
const bulkBar = document.getElementById('bulkBar');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const selectedCountLabel = document.getElementById('selectedCount');
const exportFormatSelect = document.getElementById('exportFormat');
const exportBtn = document.getElementById('exportBtn');
const exportText = document.getElementById('exportText');

// Escape helper to prevent HTML injection
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Escape helper to make IDs safe for querySelector (e.g. escaping dots in request ID)
function escapeSelector(id) {
  return '#' + CSS.escape(id);
}

// Shell escape helper for formatting cURL commands safely
function escapeShellString(str) {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

// Formats a log entry into a bash cURL command
function formatLogAsCurl(log) {
  let curl = `curl -X ${log.method} ${escapeShellString(log.fullUrl)}`;
  
  // Headers
  if (log.headers) {
    for (const [name, value] of Object.entries(log.headers)) {
      if (name.startsWith(':')) continue; // Skip HTTP/2 pseudo-headers
      curl += ` \\\n  -H ${escapeShellString(`${name}: ${value}`)}`;
    }
  }
  
  // Body
  if (log.method !== 'GET' && log.postData && log.postData !== 'No Request Body') {
    curl += ` \\\n  --data-raw ${escapeShellString(log.postData)}`;
  }
  
  return curl;
}

// Get appropriate badge class based on request method
function getMethodBadgeClass(method) {
  const m = (method || '').toUpperCase();
  if (m === 'GET') return 'badge-method-get';
  if (m === 'POST') return 'badge-method-post';
  if (m === 'PUT') return 'badge-method-put';
  if (m === 'DELETE') return 'badge-method-delete';
  return 'badge-method-other';
}

// Get status code class
function getStatusClass(status) {
  if (status === 'pending' || status === '...') return 'status-pending';
  if (status === 'Failed') return 'status-5xx';
  const statusCode = parseInt(status, 10);
  if (isNaN(statusCode)) return 'status-pending';
  if (statusCode >= 200 && statusCode < 300) return 'status-2xx';
  if (statusCode >= 300 && statusCode < 400) return 'status-3xx';
  if (statusCode >= 400 && statusCode < 500) return 'status-4xx';
  return 'status-5xx';
}

// Formats request or response headers to a grid list
function renderHeaders(headersObj) {
  if (!headersObj || Object.keys(headersObj).length === 0) {
    return `<div class="empty-block">No headers</div>`;
  }
  let html = `<div class="headers-grid">`;
  for (const [name, value] of Object.entries(headersObj)) {
    html += `
      <div class="header-name">${escapeHtml(name)}:</div>
      <div class="header-value">${escapeHtml(value)}</div>
    `;
  }
  html += `</div>`;
  return html;
}

// Copy helper to copy text content and show temporary status feedback
async function copyToClipboard(text, buttonEl) {
  try {
    await navigator.clipboard.writeText(text);
    const originalContent = buttonEl.innerHTML;
    buttonEl.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" style="display:inline; vertical-align:middle; margin-right:2px;">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
      </svg>Copied!
    `;
    setTimeout(() => {
      buttonEl.innerHTML = originalContent;
    }, 1500);
  } catch (err) {
    console.error("Clipboard copy failed:", err);
  }
}

// Initialise the interface
async function init() {
  // Find current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    activeTabId = tab.id;
  }

  // Get capture state from background service worker
  chrome.runtime.sendMessage({ action: "getState" }, async (state) => {
    isRecordingActive = state.isCapturing;
    updateUIState(isRecordingActive, state.activeTabId);
    
    // Load historical logs
    await loadLogsFromStorage();
  });

  // Event Listeners
  toggleBtn.addEventListener('click', onToggleCapture);
  clearBtn.addEventListener('click', onClearLogs);
  searchInput.addEventListener('input', applyFilter);

  selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    const checkboxes = Array.from(logContainer.querySelectorAll('.log-checkbox'));
    checkboxes.forEach(cb => {
      const item = cb.closest('.log-item');
      if (item && item.style.display !== 'none') {
        cb.checked = isChecked;
      }
    });
    updateSelectedCount();
  });

  exportBtn.addEventListener('click', exportEndpoints);
}

// Toggle Start/Stop capture state
async function onToggleCapture() {
  if (isRecordingActive) {
    chrome.runtime.sendMessage({ action: "stop" }, (res) => {
      isRecordingActive = false;
      updateUIState(false);
    });
  } else {
    if (!activeTabId) return;
    chrome.runtime.sendMessage({ action: "start", tabId: activeTabId }, (res) => {
      if (res && res.status === "error") {
        alert("Cannot capture active tab: " + res.message);
        return;
      }
      isRecordingActive = true;
      updateUIState(true, activeTabId);
      // Empty the visual list on starting fresh
      clearUIList();
    });
  }
}

// Clear all logs
async function onClearLogs() {
  chrome.runtime.sendMessage({ action: "clear" }, () => {
    clearUIList();
  });
}

// Clear logs list from the DOM
function clearUIList() {
  // Remove all log-item elements from container
  const items = logContainer.querySelectorAll('.log-item');
  items.forEach(item => item.remove());

  selectAllCheckbox.checked = false;
  selectAllCheckbox.indeterminate = false;

  updateEmptyStateVisibility();
  updateLogCountBadge();
  updateSelectedCount();
}

// Update the header, pulse dot, and start/stop button states
function updateUIState(recording, targetTabId) {
  if (recording) {
    pulseDot.classList.add('active');
    statusTxt.textContent = `Capturing Tab #${targetTabId || ''}`;
    statusTxt.style.color = '#ff7b72'; // Neon red text indicator
    
    toggleBtn.classList.add('active');
    toggleText.textContent = 'Stop Capturing';
    toggleIcon.innerHTML = `
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd"></path>
    `;
  } else {
    pulseDot.classList.remove('active');
    statusTxt.textContent = 'Idle';
    statusTxt.style.color = 'var(--color-text-secondary)';
    
    toggleBtn.classList.remove('active');
    toggleText.textContent = 'Start Capturing';
    toggleIcon.innerHTML = `
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
    `;
  }
}

// Load logs stored in local chrome storage
async function loadLogsFromStorage() {
  const { logIds = [] } = await chrome.storage.local.get('logIds');
  
  if (logIds.length === 0) {
    updateEmptyStateVisibility();
    updateLogCountBadge();
    return;
  }

  const keys = logIds.map(id => `log_${id}`);
  const store = await chrome.storage.local.get(keys);
  
  // Sort by time log was created
  const logs = logIds
    .map(id => store[`log_${id}`])
    .filter(log => !!log)
    .sort((a, b) => a.timestamp - b.timestamp);

  logs.forEach(log => {
    renderLogItem(log);
  });

  updateEmptyStateVisibility();
  updateLogCountBadge();
  updateSelectedCount();
}

// Render log item in the DOM list
function renderLogItem(log) {
  // If item already exists, update it instead
  const existingRow = document.getElementById(`log-${log.requestId}`);
  if (existingRow) {
    updateLogItem(log);
    return;
  }

  const item = document.createElement('div');
  item.className = 'log-item';
  item.id = `log-${log.requestId}`;
  
  // Method color class
  const methodClass = getMethodBadgeClass(log.method);
  
  // Status class and text
  const statusDisplay = log.status === 'pending' ? '...' : log.status;
  const statusClass = getStatusClass(log.status);

  // Time format
  const logDate = new Date(log.timestamp);
  const timeStr = logDate.toTimeString().split(' ')[0] + '.' + String(logDate.getMilliseconds()).padStart(3, '0');

  const shouldBeChecked = selectAllCheckbox.checked;

  item.innerHTML = `
    <div class="log-summary">
      <label class="checkbox-container log-item-checkbox-wrapper" onclick="event.stopPropagation();">
        <input type="checkbox" class="log-checkbox" data-request-id="${log.requestId}" ${shouldBeChecked ? 'checked' : ''}>
        <span class="checkbox-custom"></span>
      </label>
      <span class="badge ${methodClass}">${escapeHtml(log.method)}</span>
      <span class="status-code ${statusClass}" id="code-${log.requestId}">${escapeHtml(statusDisplay)}</span>
      <span class="url-path" title="${escapeHtml(log.fullUrl)}">${escapeHtml(log.path)}</span>
      <span class="log-time">${timeStr}</span>
      <svg class="chevron-icon" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
      </svg>
    </div>
    <div class="log-details">
      <div class="tab-container">
        <!-- URL Block -->
        <div class="detail-section">
          <div class="detail-section-header">
            <span>Full URL</span>
            <button class="copy-btn" id="copy-url-${log.requestId}">Copy URL</button>
          </div>
          <div class="detail-url-block">${escapeHtml(log.fullUrl)}</div>
        </div>

        <!-- Request Headers -->
        <div class="detail-section">
          <div class="detail-section-header">Request Headers</div>
          ${renderHeaders(log.headers)}
        </div>

        <!-- Request Body -->
        <div class="detail-section">
          <div class="detail-section-header">
            <span>Request Body</span>
            <button class="copy-btn" id="copy-req-${log.requestId}">Copy</button>
          </div>
          <pre class="pre-block" id="req-body-text-${log.requestId}">${escapeHtml(log.postData)}</pre>
        </div>

        <!-- Response Headers -->
        <div class="detail-section">
          <div class="detail-section-header">Response Headers</div>
          <div id="res-headers-container-${log.requestId}">
            ${renderHeaders(log.responseHeaders)}
          </div>
        </div>

        <!-- Response Body -->
        <div class="detail-section">
          <div class="detail-section-header">
            <span>Response Body</span>
            <button class="copy-btn" id="copy-res-${log.requestId}">Copy</button>
          </div>
          <pre class="pre-block" id="res-body-text-${log.requestId}">${escapeHtml(log.responseBody || 'Pending response...')}</pre>
        </div>
      </div>
    </div>
  `;

  // Bind expandable row trigger
  const summary = item.querySelector('.log-summary');
  summary.addEventListener('click', (e) => {
    // Avoid expanding if click was on a text selection or chevron only
    item.classList.toggle('expanded');
  });

  // Bind checkbox change listener
  const checkbox = item.querySelector('.log-checkbox');
  checkbox.addEventListener('change', () => {
    updateSelectedCount();
  });

  // Bind clipboard copy action triggers
  item.querySelector(escapeSelector(`copy-url-${log.requestId}`)).addEventListener('click', (e) => {
    e.stopPropagation();
    copyToClipboard(log.fullUrl, e.target);
  });

  item.querySelector(escapeSelector(`copy-req-${log.requestId}`)).addEventListener('click', (e) => {
    e.stopPropagation();
    copyToClipboard(log.postData, e.target);
  });

  item.querySelector(escapeSelector(`copy-res-${log.requestId}`)).addEventListener('click', (e) => {
    e.stopPropagation();
    const bodyContent = log.responseBody || 'Pending response...';
    copyToClipboard(bodyContent, e.target);
  });

  // Append, auto-scroll and apply filter
  logContainer.appendChild(item);
  applyFilter();
  updateEmptyStateVisibility();
  updateLogCountBadge();
  updateSelectedCount();
}

// Update existing log row (when response details are received)
function updateLogItem(log) {
  const item = document.getElementById(`log-${log.requestId}`);
  if (!item) return;

  // Update status code badge
  const codeBadge = item.querySelector(escapeSelector(`code-${log.requestId}`));
  if (codeBadge) {
    codeBadge.textContent = log.status;
    codeBadge.className = `status-code ${getStatusClass(log.status)}`;
  }

  // Update response headers
  const resHeadersContainer = item.querySelector(escapeSelector(`res-headers-container-${log.requestId}`));
  if (resHeadersContainer) {
    resHeadersContainer.innerHTML = renderHeaders(log.responseHeaders);
  }

  // Update response body pre block
  const resBodyPre = item.querySelector(escapeSelector(`res-body-text-${log.requestId}`));
  if (resBodyPre) {
    resBodyPre.textContent = log.responseBody || '';
  }

  // Update search & count badge if active filter matches the finished request
  applyFilter();
  updateLogCountBadge();
}

// Real-time client-side filter
function applyFilter() {
  const query = searchInput.value.toLowerCase().trim();
  const items = logContainer.querySelectorAll('.log-item');
  let matchCount = 0;

  items.forEach(item => {
    const summary = item.querySelector('.log-summary');
    const method = summary.querySelector('.badge').textContent.toLowerCase();
    const status = summary.querySelector('.status-code').textContent.toLowerCase();
    const path = summary.querySelector('.url-path').textContent.toLowerCase();
    
    const isMatch = method.includes(query) || status.includes(query) || path.includes(query);
    
    if (isMatch) {
      item.style.display = '';
      matchCount++;
    } else {
      item.style.display = 'none';
    }
  });

  updateLogCountBadge(matchCount);
  updateSelectedCount();
}

// Update empty state messaging visibility
function updateEmptyStateVisibility() {
  const items = logContainer.querySelectorAll('.log-item');
  if (items.length === 0) {
    emptyState.style.opacity = '1';
    emptyState.style.display = 'flex';
    bulkBar.style.display = 'none';
  } else {
    emptyState.style.opacity = '0';
    emptyState.style.display = 'none';
    bulkBar.style.display = 'flex';
  }
}

// Update the badge displaying entries count
function updateLogCountBadge(matchCount) {
  const totalItems = logContainer.querySelectorAll('.log-item').length;
  const filterActive = searchInput.value.trim().length > 0;

  if (filterActive) {
    logCountBadge.textContent = `${matchCount} of ${totalItems} filtered`;
  } else {
    logCountBadge.textContent = `${totalItems} entries`;
  }
}

// Remove log item from DOM
function removeLogItem(requestId) {
  const item = document.getElementById(`log-${requestId}`);
  if (item) {
    item.remove();
    updateEmptyStateVisibility();
    updateLogCountBadge();
    updateSelectedCount();
  }
}

// Background event listener for live logger updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "REQ_LOG") {
    renderLogItem(message.data);
  } else if (message.type === "RES_LOG") {
    renderLogItem(message.data);
  } else if (message.type === "REMOVE_LOG") {
    removeLogItem(message.requestId);
  } else if (message.type === "CAPTURE_STARTED") {
    isRecordingActive = true;
    updateUIState(true, message.tabId);
    clearUIList();
  } else if (message.type === "CAPTURE_STOPPED") {
    isRecordingActive = false;
    updateUIState(false);
  } else if (message.type === "CAPTURE_RESUMED") {
    isRecordingActive = true;
    updateUIState(true, message.tabId);
  } else if (message.type === "LOGS_CLEARED") {
    clearUIList();
  }
});

// Update the number of selected items and the export button text
function updateSelectedCount() {
  const checkboxes = Array.from(logContainer.querySelectorAll('.log-checkbox'));
  const visibleCheckboxes = checkboxes.filter(cb => {
    const item = cb.closest('.log-item');
    return item && item.style.display !== 'none';
  });
  
  const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
  const totalCount = visibleCheckboxes.length;
  
  selectedCountLabel.textContent = `${checkedCount} selected`;
  
  if (checkedCount > 0) {
    exportText.textContent = `Export Selected (${checkedCount})`;
  } else {
    exportText.textContent = 'Export All';
  }
  
  if (totalCount > 0) {
    selectAllCheckbox.checked = checkedCount === totalCount;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  }
}

// Bulk export selected or all visible endpoints
async function exportEndpoints() {
  const checkboxes = Array.from(logContainer.querySelectorAll('.log-checkbox'));
  const visibleCheckboxes = checkboxes.filter(cb => {
    const item = cb.closest('.log-item');
    return item && item.style.display !== 'none';
  });
  
  const checkedCheckboxes = visibleCheckboxes.filter(cb => cb.checked);
  const targetCheckboxes = checkedCheckboxes.length > 0 ? checkedCheckboxes : visibleCheckboxes;
  
  if (targetCheckboxes.length === 0) {
    alert("No endpoints available to export.");
    return;
  }
  
  const requestIds = targetCheckboxes.map(cb => cb.dataset.requestId);
  
  // Load logs from storage
  const keys = requestIds.map(id => `log_${id}`);
  const pendingKeys = requestIds.map(id => `pending_${id}`);
  const store = await chrome.storage.local.get([...keys, ...pendingKeys]);
  
  const logs = requestIds.map(id => store[`log_${id}`] || store[`pending_${id}`]).filter(Boolean);
  
  const format = exportFormatSelect.value;
  let outputText = '';
  
  if (format === 'json') {
    outputText = JSON.stringify(logs, null, 2);
  } else {
    // curl format
    outputText = logs.map(formatLogAsCurl).join('\n\n');
  }
  
  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(outputText);
    // Visual feedback
    const originalText = exportText.textContent;
    exportText.textContent = 'Copied!';
    const originalBg = exportBtn.style.background;
    exportBtn.style.background = 'linear-gradient(135deg, var(--accent-green), #10b981)';
    setTimeout(() => {
      exportText.textContent = originalText;
      exportBtn.style.background = originalBg;
    }, 1500);
  } catch (err) {
    console.error("Export copy failed:", err);
    alert("Failed to copy to clipboard: " + err.message);
  }
}

// Run initializer
document.addEventListener('DOMContentLoaded', init);