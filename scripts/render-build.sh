#!/usr/bin/env bash
# Render build — injects VITE_SOLANA_RPC from ALCHEMY_API_KEY when not set explicitly.
set -euo pipefail

if [ -n "${ALCHEMY_API_KEY:-}" ] && [ -z "${VITE_SOLANA_RPC:-}" ]; then
  cluster="${SOLANA_CLUSTER:-mainnet-beta}"
  if [ "$cluster" = "mainnet-beta" ] || [ "$cluster" = "mainnet" ]; then
    export VITE_SOLANA_RPC="https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
  else
    export VITE_SOLANA_RPC="https://solana-devnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
  fi
fi

npm ci
npm run build:docker
