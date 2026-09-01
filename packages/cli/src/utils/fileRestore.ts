import * as fs from "node:fs/promises";
import * as path from "node:path";
import { constants as fsConstants } from "node:fs";

/**
 * Atomic file write: write to temp file, fsync, rename.
 * Sets 0600 permissions where supported.
 */
export async function atomicWriteFile(targetPath: string, content: Buffer | string): Promise<void> {
  const dir = path.dirname(targetPath);
  const tmpPath = `${targetPath}.envvault.tmp`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmpPath, content, { mode: 0o600 });
  try {
    await fs.chmod(tmpPath, 0o600);
  } catch {
    // Windows may not support chmod 0600
  }
  // fsync tmp file
  try {
    const fh = await fs.open(tmpPath, "r");
    await fh.sync();
    await fh.close();
  } catch {
    // ignore fsync errors on some filesystems
  }
  await fs.rename(tmpPath, targetPath);
}

export async function backupExistingFile(filePath: string): Promise<string | null> {
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }
  const date = new Date().toISOString().slice(0, 10);
  const backupPath = `${filePath}.envvault-backup-${date}`;
  // Avoid overwriting backup: add counter if exists
  let finalPath = backupPath;
  let counter = 1;
  while (true) {
    try {
      await fs.access(finalPath);
      finalPath = `${backupPath}-${counter++}`;
    } catch {
      break;
    }
  }
  await fs.copyFile(filePath, finalPath);
  return finalPath;
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}
