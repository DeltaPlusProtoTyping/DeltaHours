import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("hours", {
  loadData: () => ipcRenderer.invoke("load-data"),
  saveData: (data: unknown) => ipcRenderer.invoke("save-data", data),
  openDataFolder: () => ipcRenderer.invoke("open-data-folder"),
  getDataPath: () => ipcRenderer.invoke("get-data-path"),
});
