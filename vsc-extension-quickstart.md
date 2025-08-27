# Extract HTML to SCSS

**A Visual Studio Code extension** that automatically extracts SCSS selector structures from HTML files, helping you quickly and consistently convert UI from HTML to SCSS.

---

## 📌 Features

- **Smart file selection**  
  Automatically detects and prioritizes HTML files (`index.html`, `under.html`, `main.html`).

- **Custom extraction scope**  
  Enter a root selector (e.g., `.idxn01 .card`) to define the starting point for extraction.

- **DOM traversal & SCSS generation**  
  - Generates **nested SCSS selectors** based on `class` or `id`.  
  - Ignores unnecessary classes (supports wildcard patterns, e.g., `br_*`).  
  - Avoids duplicate selectors at the same level.

- **Special heading handling**  
  Dedicated blocks for heading tags (`h3`, `h4`, `h5`, `h6`).

- **Seamless insertion**  
  Inserts the generated SCSS directly into the currently open SCSS/CSS file at the cursor position, or creates a new file if no editor is open.

---

## ⚙️ Requirements

- **Node.js** `>= 18`
- **VS Code** `>= 1.70`
- Workspace must contain at least **one HTML file**.

---

## 🚀 Installation & Usage

1. **Install**  
   - From the [VS Code Marketplace](https://marketplace.visualstudio.com/)  
   - Or manually via a `.vsix` file.

2. **Open your SCSS/CSS file**  
   Where you want to insert the generated selectors.

3. **Run the command**  
   - Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P` on macOS).  
   - Select **"Extract HTML to SCSS"**.

4. **Follow the prompts**  
   - Select the source HTML file.  
   - Enter the root selector.  
   - Receive the generated SCSS structure.

---

## 🔧 Configuration

- No special configuration is required.  
- To change ignored classes, modify the `IGNORE_CLASS_PATTERNS` array in the extension source code.

---

## ⚠️ Known Issues

- Works best with **valid HTML** (not designed for severely malformed files).
- Generates **only selector structures**, not CSS properties.

---

## 📦 Release Notes

### **1.0.0**
- Initial release:
  - Extract SCSS from HTML.
  - Ignore unnecessary classes.
  - Prioritize special files (`index.html`, `under.html`, `main.html`).

---

**Author:** DatTQ
