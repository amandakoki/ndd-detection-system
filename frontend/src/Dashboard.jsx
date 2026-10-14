import { useNavigate } from "react-router-dom";
import { getSession, logout } from "./auth";

export default function Dashboard({ title }) {
  const navigate = useNavigate();
  const { user } = getSession();

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>{title}</h1>
        <p className="subtitle">Welcome, {user.name} ({user.role}).</p>
        <button
          className="btn"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Log out
        </button>
      </div>
    </main>
  );
}