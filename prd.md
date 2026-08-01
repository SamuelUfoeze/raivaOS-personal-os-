Product Requirement Document (PRD)
Project RAIVA: 
Personal Operating System

1. Project Overview

1.1 DescriptionRAIVA is an integrated, offline-first personal operating system designed to optimize individual workflows, capture ideas, learn user patterns, build complex projects, and align daily actions with long-term ambitions. It leverages a messaging-first capture pipeline (WhatsApp/Telegram), local edge-AI for real-time mobile/desktop note contextualization, and an open-source automation engine (n8n) for advanced cloud-sync processing.

1.2 Target Market ConstraintsDesigned specifically for emerging markets (e.g., Nigeria, India) characterized by intermittent internet connectivity, expensive data bundles, and mid-to-low-tier consumer hardware.

1.3 Target PlatformsDesktop: Windows (Edge WebView2), macOS (Safari WebKit), Linux (WebKitGTK).Mobile & Tablet: Android (WebView), iOS (WKWebView).

1.4 Core Technology StackFrontend UI: React.js / Vue.js + TailwindCSS + Shadcn/ui (Compiled via Vite).Desktop/Mobile Core Runtime: Tauri 

2.0 (Rust backend).Local Database: SQLite (Offline-first, relational mapping, SQLCipher for encryption).Local AI Engine (Client): ONNX Runtime (Rust bindings) running quantized, tiny models.Cloud Automation & Processing: n8n (Self-hosted, Open-Source).Messaging Gateway: WhatsApp Business Cloud API / Twilio.2. Updated Architecture & AI Execution ModelTo avoid mobile packaging errors (like PyTorch/CUDA failures), the system splits AI execution by hardware capability:┌────────────────────────────────────────────────────────────────────────┐
│                          TAURI CLIENT APP                              │
│                                                                        │
│  ┌─────────────────────────┐            ┌───────────────────────────┐  │
│  │   UI (React / Vue)      │            │    Tauri Core (Rust)      │  │
│  │  • Interactive Maps     │◀──────────▶│   • SQLite Database       │  │
│  │  • Capture & Notes      │            │   • Encryption Engines    │  │
│  │  • Timers & Dashboards  │            └─────────────┬─────────────┘  │
│  └─────────────────────────┘                          │                │
│                                                       ▼                │
│                                         ┌───────────────────────────┐  │
│                                         │    ONNX Runtime Edge AI   │  │
│                                         │   • SmolLM2 / MiniLM      │  │
│                                         │   • Auto-tagging & Context│  │
│                                         └───────────────────────────┘  │
└───────────────────────────────────────────────▲────────────────────────┘
                                                │
                          (Sync via Webhooks / Local LAN WiFi)
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │    Cloud/Server (n8n)     │
                                  │   • Heavy AI Pipeline     │
                                  │   • WhatsApp Processing   │
                                  └───────────────────────────┘
3. Feature Breakdown 

Feature                         |  Technical Description            |    Target Platform    |   Priority     |     Complexity
Deep Self-UnderstandingGoal trees (5yr to quarterly) linked relationally to a local SQLite skill inventory schema.AllCriticalMediumMulti-Domain Knowledge HubInteractive graph views mapping project/note connections using canvas web libraries (e.g., Vis.js, D3.js).All (Mobile optimized)CriticalHighIntelligent Capture & NotesRich text editor supporting web clips, screenshots, and metadata markdown formatting.AllCriticalHighLocal Note AI ContextualizerEmbedded ONNX Runtime executing text classification and token parsing locally.All (Local models)CriticalHighGoal-to-Action PipelineAutomated local micro-task splitting, context tracking, Pomodoro engine, and 80/20 analytics.AllCriticalMediumSeamless Sync & n8n LinkBi-directional secure sync. Local network sync (via LAN WiFi webhooks) or Cloud sync via minimal HTTP payloads.AllHighHighMessaging GatewayIngestion of WhatsApp/Telegram text/media to n8n server, auto-routed to client DB via sync.Cloud-to-ClientHighMediumSmart System DeclutterBackground analysis of note usage patterns to suggest gentle archiving of stale information.Desktop OnlyMediumLow


4. Specific Technical Requirements

4.1 Local AI Constraints (The "No PyTorch on Android" Rule)
- Model Format: All local models must be in .onnx or .ort format.
- Mobile/Tablet AI: Restricted to lightweight text embeddings or tiny generative models (e.g., MiniLM-L6-H384 for tagging [~90MB] or SmolLM2-135M [~270MB]).
- Desktop AI: Can call a heavier secondary local binary (like headless llama.cpp) if the user opts to download a 1B–3B model locally.
- Hardware Acceleration: Rust bindings must map directly to Android NNAPI, Apple CoreML, and Windows DirectML via ONNX providers.

4.2 Offline-First Database Requirements
- Engine: SQLite running natively inside the Tauri Rust thread.
- Sync Logic: Every item contains an is_synced boolean, a last_modified timestamp, and a device_id UUID to prevent conflict loops during multi-device synchronization.

4.3 App Footprint & Deployment Targets
- App Binary Size: Desktop < 15MB, Mobile APK < 25MB (excluding downloaded AI models).
- Idle Memory Profile: < 50MB RAM across all platforms.

5. Phased Development Steps
Phase 1: Foundation & Cross-Platform Verification
- Initialize Tauri 2.0 workspace with selected UI framework (React/Vue + Vite).
- Configure build pipelines for Windows, macOS, Linux, Android, and iOS.
- Milestone Goal: Generate working installer files (.exe, .dmg, .apk, .app) for an empty "Hello World" screen on all target operating systems.
Phase 2: Offline Data & Core UI
- Implement the Rust native SQLite database connector layer.
- Build the interactive Goal Mapping and Knowledge Hub UI using TailwindCSS and D3.js/Vis.js.
- Implement the core note-taking canvas and rich editor interface.
Phase 3: Local AI Integration (ONNX Edge Layer)
- Integrate the onnxruntime crate into Tauri's Rust backend.
- Embed a 90MB MiniLM token classification model into the asset bundle.
- Build the native text parsing commands to execute auto-tagging functions instantly when a note is saved offline.
Phase 4: Sync Pipeline & n8n Webhooks
- Set up local discovery hooks (or simple local IP inputs) for zero-internet LAN sync.
- Connect external cloud database sync profiles to feed into the self-hosted n8n engine.
- Configure the WhatsApp Cloud API webhook receiver within n8n to parse incoming text messages and buffer them for client download.
Phase 5: Production Polish & Security
- Add full database encryption using SQLCipher via the Tauri backend.
- Implement performance benchmarking on lower-tier Android hardware.
- Final deployment packaging.

6. Code Quality Checklist
- Zero execution of heavy Python interpreters or PyTorch scripts on the client app.
- Strict isolation of UI components from backend Rust database logic (Command pattern).
- Responsive design verification: UI fluidly scales from a 6.1-inch smartphone to a widescreen PC.
- Memory leak checks: WebViews and Rust background processes release unused variables upon tab/view destruction.Elegant fallback handling: App functions normally without crashing if the ONNX model fails to load due to low device RAM.







# Product Requirement Document (PRD)
## Project RAIVA: Personal Operating System

---

## 1. Project Overview

### 1.1 Description
RAIVA is an integrated, offline-first personal operating system designed to optimize individual workflows, capture ideas, learn user patterns, build complex projects, and align daily actions with long-term ambitions. It leverages a messaging-first capture pipeline (WhatsApp/Telegram), local edge-AI for real-time mobile/desktop note contextualization, and an open-source automation engine (n8n) for advanced cloud-sync processing.

### 1.2 Target Market Constraints
Designed specifically for emerging markets (e.g., Nigeria, India) characterized by intermittent internet connectivity, expensive data bundles, and mid-to-low-tier consumer hardware. 

### 1.3 Target Platforms
* **Desktop:** Windows (Edge WebView2), macOS (Safari WebKit), Linux (WebKitGTK).
* **Mobile & Tablet:** Android (WebView), iOS (WKWebView).

### 1.4 Core Technology Stack
* **Frontend UI:** React.js / Vue.js + TailwindCSS + Shadcn/ui (Compiled via Vite).
* **Desktop/Mobile Core Runtime:** Tauri 2.0 (Rust backend).
* **Local Database:** SQLite (Offline-first, relational mapping, SQLCipher for encryption).
* **Local AI Engine (Client):** ONNX Runtime (Rust bindings) running quantized, tiny models.
* **Cloud Automation & Processing:** n8n (Self-hosted, Open-Source).
* **Messaging Gateway:** WhatsApp Business Cloud API / Twilio.

---

## 2. Architecture & AI Execution Model

To avoid mobile packaging errors (like PyTorch/CUDA compilation failures), the system cleanly splits UI and AI execution profiles:

┌────────────────────────────────────────────────────────────────────────┐
│                          TAURI CLIENT APP                              ││                                                                        ││  ┌─────────────────────────┐            ┌───────────────────────────┐  ││  │   UI (React / Vue)      │            │    Tauri Core (Rust)      │  ││  │  • Interactive Maps     │◀──────────▶│   • SQLite Database       │  ││  │  • Capture & Notes      │            │   • Encryption Engines    │  ││  │  • Timers & Dashboards  │            └─────────────┬─────────────┘  ││  └─────────────────────────┘                          │                ││                                                       ▼                ││                                         ┌───────────────────────────┐  ││                                         │    ONNX Runtime Edge AI   │  ││                                         │   • SmolLM2 / MiniLM      │  ││                                         │   • Auto-tagging & Context│  ││                                         └───────────────────────────┘  │└───────────────────────────────────────────────▲────────────────────────┘│(Sync via Webhooks / Local LAN WiFi)│▼┌───────────────────────────┐│    Cloud/Server
(n8n)     ││   • Heavy AI Pipeline     ││   • WhatsApp Processing   │└───────────────────────────┘





---

## 3. Feature Breakdown


| Feature | Technical Description | Target Platform | Priority | Complexity |
| :--- | :--- | :--- | :--- | :--- |
| **Deep Self-Understanding** | Goal trees (5yr to quarterly) linked relationally to a local SQLite skill inventory schema. | All | Critical | Medium |
| **Multi-Domain Knowledge Hub** | Interactive graph views mapping project/note connections using canvas web libraries (e.g., Vis.js, D3.js). | All (Mobile optimized) | Critical | High |
| **Intelligent Capture & Notes** | Rich text editor supporting web clips, screenshots, and metadata markdown formatting. | All | Critical | High |
| **Local Note AI Contextualizer** | Embedded ONNX Runtime executing text classification and token parsing locally. | All (Local models) | Critical | High |
| **Goal-to-Action Pipeline** | Automated local micro-task splitting, context tracking, Pomodoro engine, and 80/20 analytics. | All | Critical | Medium |
| **Seamless Sync & n8n Link** | Bi-directional secure sync. Local network sync (via LAN WiFi webhooks) or Cloud sync via minimal HTTP payloads. | All | High | High |
| **Messaging Gateway** | Ingestion of WhatsApp/Telegram text/media to n8n server, auto-routed to client DB via sync. | Cloud-to-Client | High | Medium |
| **Smart System Declutter** | Background analysis of note usage patterns to suggest gentle archiving of stale information. | Desktop Only | Medium | Low |

---

## 4. Specific Technical Requirements

### 4.1 Local AI Constraints (The "No PyTorch on Android" Rule)
* **Model Format:** All local models must be explicitly converted to `.onnx` or `.ort` format.
* **Mobile/Tablet AI:** Restricted to lightweight text embeddings or tiny generative models (e.g., `MiniLM-L6-H384` for tagging [~90MB] or `SmolLM2-135M` [~270MB]).
* **Desktop AI:** Can call a heavier secondary local binary (like headless `llama.cpp`) if the user opts to download a larger 1B–3B model locally.
* **Hardware Acceleration:** Rust bindings must map directly to native platform accelerators: Android NNAPI, Apple CoreML, and Windows DirectML via ONNX providers.

### 4.2 Offline-First Database Requirements
* **Engine:** SQLite running natively inside the Tauri Rust thread environment.
* **Sync Logic:** Every data row contains an `is_synced` boolean, a `last_modified` timestamp, and a `device_id` UUID to prevent conflict loops during multi-device synchronization.

### 4.3 App Footprint & Deployment Targets
* **App Binary Size:** Desktop target < 15MB, Mobile APK target < 25MB (excluding downloaded AI models).
* **Idle Memory Profile:** < 50MB RAM across all operating systems.

---

## 5. Phased Development Steps

### Phase 1: Foundation & Cross-Platform Verification
1. Initialize Tauri 2.0 workspace with selected UI framework (React/Vue + Vite).
2. Configure cross-compilation build pipelines for Windows, macOS, Linux, Android, and iOS.
3. **Milestone Goal:** Generate working installer files (`.exe`, `.dmg`, `.apk`, `.app`) for an empty "Hello World" screen on all target operating systems.

### Phase 2: Offline Data & Core UI
1. Implement the Rust native SQLite database connector layer.
2. Build the interactive Goal Mapping and Knowledge Hub UI using TailwindCSS and D3.js/Vis.js.
3. Implement the core note-taking canvas and rich editor interface.

### Phase 3: Local AI Integration (ONNX Edge Layer)
1. Integrate the `onnxruntime` crate into Tauri's Rust backend.
2. Embed a 90MB `MiniLM` token classification model into the native asset bundle.
3. Build the native text parsing commands to execute auto-tagging functions instantly when a note is saved offline.

### Phase 4: Sync Pipeline & n8n Webhooks
1. Set up local discovery hooks (or simple local IP inputs) for zero-internet LAN sync.
2. Connect external cloud database sync profiles to feed into the self-hosted n8n engine.
3. Configure the WhatsApp Cloud API webhook receiver within n8n to parse incoming text messages and buffer them for client download.

### Phase 5: Production Polish & Security
1. Add full database encryption using SQLCipher via the Tauri backend.
2. Implement performance benchmarking on lower-tier Android hardware.
3. Final deployment packaging.

---

## 6. Code Quality Checklist

- [ ] Zero execution of heavy Python interpreters or PyTorch scripts on the client app.
- [ ] Strict isolation of UI components from backend Rust database logic (Command pattern).
- [ ] Responsive design verification: UI fluidly scales from a 6.1-inch smartphone to a widescreen PC.
- [ ] Memory leak checks: WebViews and Rust background processes release unused variables upon tab/view destruction.
- [ ] Elegant fallback handling: App functions normally without crashing if the ONNX model fails to load due to low device RAM.

