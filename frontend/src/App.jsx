import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Signup from "./Signup";
import Login from "./Login";
import VerifyEmail from "./VerifyEmail";
import Dashboard from "./Dashboard";
import EducatorDashboard from "./EducatorDashboard";
import GuardianDashboard from "./GuardianDashboard";
import LearnerDashboard from "./LearnerDashboard";
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
        <Route
          path="/learner"
          element={
            <ProtectedRoute role="learner">
              <LearnerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parent"
          element={
            <ProtectedRoute role="parent">
              <GuardianDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/system-admin" element={page("admin", "System admin dashboard")} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}