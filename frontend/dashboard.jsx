import { useNavigate } from "react-router-dom";
import { getSession, logout } from "./auth";

export default function Dashboard({ title }) {
  const navigate = useNavigate();
  const { user } = getSession();

  return (
    <div>
      <h1>{title}</h1>
      <p>Welcome, {user.name} ({user.role}).</p>
      <button
        onClick={() => {
          logout();
          navigate("/login");
        }}
      >
        Log out
      </button>
    </div>
  );
}