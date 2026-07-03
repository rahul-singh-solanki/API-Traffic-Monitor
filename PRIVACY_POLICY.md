# Privacy Policy for API Traffic Capture

*Last Updated: 2026-07-03*

This privacy policy describes how **API Traffic Capture** handles information when you install and use the extension.

## 1. Data Collection & Transmission
API Traffic Capture is a local development utility tool.
- **No Data Collection**: The extension does not collect any personal data, account info, telemetry, or browsing history.
- **No Data Transmission**: The extension does not transmit any captured headers, parameters, cookies, payloads, or response bodies off your device. There is no backend server or cloud component. All operations are performed 100% locally.
- **No Cookies or Analytics**: We do not use cookies, trackers, pixel tags, Google Analytics, or any third-party analytics libraries.

## 2. How Data is Processed & Stored
- The extension utilizes the native `chrome.debugger` API to capture network request and response streams for the specific tab you target.
- These network logs are stored in your browser's local sandbox storage (`chrome.storage.local`) only during the active monitoring session.
- Clicking the **Clear Logs** button, stopping the capture, or closing the extension popup permanently deletes the cached session logs from local storage.

## 3. Third-Party Services
This extension does not integrate with any third-party APIs or external services.

## 4. Permissions Disclosures
The extension requests the following permissions for local operation:
- `debugger`: To attach to the tab's network system and log API request and response data.
- `tabs`: To select the active tab and display active status.
- `storage`: To hold captured requests in the local storage cache while you use the extension.
- `<all_urls>` (host_permissions): To allow capturing network traffic on whichever host domains you choose to run the tool on.

## 5. Contact
If you have any questions about this privacy policy or the extension's data handling practices, please contact:
- **Email**: rs.singh1812@gmail.com
- **GitHub Issues**: https://github.com/rahul-singh-solanki/API-Traffic-Monitor/issues
