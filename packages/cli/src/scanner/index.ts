export * from "@envvault/env-parser";
import { scanRoots } from "@envvault/env-parser";
import type { ScanOptions } from "@envvault/shared";
import { loadConfig } from "@envvault/config";

export async function* scanWithConfig(options?: ScanOptions & { roots?: string[] }) {
  const cfg = await loadConfig();
  const roots = options?.roots ?? cfg.scan.roots;
  // expand ~ roots
  const expanded = roots.map((r) => r.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? ""));
  yield* scanRoots(expanded, {
    followSymlinks: options?.followSymlinks ?? cfg.scan.followSymlinks,
    ignoreDirs: options?.ignoreDirs ?? cfg.scan.ignoreDirs,
    maxDepth: options?.maxDepth,
  });
}
