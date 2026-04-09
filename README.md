# PerfScope

A mini [Apple Instruments](https://developer.apple.com/instruments/)-style profiling and visualization tool. Built with a **Rust** backend and **React + D3.js** frontend.

**Live demo:** [helena-f.github.io/performance-analytics](https://helena-f.github.io/performance-analytics/)

---

## What it does

PerfScope is a real-time performance profiler with three main views:

### Timeline View
Four synchronized tracks displaying live-updating D3.js area charts:
- **CPU Usage** — per-core and aggregate CPU utilization
- **Memory** — RSS and virtual memory tracking with allocation estimates
- **Disk I/O** — read/write throughput with burst detection
- **Energy Impact** — CPU/GPU energy and thermal state (modeled after Instruments' Energy Log)

### Flame Graph
Interactive, zoomable flame graph built from stack samples:
- Color-coded by module (MyApp, SwiftUI, UIKit, CoreAnimation, Foundation, libdispatch)
- Click any frame to zoom in, hover for sample counts and percentages
- Built client-side from streamed stack trace data

### SwiftUI Inefficiency Detector
Detects six categories of SwiftUI performance issues:
- **Excessive Body Recomputation** — views recomputed too frequently due to state invalidation
- **Unnecessary State Change** — `@State` set to its current value, triggering redundant updates
- **Heavy View Init** — expensive work in `init()` instead of `.onAppear`/`.task`
- **Unbatched Updates** — multiple `@Published` changes causing separate view updates
- **Main Thread Blocking** — synchronous work blocking the main thread during body evaluation
- **Large View Hierarchy** — deep hierarchies slowing down SwiftUI's diffing

Each issue includes severity, description, and a suggested fix with Swift code examples.

---

## Architecture

```
┌─────────────────────────────────┐     WebSocket (4Hz)      ┌──────────────────────────┐
│         React Frontend          │ ◄──────────────────────► │     Rust Backend         │
│  TypeScript + D3.js + Tailwind  │                          │  Actix-web + sysinfo     │
│                                 │     REST API             │                          │
│  - Timeline tracks (D3 charts)  │ ◄──────────────────────► │  - CPU profiler          │
│  - Flame graph (D3 + zoom)      │                          │  - Memory profiler       │
│  - SwiftUI detector panel       │     /api/health          │  - Stack sampler         │
│  - Toolbar + live stats         │     /api/processes       │  - I/O + Energy sampler  │
│                                 │     /api/flamegraph      │  - SwiftUI analyzer      │
└─────────────────────────────────┘                          └──────────────────────────┘
```

**Frontend** (`frontend/`) — React 18, TypeScript, D3.js v7, Tailwind CSS, Vite

**Backend** (`backend/`) — Rust, Actix-web, sysinfo crate, WebSocket streaming

The frontend has two modes:
- **Live mode** — connects to the Rust backend via WebSocket for real system data
- **Demo mode** — generates realistic simulated profiling data client-side (no backend needed)

Mode is auto-detected on startup by hitting `/api/health`.

---

## Running locally

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (v1.86+)

### Frontend only (demo mode)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Record** to start profiling with simulated data.

### Full stack (live mode)

**Terminal 1 — start the backend:**
```bash
cd backend
cargo run
```

The backend starts on `http://localhost:8080`. Verify with:
```bash
curl http://localhost:8080/api/health
```

**Terminal 2 — start the frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The status bar will show **green "Live (backend)"**. Click **Record** to stream real CPU/memory data from your machine.

### API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/processes` | List running processes (sorted by CPU usage) |
| `GET /api/flamegraph` | Generate a flame graph from sampled stacks |
| `WS /ws/profile` | WebSocket — streams live profiling events at 4Hz |

### WebSocket event types

The `/ws/profile` WebSocket streams JSON events with `type` and `data` fields:

- `SessionStarted` — session ID assigned
- `CpuUpdate` — CPU usage sample (per-core + aggregate)
- `MemoryUpdate` — RSS, virtual memory, allocation counts
- `IoUpdate` — disk read/write, network rx/tx
- `EnergyUpdate` — CPU/GPU energy, thermal state
- `StackCapture` — call stack sample with frames and weights
- `SwiftUIIssue` — detected SwiftUI inefficiency

---

## Deployment

### Backend (Fly.io)

The backend is deployed at `https://perfscope-api.fly.dev`.

To redeploy:
```bash
cd backend
flyctl deploy --local-only
```

Requires [flyctl](https://fly.io/docs/flyctl/install/) and Docker Desktop.

### Frontend (GitHub Pages)

The frontend is deployed at `https://helena-f.github.io/performance-analytics/`.

To redeploy:
```bash
cd frontend
npm run build

# Switch to gh-pages branch and copy build output
cd ..
git checkout gh-pages
rm -rf assets index.html
cp frontend/dist/index.html .
cp -r frontend/dist/assets .
git add .
git commit -m "Deploy"
git push origin gh-pages --force
git checkout main
```

---

## Project structure

```
├── backend/
│   ├── Cargo.toml
│   ├── Dockerfile
│   ├── fly.toml
│   └── src/
│       ├── main.rs                  # Actix-web server setup
│       ├── models/mod.rs            # Data types (samples, events, issues)
│       ├── api/
│       │   ├── routes.rs            # REST endpoints
│       │   └── ws.rs                # WebSocket handler
│       └── profiler/
│           ├── cpu.rs               # CPU sampling via sysinfo
│           ├── memory.rs            # Memory tracking
│           ├── sampler.rs           # Stack sampling + flame graph builder
│           └── swiftui.rs           # SwiftUI issue detection
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── App.tsx                  # Main app with mode detection
│       ├── types/index.ts           # TypeScript types
│       ├── hooks/
│       │   ├── useProfiler.ts       # Live backend connection
│       │   └── useDemoProfiler.ts   # Client-side simulation
│       ├── utils/
│       │   ├── format.ts            # Formatting helpers
│       │   └── flamegraph.ts        # Flame graph builder
│       └── components/
│           ├── Toolbar/             # Record/stop, tabs, live stats
│           ├── Timeline/            # D3.js multi-track timeline
│           ├── FlameGraph/          # Interactive flame graph
│           └── SwiftUIDetector/     # Issue list + detail panel
└── README.md
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend runtime | Rust + Actix-web |
| System profiling | sysinfo crate |
| Data streaming | WebSocket (actix-ws) |
| Frontend framework | React 18 + TypeScript |
| Visualization | D3.js v7 |
| Styling | Tailwind CSS |
| Build tool | Vite |
| Backend hosting | Fly.io |
| Frontend hosting | GitHub Pages |
