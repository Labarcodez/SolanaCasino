import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePhantom } from "@phantom/react-sdk";
import { useAuth } from "../hooks/useAuth";

export default function AuthCallback() {
  const { isConnected } = usePhantom();
  const { authenticate, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected) return;

    if (isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }

    authenticate()
      .then(() => navigate("/", { replace: true }))
      .catch(() => navigate("/", { replace: true }));
  }, [isConnected, isAuthenticated, authenticate, navigate]);

  return (
    <div className="auth-screen">
      <h2>Completing sign in...</h2>
      <p>Setting up your profile and wallet session.</p>
    </div>
  );
}
