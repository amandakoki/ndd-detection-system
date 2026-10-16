import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Signup from "./Signup";
import Login from "./Login";
import VerifyEmail from "./VerifyEmail";
import Dashboard from "./Dashboard";
import EducatorDashboard from "./educatorDashboard";
import ProtectedRoute from "./ProtectedRoute";
import { getSession, HOME } from "./auth";

function Home() {
  const session = getSession();
  return <Navigate to={session ? HOME[session.user.role] : "/login"} replace />;
}

const page = (role, title) => (
  <ProtectedRoute role={role}>
    <Dashboard title={title} />
  </ProtectedRoute>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/educator"
          element={
            <ProtectedRoute role="educator">
              <EducatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/learner" element={page("learner", "Learner dashboard")} />
        <Route path="/parent" element={page("parent", "Parent dashboard")} />
        <Route path="/system-admin" element={page("admin", "System admin dashboard")} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}