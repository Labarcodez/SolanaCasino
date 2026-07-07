#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/ubuntu/.avm/bin:$PATH"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Ensure Solana 3.1.8+ platform-tools (edition2024 compatible)
if command -v agave-install >/dev/null 2>&1; then
  agave-install init 3.1.8 >/dev/null 2>&1 || true
fi

avm use 0.32.1 >/dev/null 2>&1 || true

cd "$(dirname "$0")/.."

# Pin dependencies if lockfile missing edition2024-safe versions
if [ ! -f Cargo.lock ]; then
  cargo generate-lockfile
  cargo update -p proc-macro-crate@3.5.0 --precise 3.2.0 2>/dev/null || \
    cargo update -p proc-macro-crate --precise 3.2.0 2>/dev/null || true
  cargo update -p indexmap@2.14.0 --precise 2.11.4 2>/dev/null || true
  cargo update -p unicode-segmentation --precise 1.12.0 2>/dev/null || true
  npx --yes solana-edition-fixer --fix 2>/dev/null || true
fi

anchor build
npm run anchor:sync-idl
