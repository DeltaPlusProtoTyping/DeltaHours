import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "path";
import { dataFilePath, loadData, saveData } from "./store";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 720,
    minHeight: 520,
    autoHideMenuBar: true,
    backgroundColor: "#14161a",
    icon: path.join(__dirname, "../../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
    },
  });
  mainWindow.loadFile(path.join(__dirname, "../../static/index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

// Only one instance may run — a second one would autosave to the same JSON and
// could clobber the first. If we don't get the lock, hand off to the running
// instance (which focuses its window) and quit.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", focusMainWindow);

  app.whenReady().then(() => {
    ipcMain.handle("load-data", async () => loadData());

    ipcMain.handle("save-data", async (_event, data: unknown) => {
      try {
        await saveData(data);
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    });

    ipcMain.handle("open-data-folder", async () => {
      shell.showItemInFolder(dataFilePath());
    });

    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
