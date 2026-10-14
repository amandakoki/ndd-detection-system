import { useState } from "react";
import { Link } from "react-router-dom";
import { API } from "./api";

const ROLES = [
  { value: "educator", label: "Educator" },
  { value: "learner", label: "Learner" },
  { value: "parent", label: "Parent" },
];

function FieldError({ errors, name }) {
  if (!errors[name]) return null;
  return (
    <p className="field-error" role="alert">
      {[].concat(errors[name]).join(" ")}
    </p>
  );
}

export default function Signup() {
  const [form, setForm] = useState({
    role: "",
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const local = {};
    if (!form.role) local.role = "Please choose your role.";
    if (form.name.trim().length < 2) local.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) local.email = "Enter a valid email.";
    if (form.password.length < 8) local.password = "At least 8 characters.";
    if (form.password !== form.confirm) local.confirm = "Passwords don't match.";
    setErrors(local);
    if (Object.keys(local).length) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: form.role,
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data);
        return;
      }
      setDone(true);
    } catch {
      setErrors({ form: "Can't reach the server. Is Django running on port 8000?" });
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="subtitle">We sent a verification link to {form.email}.</p>
          <p className="success">Open the link to activate your account, then log in.</p>
          <Link className="btn" to="/login">Go to log in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Create your account</h1>
        <p className="subtitle">Choose your role to get started.</p>

        <div className="field">
          <label htmlFor="role">I am a...</label>
          <select id="role" name="role" value={form.role} onChange={set} aria-invalid={!!errors.role}>
            <option value="">Select your role</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <FieldError errors={errors} name="role" />
        </div>

        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" value={form.name} onChange={set} autoComplete="name" aria-invalid={!!errors.name} />
          <FieldError errors={errors} name="name" />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" name="email" value={form.email} onChange={set} autoComplete="email" aria-invalid={!!errors.email} />
          <FieldError errors={errors} name="email" />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" name="password" value={form.password} onChange={set} autoComplete="new-password" aria-invalid={!!errors.password} />
          <p className="hint">At least 8 characters.</p>
          <FieldError errors={errors} name="password" />
        </div>

        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" name="confirm" value={form.confirm} onChange={set} autoComplete="new-password" aria-invalid={!!errors.confirm} />
          <FieldError errors={errors} name="confirm" />
        </div>

        {errors.form && <p className="alert" role="alert">{errors.form}</p>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </button>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}