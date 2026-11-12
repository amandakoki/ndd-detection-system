import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../api";
import { logout } from "../auth";
import AppHeader from "../AppHeader";
import UsersPanel from "./UsersPanel";
import LevelsPanel from "./LevelsPanel";
import "../educator.css";
import "../portal.css";
import "./admin.css";

const NAV = [
  { id: "top", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "classes", label: "Classes" },
  { id: "content", label: "Learning content" },
  { id: "activity", label: "Activity log" },
];

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({ label, value, note }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value ?? "—"}</span>
      <span className="stat-note">{note ?? "\u00a0"}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState({ status: "loading", data: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [active, setActive] = useState("top");
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    authFetch("/sysadmin/overview/")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          logout();
          navigate("/login");
          return;
        }
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        if (!cancelled) setOverview({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setOverview({ status: "error", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, navigate]);

  function go(id) {
    setActive(id);
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const data = overview.data;
  const c = data?.counts;
  const health = data?.health;

  return (
    <div className="ed-page">
      <AppHeader roleLabel="Admin" avatar />

      <div className="adm-layout">
        <aside className="adm-side">
          <nav className="panel adm-nav" aria-label="Admin sections">
            <h2>Admin</h2>
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === active ? "active" : ""}
                onClick={() => go(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <p className="adm-note">
            <strong>What admins can see</strong>
            <br />
            Admins manage accounts, content and system settings. They see aggregate counts only, never
            an individual child's screening result.
          </p>
        </aside>

        <main className="adm-main">
          <h1>System Overview</h1>

          {overview.status === "error" && (
            <p className="alert" role="alert">
              We couldn't load the overview.{" "}
              <button type="button" className="btn-link" onClick={refresh}>
                Try again
              </button>
            </p>
          )}

          <div className="stat-grid">
            <StatCard
              label="Educators"
              value={c?.educators.total}
              note={c && `${c.educators.unverified} unverified`}
            />
            <StatCard
              label="Learners"
              value={c?.learners.total}
              note={c && `${c.learners.with_accounts} with accounts`}
            />
            <StatCard
              label="Guardians"
              value={c?.guardians.total}
              note={c && `${c.guardians.unverified} unverified`}
            />
            <StatCard
              label="Screenings completed"
              value={c?.screenings.total}
              note={c && `${c.screenings.last_7_days} in the last 7 days`}
            />
          </div>

          <div className="adm-cols">
            <div className="adm-col">
              <section id="users" className="panel adm-section">
                <UsersPanel onChanged={refresh} />
              </section>

              <section id="content" className="panel adm-section">
                <LevelsPanel onChanged={refresh} />
              </section>

              <section id="classes" className="panel adm-section">
                <div className="panel-head">
                  <h2>Classes</h2>
                </div>
                {!data ? (
                  <p className="empty">Loading...</p>
                ) : data.classes.length === 0 ? (
                  <p className="empty">No educators yet.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Educator</th>
                          <th>Email</th>
                          <th>Learners</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.classes.map((e) => (
                          <tr key={e.id}>
                            <td>{e.name}</td>
                            <td>{e.email}</td>
                            <td>{e.learners}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="adm-col">
              <section id="health" className="panel adm-section">
                <div className="panel-head">
                  <h2>System health</h2>
                </div>
                {!health ? (
                  <p className="empty">Loading...</p>
                ) : (
                  <ul className="kv">
                    {[
                      ["API server", health.api],
                      ["Database", health.database],
                      ["Email service", health.email],
                    ].map(([label, item]) => (
                      <li key={label}>
                        <span>{label}</span>
                        <span>
                          <span className={`dot ${item.ok ? "ok" : "bad"}`} />
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section id="activity" className="panel adm-section">
                <div className="panel-head">
                  <h2>Recent activity</h2>
                </div>
                {!data ? (
                  <p className="empty">Loading...</p>
                ) : data.activity.length === 0 ? (
                  <p className="empty">No activity yet.</p>
                ) : (
                  <ul className="feed">
                    {data.activity.map((ev) => (
                      <li key={ev.id}>
                        <span className="feed-time">{formatWhen(ev.when)}</span>
                        <span>{ev.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}