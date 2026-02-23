# 🚀 NeoCast — Real-time Handwriting Collaboration Platform (Demo)

This repository contains the **Demo Version** of NeoCast, optimized for showcasing real-time handwriting collaboration and remote annotation features.

> **Note:** This project was developed and refined using **Anthropic's Claude Code (Agentic Coding AI)**.

---

## 📌 Project Overview

NeoCast is a session-based collaboration platform designed for real-time education and feedback. This demo focuses on the **Annotation (Red-pen) Workflow**, allowing hosts to monitor multiple students simultaneously and provide direct feedback on their canvases.

## ✨ Key Features (Implemented in Demo)

- **Real-time Stroke Sync**: Ultra-low latency handwriting synchronization using binary data and pako compression.
- **Monitoring Mode**: A dashboard for hosts to view all connected students' screens in a live grid.
- **Remote Annotation**: Hosts can enter a student's view and draw corrections (the "Red Pen" feature) which appear in real-time on the student's device.
- **Simplified Session Entry**: Quick access via nickname and session code, removing complex auth hurdles for the demo.
- **AI Analysis Preview**: Mock-up and UI implementation of student achievement reports based on session activity.

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Node.js, Socket.IO
- **Communication**: Socket.IO (Namespaces: `/stroke`, `/control`)
- **Data Compression**: Pako (zlib) for binary handwriting data
- **Styling**: Modern, premium CSS with rich aesthetics and responsive layouts

## 🚀 Getting Started

The demo is designed to be easy to run in a local environment.

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Quick Start

Run the following command in the root directory:

```bash
sh demo-start.sh
```

This script will simultaneously start:
- **Server**: [http://localhost:3001](http://localhost:3001)
- **Client**: [http://localhost:3000](http://localhost:3000)

## 📂 Repository Structure (dev branch)

- `/client`: React application containing the monitoring views, canvases, and student reports.
- `/server`: Node.js server handling socket connections and session state in-memory.
- `demo-start.sh`: Shell script for one-click startup.

---

## 🤖 Developed with Claude Code

The entire structure, implementation of real-time logic, and the premium UI design of this demo were orchestrated by **Claude Code**. 
- **Automated Implementation**: Rapid prototyping of complex features like binary stroke handling.
- **Design Excellence**: Curated color palettes and smooth animations for a premium user experience.
- **Integrated Environment**: Seamless development from plan to deployment.

---

**Branch Info:** This is the `dev` branch. `main` is reserved for stable releases.
