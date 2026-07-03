# Chrome Web Store Listing — API Traffic Capture

> Last Updated: 2026-07-03

## Store Listing

**Extension Name**
API Traffic Capture

**Short Description**
Start/Stop capturing full API requests and responses with a live UI.

**Detailed Description**
API Traffic Capture is a premium developer tool that allows you to monitor, inspect, and export network API traffic in real-time. By attaching the native Chrome Debugger to a tab, it intercepts all requests and responses, providing details on request payloads, cookies, query parameters, headers, and response bodies in a sleek dark interface.

Key Features:
- Real-time logging of HTTP/HTTPS requests and response payloads.
- Instantly export selected requests to JSON, cURL commands, or a complete Postman Collection.
- Filter traffic on-the-fly using URL keyword search.
- iOS-style status indicators and visual states indicating capturing activity.
- Zero server-side interaction: all your data stays strictly on your local machine.

How to use:
1. Open the website you wish to monitor.
2. Click the extension icon and select "Start Capturing".
3. Interact with the website. API Traffic Capture will record all network events.
4. Filter or select specific requests, select an export format, and click "Export Selected".

Privacy and Security:
All logs are processed and stored locally in your browser's private storage. No data is transmitted off your device.

Support:
Submit issues or feedback on GitHub at: https://github.com/rahul-singh-solanki/API-Traffic-Monitor/issues

**Category**
Developer Tools

**Single Purpose**
Captures and exports browser tab API requests and responses in real-time.

**Primary Language**
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 | ✅ Ready | `assets/cws_screenshot_v2.png` |
| Screenshot 2 [RECOMMENDED] | 1024×816 | ✅ Ready | `assets/screenshot_v2.jpg` |

### Screenshot Notes
- **Screenshot 1**: A centered mock-up of the dark UI highlighting captured GraphQL requests, Postman Collection format selected, and active tab capturing badge, on a premium gradient background.
- **Screenshot 2**: Full high-resolution raw interface preview showing the API Traffic Monitor active interface.

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `debugger` | permissions | Required to attach to the tab's network engine via Chrome Debugger Protocol to intercept headers, cookies, request payloads, and response bodies. |
| `tabs` | permissions | Required to query active tab details (such as Tab ID) to attach the debugger and show the active tab number in the UI. |
| `storage` | permissions | Required to temporarily store captured request logs and session settings locally in the extension's local sandbox storage. |
| `<all_urls>` | host_permissions | Required to capture network traffic on any URL domain the user initiates capturing on. |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Privacy Policy

**Privacy Policy URL**
https://github.com/rahul-singh-solanki/API-Traffic-Monitor/blob/main/PRIVACY_POLICY.md

---

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

---

## Developer Info

**Publisher Name**
Rahul Singh Solanki

**Contact Email**
rs.singh1812@gmail.com

**Support URL / Email**
https://github.com/rahul-singh-solanki/API-Traffic-Monitor/issues

**Homepage URL**
https://github.com/rahul-singh-solanki/API-Traffic-Monitor

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.1 | 2026-07-03 | Added store icons, polished assets, updated metadata, and structured packaging scripts. | Draft |

---

## Review Notes

### Known Issues / Limitations
- Attaching a debugger shows a browser warning banner on the target page. This is a built-in Chrome security feature and cannot be disabled.
