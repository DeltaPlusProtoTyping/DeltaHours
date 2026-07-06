import { app, BrowserWindow, ipcMain, shell } from "electron";
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
