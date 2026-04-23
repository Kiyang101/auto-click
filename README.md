# Auto Clicker Pro

A high-performance, cross-platform auto-clicker built with **Tauri**, **React**, and **Rust**. Designed for precision and ease of use, it allows for both single-point clicking and complex multi-target sequences with customizable intervals.

![Tauri](https://img.shields.io/badge/Tauri-FFC131?style=for-the-badge&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)

## ✨ Features

- **Single Click Mode**: Rapidly click at your current cursor position.
- **Multi-Target Mode**: Create multiple "Target" overlays on your screen to click specific locations in sequence or parallel.
- **Customizable Intervals**: Set independent click speeds for each target (from milliseconds to hours).
- **Global Hotkeys**: Start and stop clicking instantly using configurable keyboard shortcuts, even when the app is in the background.
- **Smart Overlays**: Interactive target markers that can be dragged and positioned anywhere.
- **Modern UI**: A sleek, dark-themed interface built with React and Vanilla CSS.
- **Safe Exit**: Automatically cleans up all overlay windows when the main application is closed.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Latest LTS version
- **Rust**: [Install Rust](https://www.rust-lang.org/tools/install)
- **System Dependencies**:
  - **Windows**: WebView2 (usually pre-installed on Windows 10/11)
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libwebkit2gtk-4.1` and other build essentials (see [Tauri docs](https://tauri.app/v1/guides/getting-started/prerequisites))

### Installation & Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Kiyang101/auto-click.git
   cd auto-click
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run tauri dev
   ```

4. **Build for production**:
   ```bash
   npm run tauri build
   ```

## ⌨️ Shortcuts (Default)

- **Single Mode**: `Ctrl + Shift + A`
- **Multi Mode**: `Ctrl + Shift + S`
- *Shortcuts can be redefined within the application settings.*

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Vanilla CSS
- **Backend**: Rust (Tauri v2)
- **Automation Library**: [Enigo](https://github.com/enigo-rs/enigo) for cross-platform input simulation.
- **macOS Specific**: Utilizes `core-graphics` for high-precision event posting and cursor warping prevention.

## ⚖️ License

MIT License - feel free to use and modify for your own projects!
