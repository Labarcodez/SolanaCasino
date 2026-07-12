import type { useSolana } from "@phantom/react-sdk";
import bs58 from "bs58";
import { signInjectedMessage } from "./injectedPhantom";

type SolanaSigner = NonNullable<ReturnType<typeof useSolana>["solana"]>;

export type AuthProviderKind = string | undefined;

/** Portal / OAuth wallets — must use SDK signer, never the browser extension. */
export function isEmbeddedAuthProvider(provider: AuthProviderKind): boolean {
  return (
    provider === "google" ||
    provider === "apple" ||
    provider === "deeplink" ||
    provider === "phantom"
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Wait for Phantom SDK Solana signer after OAuth redirect / connect. */
export async function waitForSdkSolana(
  getSolana: () => SolanaSigner | null | undefined,
  getAvailable: () => boolean,
  maxMs = 10_000,
): Promise<SolanaSigner> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const solana = getSolana();
    if (solana && getAvailable()) {
      return solana;
    }
    await sleep(200);
  }
  throw new Error(
    "Wallet signer is still loading. Wait a few seconds, then tap Create profile & play again.",
  );
}

export async function signAuthMessage(params: {
  message: string;
  sdkConnected: boolean;
  getSolana: () => SolanaSigner | null | undefined;
  getAvailable: () => boolean;
  useInjected: boolean;
  authProvider: AuthProviderKind;
}): Promise<string> {
  const {
    message,
    sdkConnected,
    getSolana,
    getAvailable,
    useInjected,
    authProvider,
  } = params;

  if (sdkConnected || isEmbeddedAuthProvider(authProvider)) {
    const signer = await waitForSdkSolana(getSolana, getAvailable);
    const signResult = await signer.signMessage(message);
    const sig = signResult.signature;
    if (typeof sig === "string") {
      return sig;
    }
    if (sig instanceof Uint8Array) {
      return bs58.encode(sig);
    }
    throw new Error("Unexpected signature format from wallet");
  }

  if (useInjected) {
    return bs58.encode(await signInjectedMessage(message));
  }

  throw new Error("Wallet not connected");
}
