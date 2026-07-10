import { useEffect, useState } from "react";
import { getInjectedPhantomProvider } from "../lib/injectedPhantom";

export function useInjectedPhantom() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const provider = getInjectedPhantomProvider();
    if (!provider) {
      setConnected(false);
      setAddress(null);
      return;
    }

    const sync = () => {
      const pk = provider.publicKey?.toString() ?? null;
      setConnected(Boolean(provider.isConnected && pk));
      setAddress(pk);
    };

    sync();
    provider.on?.("connect", sync);
    provider.on?.("disconnect", sync);
    provider.on?.("accountChanged", sync);

    return () => {
      provider.removeListener?.("connect", sync);
      provider.removeListener?.("disconnect", sync);
      provider.removeListener?.("accountChanged", sync);
    };
  }, []);

  return { connected, address };
}
