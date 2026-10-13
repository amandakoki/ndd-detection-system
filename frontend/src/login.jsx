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
    <form onSubmit={handleSubmit} noValidate>
      <h1>Log in</h1>

      <label>Email <input type="email" name="email" value={form.email} onChange={set} autoComplete="email" /></label>
      <label>Password <input type="password" name="password" value={form.password} onChange={set} autoComplete="current-password" /></label>

      {error && <p style={{ color: "#b00020" }}>{error}</p>}
      {needsVerify && (
        <p>
          <button type="button" onClick={resend}>Resend verification email</button>
        </p>
      )}
      {info && <p>{info}</p>}

      <button type="submit" disabled={loading}>{loading ? "Logging in..." : "Log in"}</button>
      <p>No account yet? <Link to="/signup">Sign up</Link></p>
    </form>
  );
}