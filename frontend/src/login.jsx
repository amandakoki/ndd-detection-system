import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API } from "./api";
import { HOME, saveSession } from "./auth";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setNeedsVerify(false);
    if (!form.email.trim() || !form.password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) setNeedsVerify(true);
        setError(
          res.status === 401
            ? "Incorrect email or password."
            : data.detail || "Login failed."
        );
        return;
      }

      saveSession(data);
      navigate(HOME[data.user.role] || "/");
    } catch {
      setError("Can't reach the server. Is Django running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setInfo("");
    try {
      const res = await fetch(`${API}/resend-verification/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim().toLowerCase() }),
      });
      const data = await res.json();
      setInfo(
        res.status === 429
          ? "Too many requests. Please try again later."
          : data.detail
      );
    } catch {
      setInfo("Can't reach the server.");
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Welcome back</h1>
        <p className="subtitle">Log in to your account.</p>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" name="email" value={form.email} onChange={set} autoComplete="email" />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" name="password" value={form.password} onChange={set} autoComplete="current-password" />
        </div>

        {error && <p className="alert" role="alert">{error}</p>}
        {info && <p className="success">{info}</p>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>

        {needsVerify && (
          <p className="auth-footer">
            <button type="button" className="btn-link" onClick={resend}>
              Resend verification email
            </button>
          </p>
        )}

        <p className="auth-footer">
          No account yet? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </main>
  );
}