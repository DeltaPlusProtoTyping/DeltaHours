import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn } from "child_process";
import * as path from "path";
import { dataFilePath, loadData, saveData } from "./store";

function createWindow() {
  const win = new BrowserWindow({
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
  win.loadFile(path.join(__dirname, "../../static/index.html"));
}

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

  ipcMain.handle("get-data-path", async () => dataFilePath());

  ipcMain.handle("open-data-folder", async () => {
    const file = dataFilePath();
    if (process.platform === "win32") {
      // Open Explorer with the data file pre-selected so it stands out from
      // the Electron cache folders that share the userData directory.
      spawn("explorer.exe", ["/select,", file], { detached: true }).unref();
      return { ok: true as const };
    }
    const error = await shell.openPath(path.dirname(file));
    return error ? { ok: false as const, error } : { ok: true as const };
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
