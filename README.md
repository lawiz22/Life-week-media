# 🦅 LifeWeeks Media

> **Your Life, Your Memories, Your Legacy.**
> *Visualized in weeks, organized for eternity.*

LifeWeeks Media is a powerful, local-first desktop application designed to bridge the gap between your life's timeline and your digital footprint. It combines the philosophical perspective of "Life in Weeks" with a robust media management system, allowing you to curate, explore, and cherish your digital library without relying on the cloud.

---

## ✨ Features

### 📅 Life in Weeks Visualization
- **Memento Mori**: Visualize your entire life in a grid of 4,680 weeks (90 years).
- **Stage Tracking**: Customize life stages (Early Years, School, Career, Retirement) with distinct colors.
- **Personalized**: Set your date of birth to see exactly where you stand today.

### 📂 Intelligent Media Scanning
- **Deep Scan**: Recursively scan specific folders or entire drives for your digital assets.
- **Smart Filtering**: Automatically categorizes files into:
  - 🖼️ **Pictures**: `.jpg`, `.png`, `.gif`, `.webp` (with auto-generated thumbnails!)
  - 🎥 **Videos**: `.mp4`, `.mov`, `.avi`, `.mkv`
  - 🎵 **Music**: `.mp3`, `.wav`, `.flac`
  - 📄 **Documents**: `.pdf`, `.doc`, `.txt`
  - 🛠️ **Projects**: *(Coming Soon)* Specialized handling for DAW & IDE projects.
- **Duplicate Detection**: Identify and manage duplicate files based on content hash, not just filenames.

### ⚡ Performance & Privacy
- **Local SQLite Database**: All metadata is stored locally using SQLite. No data leaves your machine.
- **High-Performance**: Built with Rust-based tooling (SWC/Vite) and hardware-accelerated image processing (Sharp).
- **Privacy First**: Your memories belong to you. No cloud sync, no tracking, no subscriptions.

---

## 🛠️ Technology Stack

We use a cutting-edge stack to deliver a fast, native-like experience:

- **Core**: [Electron](https://www.electronjs.org/) (Chromium + Node.js)
- **Frontend**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/) (Blazing fast HMR)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Utility-first design)
- **Database**: [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) + [Drizzle ORM](https://orm.drizzle.team/)
- **Image Processing**: [Sharp](https://sharp.pixelplumbing.com/) (Fast image resizing & conversion)

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18 or higher recommended.
- **npm**: Included with Node.js.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/Life-week-media.git
   cd Life-week-media
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### 🏃 Running in Development Mode
Start the Vite dev server and Electron main process simultaneously with hot-reload:
```bash
npm run dev
```
*The app window should appear, and changes to `src/` or `electron/` will trigger auto-reloads.*

### 📦 Building for Production
Create an optimized executable for your OS:
```bash
npm run build
```
The output (installer/executable) will be generated in the `release/` or `dist/` directory.

---

## 🧪 Testing

### Manual Verification
1. **Launch the App**: Run `npm run dev`.
2. **Import Media**:
   - Go to the sidebar and click **Import Media**.
   - Check **"Include Subfolders"** if you want a deep scan.
   - Select a folder with mixed media.
   - Watch the **Progress Modal** center-screen as it scans.
3. **Verify Data**:
   - Once complete, check the **Pictures**, **Video**, etc., tabs.
   - Ensure thumbnails appear for images.
4. **Duplicates**:
   - Import the same folder again.
   - Go to the **Duplicates** tab to see if they were caught.
5. **Settings**:
   - Go to **Settings**, change your Date of Birth, and verify the "Life in Weeks" grid updates.

---

## 📝 Roadmap
- [ ] **Project Importing**: Special handling for `.als`, `.prproj`, etc.
- [ ] **Timeline View**: Map media items to specific weeks in your life grid.
- [ ] **Tagging System**: Add custom tags to organize media beyond folders.
- [ ] **Video Previews**: Hover-to-play for video files.

---

*Built with ❤️ by Louis-Martin Richard*
