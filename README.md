# 🌐 API Traffic Monitor

A premium, lightweight, and modern Chrome Extension designed for developers to inspect, capture, and export network request and response traffic in real-time.

![API Traffic Monitor Banner](assets/cws_screenshot.png?v=1.1)

---

## ✨ Features

- **⚡ Real-time Interception**: Captures full HTTP requests and responses using the Chrome Debugger Protocol.
- **🔍 Deep Inspection**: Inspect query parameters, request payloads, response bodies, headers, and cookies at a glance.
- **🎨 Modern Dark Theme**: Built with rich aesthetics, featuring glassmorphism elements, custom scrollbars, and dynamic state-changing indicator animations.
- **📥 Smart Multi-Format Export**:
  - Export logs as standard **JSON**.
  - Export as ready-to-run **cURL** command-line strings.
  - Export as a fully-compliant **Postman Collection** for instant API testing.
- **🎯 Dynamic Filtering**: Find what you need instantly with live query filtering and matching counters.
- **🔒 Local-First Privacy**: All captured request payloads, headers, and bodies are kept on your device and are never sent to external servers.

---

## 📸 Interface Preview

![API Traffic Monitor Interface](assets/screenshot.jpg?v=1.1)

---

## 🛠️ Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone git@github.com:rahul-singh-solanki/API-Traffic-Monitor.git
   cd API-Traffic-Monitor
   ```

2. **Load the Unpacked Extension in Chrome**:
   - Open Google Chrome and navigate to `chrome://extensions/`.
   - Toggle on **Developer mode** in the top-right corner.
   - Click the **Load unpacked** button in the top-left corner.
   - Select the cloned directory (`API-Traffic-Monitor`).

3. **Start Monitoring**:
   - Click the extension icon in your Chrome toolbar.
   - Click **Start Capturing** to begin logging network traffic on the current tab.

---

## 📖 How to Use

1. **Capture Traffic**:
   - Open a tab with the website you want to inspect.
   - Launch the extension popup and click the red **Start Capturing** button.
   - A native debugger banner will appear on the page, and the extension badge will flash a red `REC` status.

2. **Filter & Select**:
   - Use the toolbar search input to filter logs by URL pathname or query strings.
   - Check the checkboxes for the specific API calls you want to export.

3. **Export**:
   - Select your desired format from the dropdown (JSON, cURL, or Postman Collection).
   - Click **Export Selected** to copy or save the formatted payload.

---

## 🛠️ Tech Stack

- **Extension Framework**: Manifest V3
- **APIs**: Chrome Debugger API, Local Storage API
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Grid Layouts & Variables), Vanilla JavaScript (ES6)

---

## 📄 License

This project is licensed under the MIT License.
