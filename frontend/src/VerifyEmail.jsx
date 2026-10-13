import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API } from "./api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState(
    token
      ? { status: "loading", message: "" }
      : { status: "error", message: "This link is missing its token." }
  );

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/verify-email/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        setState({ status: res.ok ? "success" : "error", message: data.detail });
      })
      .catch(() =>
        setState({ status: "error", message: "Can't reach the server. Is Django running?" })
      );
  }, [token]);

  return (
    <div>
      <h1>Email verification</h1>
      {state.status === "loading" && <p>Verifying your email...</p>}
      {state.status === "success" && <p style={{ color: "green" }}>{state.message}</p>}
      {state.status === "error" && <p style={{ color: "#b00020" }}>{state.message}</p>}
      {state.status !== "loading" && <Link to="/login">Go to log in</Link>}
    </div>
  );
}