import type { Transaction } from "@solana/web3.js";

export type InjectedTxSignature = string | Uint8Array;

/** Minimal Phantom injected provider (browser extension). */
export interface InjectedPhantomProvider {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: { toString(): string };
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage?(
    message: Uint8Array,
    display?: string,
  ): Promise<{ signature: Uint8Array; publicKey: { toString(): string } }>;
  signAndSendTransaction?(
    transaction: Transaction,
  ): Promise<{ signature: string | Uint8Array }>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export function getInjectedPhantomProvider(): InjectedPhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    phantom?: { solana?: InjectedPhantomProvider };
    solana?: InjectedPhantomProvider;
  };
  const provider = w.phantom?.solana ?? w.solana;
  return provider?.isPhantom ? provider : null;
}

export function isInjectedPhantomInstalled(): boolean {
  return getInjectedPhantomProvider() !== null;
}

/**
 * Connect via the Phantom extension directly — avoids SDK modal hangs on HTTP hosts.
 */
export async function connectInjectedPhantom(timeoutMs = 120_000): Promise<void> {
  const provider = getInjectedPhantomProvider();
  if (!provider) {
    throw new Error(
      "Phantom wallet not detected. On mobile, tap Open in Phantom App. On desktop, install the Phantom extension.",
    );
  }

  await Promise.race([
    provider.connect({ onlyIfTrusted: false }),
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () =>
          reject(
            new Error(
              "Phantom did not respond. Click the Phantom icon in your browser toolbar — a connection request may be waiting for approval.",
            ),
          ),
        timeoutMs,
      );
    }),
  ]);
}

export async function disconnectInjectedPhantom(): Promise<void> {
  const provider = getInjectedPhantomProvider();
  if (provider?.isConnected) {
    await provider.disconnect();
  }
}

export async function signInjectedMessage(message: string): Promise<Uint8Array> {
  const provider = getInjectedPhantomProvider();
  if (!provider?.isConnected || !provider.signMessage) {
    throw new Error("Wallet not connected");
  }
  const encoded = new TextEncoder().encode(message);
  const { signature } = await provider.signMessage(encoded, "utf8");
  return signature;
}

export async function signAndSendInjectedTransaction(tx: Transaction): Promise<InjectedTxSignature> {
  const provider = getInjectedPhantomProvider();
  if (!provider?.isConnected || !provider.signAndSendTransaction) {
    throw new Error("Wallet not available");
  }
  const { signature } = await provider.signAndSendTransaction(tx);
  return signature;
}
