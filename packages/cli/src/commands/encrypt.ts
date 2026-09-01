import chalk from "chalk";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createCryptoFromSecret, generateKey } from "@envvault/crypto";

export async function encryptCommand(file: string, opts: { out?: string; key?: string } = {}) {
  if (!file) {
    console.error(chalk.red("Usage: envvault encrypt <file> [--out <out>] [--key <secret>]"));
    process.exit(2);
  }
  const secret = opts.key ?? process.env.ENVVAULT_MASTER_KEY ?? "envvault-dev-secret-please-change";
  if (!opts.key && !process.env.ENVVAULT_MASTER_KEY) {
    console.log(chalk.yellow("Using dev secret. Set ENVVAULT_MASTER_KEY or --key for real encryption."));
  }
  const content = await fs.readFile(path.resolve(file));
  const { encryptFileContent } = await import("@envvault/crypto");
  const payload = await encryptFileContent(content, secret);
  const out = opts.out ?? `${file}.enc`;
  await fs.writeFile(out, JSON.stringify(payload, null, 2), "utf-8");
  console.log(chalk.green(`✓ Encrypted ${file} → ${out}`));
  console.log(chalk.dim(`  Algorithm: ${payload.algorithm} v${payload.formatVersion}, nonce: ${payload.nonce.slice(0, 8)}...`));
  console.log(chalk.dim("  Never commit .enc with --key in shell history (§43)"));
}

export async function decryptCommand(file: string, opts: { out?: string; key?: string } = {}) {
  if (!file) {
    console.error(chalk.red("Usage: envvault decrypt <file.enc> [--out <out>] [--key <secret>]"));
    process.exit(2);
  }
  const secret = opts.key ?? process.env.ENVVAULT_MASTER_KEY ?? "envvault-dev-secret-please-change";
  const raw = await fs.readFile(path.resolve(file), "utf-8");
  const payload = JSON.parse(raw);
  const { decryptFileContent } = await import("@envvault/crypto");
  const outBuf = await decryptFileContent(payload, secret);
  const out = opts.out ?? file.replace(/\.enc$/, "") + ".dec";
  await fs.writeFile(out, outBuf);
  console.log(chalk.green(`✓ Decrypted ${file} → ${out}`));
  console.log(chalk.dim(`  Verified authTag, ${outBuf.length} bytes`));
}
