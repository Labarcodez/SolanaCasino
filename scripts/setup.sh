#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🎰 OrbitCasino Setup"
echo "=================="

# Backend env
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "✅ Created backend/.env"
else
  echo "ℹ️  backend/.env already exists"
fi

# Frontend env
if [ ! -f frontend/.env ]; then
  cp frontend/.env.example frontend/.env
  echo "✅ Created frontend/.env"
else
  echo "ℹ️  frontend/.env already exists"
fi

# Generate JWT secret if not set
if ! grep -q "^JWT_SECRET=.\+" backend/.env 2>/dev/null; then
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
  echo "JWT_SECRET=$JWT_SECRET" >> backend/.env
  echo "✅ Generated JWT_SECRET"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Building project..."
npm run build:docker

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. (Optional) Add VITE_PHANTOM_APP_ID to frontend/.env for Google/Apple login"
echo "     Register at https://phantom.com/portal"
echo "  2. (Required for instant withdrawals) Set CASINO_WALLET_PRIVATE_KEY in backend/.env"
echo "  3. (Recommended) Set SOLANA_RPC_URL or HELIUS_RPC_URL in backend/.env"
echo ""
echo "Run development:"
echo "  npm run dev"
echo ""
echo "Run production (single server):"
echo "  npm run start:prod"
