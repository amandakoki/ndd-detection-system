import { useState } from "react";

const ROLES = [
  { value: "educator", label: "Educator" },
  { value: "learner", label: "Learner" },
  { value: "parent", label: "Parent" },
];

export default function Signup() {
  const [form, setForm] = useState({ role: "", name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

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

  try {
    const res = await fetch("http://127.0.0.1:8000/api/auth/signup/", {
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
  } catch (error) {
    setErrors({ form: "Can't reach the server. Is Django running on port 8000?" });
  }
}

  if (done) return <p>Account created! Check your email to verify your address.</p>;

  const err = (f) => errors[f] && <p style={{ color: "#b00020" }}>{[].concat(errors[f]).join(" ")}</p>;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <br /> <br />
      
      <h2>Create your account</h2>
      

      <label>I am a…
        <select name="role" value={form.role} onChange={set}>
          <option value="">Select your role</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      {err("role")}

      <br /> <br />

      <label>Full name <input name="name" value={form.name} onChange={set} /></label>
      {err("name")}

      <br /> <br />

      <label>Email <input type="email" name="email" value={form.email} onChange={set} /></label>
      {err("email")}

      <br /> <br />
      <label>Password <input type="password" name="password" value={form.password} onChange={set} /></label>
      {err("password")}

      <br /> <br />
      <label>Confirm password <input type="password" name="confirm" value={form.confirm} onChange={set} /></label>
      {err("confirm")}

      <br /> <br />

      {err("form")}

      <button type="submit">Sign up</button>
    </form>
  );
}