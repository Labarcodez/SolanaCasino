/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PHANTOM_APP_ID: string;
  readonly VITE_CASINO_WALLET: string;
  readonly VITE_SOLANA_RPC: string;
  readonly VITE_API_URL: string;
  readonly VITE_PROGRAM_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
