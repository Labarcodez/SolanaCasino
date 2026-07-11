import type { Page } from "@playwright/test";

export async function injectPhantomWallet(
  page: Page,
  walletAddress: string,
): Promise<void> {
  await page.addInitScript((address) => {
    const provider = {
      isPhantom: true,
      isConnected: true,
      publicKey: {
        toString: () => address,
        toBase58: () => address,
      },
      connect: async () => ({
        publicKey: { toString: () => address, toBase58: () => address },
      }),
      disconnect: async () => {},
      signMessage: async (message: Uint8Array) => ({
        signature: new Uint8Array(64),
        publicKey: { toString: () => address },
      }),
      on: () => {},
      removeListener: () => {},
    };

    const w = window as Window & {
      phantom?: { solana?: typeof provider };
      solana?: typeof provider;
    };
    w.phantom = { solana: provider };
    w.solana = provider;
  }, walletAddress);
}

export async function primeAuthenticatedSession(
  page: Page,
  walletAddress: string,
  token: string,
): Promise<void> {
  await injectPhantomWallet(page, walletAddress);
  await page.addInitScript((storedToken) => {
    localStorage.setItem("solcasino_auth_token", storedToken);
  }, token);
}
