import { useEffect } from "react";
import { usePhantom } from "@phantom/react-sdk";

export default function AuthCallback() {
  const { isConnected } = usePhantom();

  useEffect(() => {
    if (isConnected) {
      window.location.href = "/";
    }
  }, [isConnected]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "#f0f2f8",
        background: "#0a0b0f",
      }}
    >
      <p>Completing sign in...</p>
    </div>
  );
}
