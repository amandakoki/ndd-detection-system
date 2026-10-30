import { useState } from "react";
import { authFetch } from "./api";
import "./educator.css";

export default function LinkCodeForm({ label, hint, onLinked }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("Enter the code.");
      return;
    }

    setBusy(true);
    try {
      const res = await authFetch("/link/", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Too many attempts. Please try again later."
            : data.detail || "Could not connect."
        );
        return;
      }
      setCode("");
      onLinked();
    } catch {
      setError("Can't reach the server. Is Django running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-learner" onSubmit={submit} noValidate>
      <label htmlFor="link-code">{label}</label>
      {hint && <p className="muted caption">{hint}</p>}
      <div className="add-learner-row">
        <input
          id="link-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. K7M2QX9A"
          maxLength={20}
          autoComplete="off"
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "..." : "Connect"}
        </button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </form>
  );
}