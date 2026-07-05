interface Job {
  id: string;
  name: string;
  rate: number;
  color: string;
  createdAt: string;
}

interface Entry {
  id: string;
  jobId: string;
  start: string; // ISO
  end: string; // ISO
  note: string;
}

interface ActiveTimer {
  jobId: string;
  start: string; // ISO
}

interface Settings {
  theme: string;
  accent: string;
  currency: string;
}

interface AppData {
  version: 1;
  jobs: Job[];
  entries: Entry[];
  activeTimer: ActiveTimer | null;
  settings: Settings;
}

// Loaded as a classic script (no imports/exports), so this merges into the global Window type.
interface Window {
  hours: {
    loadData: () => Promise<unknown>;
    saveData: (data: AppData) => Promise<{ ok: boolean; error?: string }>;
    openDataFolder: () => Promise<void>;
  };
}

const THEMES: Record<string, Record<string, string>> = {
  dark: {
    "--bg": "#14161a", "--panel": "#1d2026", "--panel-hover": "#23262d",
    "--border": "#2e323a", "--text": "#e6e8eb", "--muted": "#9aa1ab",
  },
  midnight: {
    "--bg": "#0b0e14", "--panel": "#121722", "--panel-hover": "#1a2130",
    "--border": "#232c3d", "--text": "#dbe2ef", "--muted": "#8792a6",
  },
  nord: {
    "--bg": "#2e3440", "--panel": "#3b4252", "--panel-hover": "#434c5e",
    "--border": "#4c566a", "--text": "#eceff4", "--muted": "#a8b2c2",
  },
  light: {
    "--bg": "#f4f5f7", "--panel": "#ffffff", "--panel-hover": "#f0f1f3",
    "--border": "#d9dce1", "--text": "#1f2328", "--muted": "#6a7280",
  },
  sepia: {
    "--bg": "#f3ead9", "--panel": "#fbf5e9", "--panel-hover": "#f0e6d2",
    "--border": "#dccfb4", "--text": "#3d3426", "--muted": "#8a7d63",
  },
};

const JOB_COLORS = ["#57ab5a", "#539bf5", "#e0823d", "#b083f0", "#e5534b", "#39c5cf", "#c69026", "#ec8cb3"];

const defaultData = (): AppData => ({
  version: 1,
  jobs: [],
  entries: [],
  activeTimer: null,
  settings: { theme: "dark", accent: "#57ab5a", currency: "$" },
});

let data: AppData = defaultData();
let selectedJobId: string | null = null;
let summaryPeriod: "day" | "week" | "month" | "all" = "week";
let editingJobId: string | null = null;
let editingEntryId: string | null = null;
let pickedColor = JOB_COLORS[0];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- persistence ----------

let saveTimer: number | undefined;
let savePending = false;

function scheduleSave() {
  savePending = true;
  $("save-status").textContent = "Saving…";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, 500);
}

async function flushSave() {
  if (!savePending) return;
  savePending = false;
  const result = await window.hours.saveData(data);
  $("save-status").textContent = result.ok ? "All changes saved" : `Save failed: ${result.error ?? "unknown"}`;
}

/** Every mutation goes through this: re-render + autosave. */
function mutate(fn: () => void) {
  fn();
  render();
  scheduleSave();
}

// ---------- formatting helpers ----------

function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function fmtMoney(amount: number): string {
  return `${data.settings.currency}${amount.toFixed(2)}`;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function toLocalInputValue(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function entryMs(e: Entry): number {
  return Math.max(0, new Date(e.end).getTime() - new Date(e.start).getTime());
}

function periodStart(period: typeof summaryPeriod): Date | null {
  const now = new Date();
  if (period === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const day = (now.getDay() + 6) % 7; // Monday = 0
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

// ---------- theming ----------

function applyTheme() {
  const theme = THEMES[data.settings.theme] ?? THEMES.dark;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) root.style.setProperty(key, value);
  root.style.setProperty("--accent", data.settings.accent);
}

// ---------- rendering ----------

function render() {
  renderJobList();
  renderDetail();
}

function renderJobList() {
  const list = $("job-list");
  list.textContent = "";

  if (data.jobs.length === 0) {
    const empty = el("p", "empty-hint", "No jobs yet. Create one to start tracking.");
    list.append(empty);
    return;
  }

  for (const job of data.jobs) {
    const row = el("button", "job-row" + (job.id === selectedJobId ? " selected" : ""));
    row.type = "button";

    const dot = el("span", "job-dot");
    dot.style.background = job.color;

    const info = el("div", "job-info");
    info.append(el("span", "job-name", job.name));
    const weekMs = jobTotalMs(job.id, periodStart("week"));
    info.append(el("span", "job-sub", `${fmtDuration(weekMs)} this week`));

    row.append(dot, info);
    if (data.activeTimer?.jobId === job.id) row.append(el("span", "running-dot", "●"));

    row.addEventListener("click", () => {
      selectedJobId = job.id;
      render();
    });
    list.append(row);
  }
}

function jobEntries(jobId: string, since: Date | null): Entry[] {
  return data.entries.filter(
    (e) => e.jobId === jobId && (since === null || new Date(e.start) >= since)
  );
}

function jobTotalMs(jobId: string, since: Date | null): number {
  return jobEntries(jobId, since).reduce((sum, e) => sum + entryMs(e), 0);
}

function renderDetail() {
  const detail = $("detail");
  detail.textContent = "";

  const job = data.jobs.find((j) => j.id === selectedJobId);
  if (!job) {
    const placeholder = el("div", "placeholder");
    placeholder.append(el("h2", undefined, "Welcome to DeltaHours"));
    placeholder.append(el("p", undefined, "Select a job on the left, or create a new one to start the clock."));
    detail.append(placeholder);
    return;
  }

  // Job header
  const head = el("div", "detail-head");
  const title = el("div", "detail-title");
  const dot = el("span", "job-dot big");
  dot.style.background = job.color;
  title.append(dot, el("h2", undefined, job.name));
  const rate = el("span", "rate-badge", `${fmtMoney(job.rate)}/h`);
  title.append(rate);

  const actions = el("div", "detail-actions");
  const editBtn = el("button", "ghost", "✎ Edit");
  editBtn.addEventListener("click", () => openJobDialog(job));
  const deleteBtn = el("button", "danger", "Delete");
  deleteBtn.addEventListener("click", () => {
    const count = data.entries.filter((e) => e.jobId === job.id).length;
    if (!confirm(`Delete "${job.name}" and its ${count} time entr${count === 1 ? "y" : "ies"}?`)) return;
    mutate(() => {
      data.entries = data.entries.filter((e) => e.jobId !== job.id);
      data.jobs = data.jobs.filter((j) => j.id !== job.id);
      if (data.activeTimer?.jobId === job.id) data.activeTimer = null;
      selectedJobId = data.jobs[0]?.id ?? null;
    });
  });
  actions.append(editBtn, deleteBtn);
  head.append(title, actions);
  detail.append(head);

  // Timer card
  const timerCard = el("div", "card timer-card");
  const running = data.activeTimer?.jobId === job.id;
  const display = el("div", "timer-display", running ? fmtClock(Date.now() - new Date(data.activeTimer!.start).getTime()) : "0:00:00");
  display.id = "timer-display";
  const timerBtn = el("button", running ? "danger big-btn" : "accent big-btn", running ? "■ Stop" : "▶ Start");
  timerBtn.addEventListener("click", () => toggleTimer(job.id));
  timerCard.append(display, timerBtn);
  if (data.activeTimer && data.activeTimer.jobId !== job.id) {
    const other = data.jobs.find((j) => j.id === data.activeTimer!.jobId);
    timerCard.append(el("p", "hint", `Timer running on "${other?.name ?? "?"}" — starting here stops it and logs the time.`));
  }
  detail.append(timerCard);

  // Summary card
  const summary = el("div", "card summary-card");
  const summaryHead = el("div", "summary-head");
  summaryHead.append(el("h3", undefined, "Summary"));
  const periodSelect = el("select") as HTMLSelectElement;
  const periods: [typeof summaryPeriod, string][] = [
    ["day", "Today"], ["week", "This week"], ["month", "This month"], ["all", "All time"],
  ];
  for (const [value, label] of periods) {
    const opt = el("option", undefined, label) as HTMLOptionElement;
    opt.value = value;
    periodSelect.append(opt);
  }
  periodSelect.value = summaryPeriod;
  periodSelect.addEventListener("change", () => {
    summaryPeriod = periodSelect.value as typeof summaryPeriod;
    render();
  });
  summaryHead.append(periodSelect);
  summary.append(summaryHead);

  const totalMs = jobTotalMs(job.id, periodStart(summaryPeriod));
  const totals = el("div", "totals");
  const hoursBox = el("div", "total-box");
  hoursBox.append(el("span", "total-value", fmtDuration(totalMs)), el("span", "total-label", "tracked"));
  const moneyBox = el("div", "total-box");
  moneyBox.append(el("span", "total-value", fmtMoney((totalMs / 3600000) * job.rate)), el("span", "total-label", "billable"));
  totals.append(hoursBox, moneyBox);
  summary.append(totals);
  detail.append(summary);

  // Entries
  const entriesCard = el("div", "card entries-card");
  const entriesHead = el("div", "summary-head");
  entriesHead.append(el("h3", undefined, "Entries"));
  const addEntry = el("button", "ghost", "+ Add entry");
  addEntry.addEventListener("click", () => openEntryDialog(job.id, null));
  entriesHead.append(addEntry);
  entriesCard.append(entriesHead);

  const list = el("div", "entry-list");
  const entries = data.entries
    .filter((e) => e.jobId === job.id)
    .sort((a, b) => b.start.localeCompare(a.start));

  if (entries.length === 0) {
    list.append(el("p", "empty-hint", "No entries yet — start the timer or add one manually."));
  }

  for (const entry of entries) {
    const row = el("div", "entry-row");
    const start = new Date(entry.start);
    const end = new Date(entry.end);
    const when = el("div", "entry-when");
    when.append(el("span", "entry-date", fmtDay(start)));
    when.append(el("span", "entry-times", `${fmtTime(start)} – ${fmtTime(end)}`));

    const mid = el("div", "entry-mid");
    mid.append(el("span", "entry-duration", fmtDuration(entryMs(entry))));
    mid.append(el("span", "entry-amount", fmtMoney((entryMs(entry) / 3600000) * job.rate)));

    const note = el("span", "entry-note", entry.note);

    const rowActions = el("div", "entry-actions");
    const edit = el("button", "icon-btn", "✎");
    edit.title = "Edit entry";
    edit.addEventListener("click", () => openEntryDialog(job.id, entry));
    const del = el("button", "icon-btn danger-text", "✕");
    del.title = "Delete entry";
    del.addEventListener("click", () => {
      if (!confirm("Delete this entry?")) return;
      mutate(() => {
        data.entries = data.entries.filter((e) => e.id !== entry.id);
      });
    });
    rowActions.append(edit, del);

    row.append(when, mid, note, rowActions);
    list.append(row);
  }
  entriesCard.append(list);
  detail.append(entriesCard);
}

// ---------- timer ----------

function toggleTimer(jobId: string) {
  mutate(() => {
    const wasRunningHere = data.activeTimer?.jobId === jobId;
    stopTimerIntoEntry();
    if (!wasRunningHere) data.activeTimer = { jobId, start: new Date().toISOString() };
  });
}

function stopTimerIntoEntry() {
  if (!data.activeTimer) return;
  const { jobId, start } = data.activeTimer;
  const end = new Date().toISOString();
  if (new Date(end).getTime() - new Date(start).getTime() >= 1000) {
    data.entries.push({ id: crypto.randomUUID(), jobId, start, end, note: "" });
  }
  data.activeTimer = null;
}

setInterval(() => {
  const display = document.getElementById("timer-display");
  if (display && data.activeTimer && data.activeTimer.jobId === selectedJobId) {
    display.textContent = fmtClock(Date.now() - new Date(data.activeTimer.start).getTime());
  }
  document.title = data.activeTimer
    ? `▶ ${fmtClock(Date.now() - new Date(data.activeTimer.start).getTime())} — DeltaHours`
    : "DeltaHours";
}, 1000);

// ---------- dialogs ----------

function renderColorRow() {
  const rowEl = $("job-colors");
  rowEl.textContent = "";
  for (const color of JOB_COLORS) {
    const swatch = el("button", "swatch" + (color === pickedColor ? " picked" : ""));
    swatch.type = "button";
    swatch.style.background = color;
    swatch.addEventListener("click", () => {
      pickedColor = color;
      renderColorRow();
    });
    rowEl.append(swatch);
  }
}

function openJobDialog(job: Job | null) {
  editingJobId = job?.id ?? null;
  $("job-dialog-title").textContent = job ? "Edit job" : "New job";
  ($("job-name") as HTMLInputElement).value = job?.name ?? "";
  ($("job-rate") as HTMLInputElement).value = String(job?.rate ?? 0);
  pickedColor = job?.color ?? JOB_COLORS[data.jobs.length % JOB_COLORS.length];
  renderColorRow();
  ($("job-dialog") as HTMLDialogElement).showModal();
}

function openEntryDialog(jobId: string, entry: Entry | null) {
  editingEntryId = entry?.id ?? null;
  $("entry-dialog-title").textContent = entry ? "Edit entry" : "Add entry";
  const now = new Date();
  const start = entry ? new Date(entry.start) : new Date(now.getTime() - 3600000);
  const end = entry ? new Date(entry.end) : now;
  ($("entry-start") as HTMLInputElement).value = toLocalInputValue(start);
  ($("entry-end") as HTMLInputElement).value = toLocalInputValue(end);
  ($("entry-note") as HTMLInputElement).value = entry?.note ?? "";
  $("entry-error").hidden = true;
  ($("entry-dialog") as HTMLDialogElement).showModal();
}

function wireDialogs() {
  const jobDialog = $("job-dialog") as HTMLDialogElement;
  $("job-cancel").addEventListener("click", () => jobDialog.close());
  $("job-form").addEventListener("submit", () => {
    const name = ($("job-name") as HTMLInputElement).value.trim();
    const rate = Math.max(0, Number(($("job-rate") as HTMLInputElement).value) || 0);
    if (!name) return;
    mutate(() => {
      if (editingJobId) {
        const job = data.jobs.find((j) => j.id === editingJobId);
        if (job) Object.assign(job, { name, rate, color: pickedColor });
      } else {
        const job: Job = {
          id: crypto.randomUUID(),
          name,
          rate,
          color: pickedColor,
          createdAt: new Date().toISOString(),
        };
        data.jobs.push(job);
        selectedJobId = job.id;
      }
    });
  });

  const entryDialog = $("entry-dialog") as HTMLDialogElement;
  $("entry-cancel").addEventListener("click", () => entryDialog.close());
  $("entry-form").addEventListener("submit", (event) => {
    const start = new Date(($("entry-start") as HTMLInputElement).value);
    const end = new Date(($("entry-end") as HTMLInputElement).value);
    if (!(start.getTime() < end.getTime())) {
      event.preventDefault();
      $("entry-error").hidden = false;
      return;
    }
    const note = ($("entry-note") as HTMLInputElement).value.trim();
    mutate(() => {
      if (editingEntryId) {
        const entry = data.entries.find((e) => e.id === editingEntryId);
        if (entry) Object.assign(entry, { start: start.toISOString(), end: end.toISOString(), note });
      } else if (selectedJobId) {
        data.entries.push({
          id: crypto.randomUUID(),
          jobId: selectedJobId,
          start: start.toISOString(),
          end: end.toISOString(),
          note,
        });
      }
    });
  });

  const settingsDialog = $("settings-dialog") as HTMLDialogElement;
  $("settings-btn").addEventListener("click", () => {
    ($("setting-theme") as HTMLSelectElement).value = data.settings.theme;
    ($("setting-accent") as HTMLInputElement).value = data.settings.accent;
    ($("setting-currency") as HTMLInputElement).value = data.settings.currency;
    settingsDialog.showModal();
  });
  $("setting-theme").addEventListener("change", () => {
    mutate(() => {
      data.settings.theme = ($("setting-theme") as HTMLSelectElement).value;
    });
    applyTheme();
  });
  $("setting-accent").addEventListener("input", () => {
    mutate(() => {
      data.settings.accent = ($("setting-accent") as HTMLInputElement).value;
    });
    applyTheme();
  });
  $("setting-currency").addEventListener("input", () => {
    mutate(() => {
      data.settings.currency = ($("setting-currency") as HTMLInputElement).value || "$";
    });
  });
  $("open-data-folder").addEventListener("click", () => window.hours.openDataFolder());
}

// ---------- init ----------

async function init() {
  const loaded = (await window.hours.loadData()) as AppData | null;
  if (loaded && loaded.version === 1) {
    data = { ...defaultData(), ...loaded, settings: { ...defaultData().settings, ...loaded.settings } };
  }
  selectedJobId = data.jobs[0]?.id ?? null;
  applyTheme();
  wireDialogs();
  $("add-job").addEventListener("click", () => openJobDialog(null));
  window.addEventListener("beforeunload", () => {
    if (savePending) {
      savePending = false;
      void window.hours.saveData(data);
    }
  });
  render();
}

void init();
