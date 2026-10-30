import { useNavigate } from "react-router-dom";
import { getSession, logout } from "./auth";
import "./educator.css";
import "./portal.css";

export default function AppHeader({ roleLabel, avatar = false }) {
  const navigate = useNavigate();
  const { user } = getSession();

  return (
    <header className="ed-header">
      <strong className="ed-brand">NDD System</strong>
      <span className="ed-user">
        {roleLabel}: {user.name} |{" "}
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Log Out
        </button>
        {avatar && (
          <span className="avatar" aria-hidden="true">
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
    </header>
  );
}