import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authFetch } from "./api";
import { logout } from "./auth";
import { formatDate } from "./format";
import AppHeader from "./AppHeader";
import LinkCodeForm from "./LinkCodeForm";
import "./educator.css";
import "./portal.css";

// If the activity's address points at this app's learner pages, open it inside the app.
function toInternalPath(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin === window.location.origin || u.pathname.indexOf("/learner/") === 0) {
      return u.pathname + u.search;
    }
  } catch (err) {
    /* not a valid address */
  }
  return null;
}

function ActionButton({ url, assignmentId, children }) {
  if (!url) {
    return (
      <button type="button" className="btn-outline" disabled title="Not available yet">
        {children}
      </button>
    );
  }

  const internal = toInternalPath(url);
  if (internal) {
    const separator = internal.indexOf("?") === -1 ? "?" : "&";
    const to = assignmentId
      ? internal + separator + "assignment=" + assignmentId
      : internal;
    return (
      <Link className="btn-outline" to={to}>
        {children}
      </Link>
    );
  }

  return (
    <a className="btn-outline" href={url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export default function LearnerDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState({
    status: "loading",
    learner: null,
    activities: [],
    recommendation: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    authFetch("/learner/dashboard/")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          logout();
          navigate("/login");
          return;
        }
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        if (!cancelled) {
          setState({
            status: "ready",
            learner: data.learner ?? null,
            activities: data.activities ?? [],
            recommendation: data.recommendation ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", learner: null, activities: [], recommendation: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, navigate]);

  function reload() {
    setState({ status: "loading", learner: null, activities: [], recommendation: null });
    setReloadKey((k) => k + 1);
  }

  const { learner, activities, recommendation } = state;

  return (
    <div className="ed-page">
      <AppHeader roleLabel="Learner" avatar />

      {state.status === "loading" && <p className="ed-state">Loading...</p>}

      {state.status === "error" && (
        <div className="ed-state">
          <p>We couldn't load your activities.</p>
          <button type="button" className="btn-link" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && !learner && (
        <div className="panel connect-card">
          <h2>Connect your account</h2>
          <LinkCodeForm
            label="Learner code"
            hint="Your educator will give you this code."
            onLinked={reload}
          />
        </div>
      )}

      {state.status === "ready" && learner && (
        <div className="portal-body">
          <div className="portal-grid">
            <section>
              <h2 className="section-title">My Learning Activities</h2>
              {activities.length === 0 ? (
                <p className="empty">No activities assigned yet.</p>
              ) : (
                <ul className="activity-list">
                  {activities.map((a) => (
                    <li key={a.id} className="activity">
                      <div>
                        <strong>{a.title}</strong>
                        <p className="muted">
                          {a.completed_at
                            ? "Completed on " + formatDate(a.completed_at)
                            : "Not yet completed"}
                        </p>
                      </div>
                      <ActionButton url={a.url} assignmentId={a.id}>
                        {a.completed_at ? "Play again" : "Start"}
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="section-title">Personalised Learning Content</h2>
              {recommendation ? (
                <div className="recommend">
                  <div className="recommend-card">
                    <strong>{recommendation.title}</strong>
                  </div>
                  {recommendation.reason && (
                    <p className="muted">{recommendation.reason}</p>
                  )}
                  <ActionButton url={recommendation.url}>
                    Open Recommended Content
                  </ActionButton>
                </div>
              ) : (
                <p className="empty">No recommended content yet.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}