import { useEffect, useState } from "react";

const STORAGE_KEY = "orbitcasino_age_confirmed";

export function AgeGate() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="age-gate-overlay" role="dialog" aria-modal="true">
      <div className="age-gate-card">
        <h2>Responsible gaming</h2>
        <p>
          OrbitCasino is for users of legal gambling age in their jurisdiction.
          Cryptocurrency gambling involves risk of loss. Play responsibly.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "1");
            setVisible(false);
          }}
        >
          I am of legal age — enter
        </button>
      </div>
    </div>
  );
}
