# DeltaHours

Track billable hours per job. Start a timer or log entries manually — everything autosaves to a JSON file, no save button anywhere.

Built with the same stack as [DeltaMeshFlasher](https://github.com/DeltaPlusProtoTyping/DeltaMeshFlasher): Electron + TypeScript, no framework.

## Features

- **Jobs** with a name, hourly rate, and color
- **Timer** — one click to start/stop; starting a timer on another job stops and logs the current one; a running timer survives an app restart
- **Manual entries** — add or edit start/end times and notes
- **Summary** — tracked hours and billable amount per job for today, this week, this month, or all time
- **Autosave** — every change is debounced and written atomically to JSON
- **Themes** — Dark, Midnight, Nord, Light, Sepia, plus a custom accent color and currency symbol

## Data

Everything lives in one JSON file in the app's user-data folder
(`%APPDATA%/deltahours/deltahours-data.json` on Windows). Settings → *Open data folder* jumps straight to it.

## Development

```sh
npm install
npm start        # build + run
npm run dist     # build installers via electron-builder
```

Layout mirrors DeltaMeshFlasher:

- `src/main` — Electron main process (window, JSON store, IPC)
- `src/preload` — context bridge
- `src/renderer` — UI logic (compiled separately via `tsconfig.renderer.json`)
- `static` — HTML + CSS
