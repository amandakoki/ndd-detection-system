import { Navigate } from "react-router-dom";
import { getSession, HOME } from "./auth";

export default function ProtectedRoute({ role, children }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role !== role) return <Navigate to={HOME[session.user.role]} replace />;
  return children;
}