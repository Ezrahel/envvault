#!/usr/bin/env bash
set -e
echo "EnvVault setup..."
corepack enable pnpm || npm i -g pnpm
pnpm install
pnpm build
echo "✓ Done. Try: pnpm --filter envvault dev -- scan --help"
