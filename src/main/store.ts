import { app } from "electron";
import * as fs from "fs/promises";
import * as path from "path";

export function dataFilePath(): string {
  return path.join(app.getPath("userData"), "deltahours-data.json");
}

export async function loadData(): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(dataFilePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Autosaves can arrive in quick succession; chain writes so they never interleave,
// and write via a temp file so a crash mid-write can't corrupt the data file.
let writeChain: Promise<void> = Promise.resolve();

export function saveData(data: unknown): Promise<void> {
  writeChain = writeChain.catch(() => {}).then(async () => {
    const file = dataFilePath();
    const tmp = file + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, file);
  });
  return writeChain;
}
