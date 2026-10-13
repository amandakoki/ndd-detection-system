import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API } from "./api";
import { HOME, saveSession } from "./auth";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
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

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1>Log in</h1>

      <label>Email <input type="email" name="email" value={form.email} onChange={set} autoComplete="email" /></label>
      <label>Password <input type="password" name="password" value={form.password} onChange={set} autoComplete="current-password" /></label>

      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      <button type="submit" disabled={loading}>{loading ? "Logging in..." : "Log in"}</button>
      <p>No account yet? <Link to="/signup">Sign up</Link></p>
    </form>
  );
}