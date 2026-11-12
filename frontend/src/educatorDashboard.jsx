import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_ROOT } from "./api";
import { getSession, logout } from "./auth";
import "./educator.css";

const RISK_LEVELS = ["High", "Medium", "Low"];
const AGE_MIN = 4; // keep in step with AGE_MIN in classroom/models.py
const AGE_MAX = 18;

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* Turns a Django/DRF error body ({"name": ["..."]}, {"detail": "..."}) into one readable line */
function errorText(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  const parts = Object.values(data)
    .flat()
    .filter((v) => typeof v === "string");
  return parts.length ? parts.join(" ") : fallback;
}

function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

/* Horizontal bars: top contributing features */
function FeatureBars({ items }) {
  // FIX: use the absolute value, otherwise negative weights overflow the bar
  const max = Math.max(...items.map((i) => Math.abs(i.weight)), 0.01);
  return (
    <ul className="hbars">
      {items.map((item) => (
        <li key={item.name}>
          <span className="hbar-label">
            {item.effect === "raises" ? "↑ " : item.effect === "lowers" ? "↓ " : ""}
            {item.name}
          </span>
          <span className="hbar-track">
            <span
              className="hbar-fill"
              style={{ width: `${(Math.abs(item.weight) / max) * 100}%` }}
            />
          </span>
          <span className="hbar-value">{Number(item.weight).toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}

/* Line chart: progress over time (values from 0 to 100). Needs at least 2 points. */
function LineChart({ points }) {
  const W = 320;
  const H = 160;
  const pad = { l: 30, r: 10, t: 10, b: 26 };
  // FIX: with a single point this divided by zero; the caller now checks for 2+ points
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(points.length - 1, 1);
  const y = (v) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="line-chart"
      role="img"
      aria-label="Progress trend over time"
    >
      {[0, 50, 100].map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={W - pad.r} y1={y(tick)} y2={y(tick)} className="grid" />
          <text x={pad.l - 6} y={y(tick) + 4} textAnchor="end" className="axis">
            {tick}
          </text>
        </g>
      ))}
      <path d={path} className="line" fill="none" />
      {points.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <circle cx={x(i)} cy={y(p.value)} r="3.5" className="dot" />
          <text x={x(i)} y={H - 8} textAnchor="middle" className="axis">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* Column chart: learners per risk level */
function ColumnChart({ items }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="columns">
      {items.map((item) => (
        <div key={item.label} className="column">
          <span className="column-count">{item.count}</span>
          <div
            className={`column-bar tone-${item.label.toLowerCase()}`}
            style={{ height: `${Math.max((item.count / max) * 120, 4)}px` }}
          />
          <span className="column-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/*
  Shape this page expects for each learner from GET /educator/dashboard/
  (adjust the field names in the JSX below if your serializer differs):
  {
    id, name, age,
    classification: { risk_level: "High" | "Medium" | "Low", date } | null,
    recommendations: [string],
    explanation: [{ name, weight, effect: "raises" | "lowers" }],
    progress: [{ label, value }],            // value 0-100
    learner_code, guardian_code,
    learner_connected: boolean,
    guardians_connected: number
  }
*/
export default function EducatorDashboard() {
  const navigate = useNavigate();
  const { user, access } = getSession();
  const [state, setState] = useState({ status: "loading", learners: [] });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_ROOT}/educator/dashboard/`, {
      headers: { Authorization: `Bearer ${access}` },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          // the login has expired
          logout();
          navigate("/login");
          return;
        }
        if (res.status === 404) {
          setState({ status: "unavailable", learners: [] });
          return;
        }
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        if (!cancelled) {
          setState({ status: "ready", learners: data.learners ?? [] });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", learners: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, access, navigate]);

  function retry() {
    setState({ status: "loading", learners: [] });
    setReloadKey((k) => k + 1);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function addLearner(e) {
    e.preventDefault();
    setAddError("");
    const name = newName.trim();
    const age = Number(newAge);
    if (name.length < 2) {
      setAddError("Enter the learner's name.");
      return;
    }
    if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
      setAddError(`Enter the learner's age (${AGE_MIN} to ${AGE_MAX}).`);
      return;
    }

    setAdding(true);
    try {
      const res = await fetch(`${API_ROOT}/educator/learners/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ name, age }),
      });
      if (res.status === 401) {
        logout();
        navigate("/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(errorText(data, "Could not add the learner."));
        return;
      }
      // success: clear the form, select the new learner, reload the list
      setNewName("");
      setNewAge("");
      setSelectedId(data.id ?? null);
      setReloadKey((k) => k + 1);
    } catch {
      setAddError("Can't reach the server. Is Django running on port 8000?");
    } finally {
      setAdding(false);
    }
  }

  const learners = state.learners;
  const selected = learners.find((l) => l.id === selectedId) ?? learners[0] ?? null;
  const classification = selected?.classification ?? null;
  const level = classification?.risk_level ?? null;
  const explanation = selected?.explanation ?? [];
  const progress = selected?.progress ?? [];
  const recommendations = selected?.recommendations ?? [];

  const riskCounts = RISK_LEVELS.map((label) => ({
    label,
    count: learners.filter((l) => l.classification?.risk_level === label).length,
  }));
  const classifiedCount = riskCounts.reduce((n, r) => n + r.count, 0);

  // learners with a Medium or High result get a "Flagged" badge in the class list
  const isFlagged = (l) => {
    const r = l.classification?.risk_level;
    return r === "High" || r === "Medium";
  };

  return (
    <div className="ed-page">
      <header className="ed-header">
        <strong className="ed-brand">NDD System</strong>
        <span className="ed-user">
          Educator: {user?.name} |{" "}
          <button type="button" className="btn-link" onClick={handleLogout}>
            Log Out
          </button>
        </span>
      </header>

      {state.status === "loading" && <p className="ed-state">Loading your class…</p>}

      {state.status === "error" && (
        <div className="ed-state">
          <p>We couldn't load your dashboard.</p>
          <button type="button" className="btn" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {state.status === "unavailable" && (
        <p className="ed-state">The dashboard isn't available yet.</p>
      )}

      {state.status === "ready" && (
        <div className="ed-body">
          {/* ── Left column: class list ── */}
          <aside className="ed-sidebar">
            <h2>My Class List</h2>

            <form className="add-learner" onSubmit={addLearner} noValidate>
              <label htmlFor="learner-name">Add a learner</label>
              <div className="add-learner-row">
                <input
                  id="learner-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name, e.g. Jane D."
                  autoComplete="off"
                />
                <input
                  className="age-input"
                  type="number"
                  min={AGE_MIN}
                  max={AGE_MAX}
                  value={newAge}
                  onChange={(e) => setNewAge(e.target.value)}
                  placeholder="Age"
                  aria-label="Learner's age"
                />
                <button className="btn" type="submit" disabled={adding}>
                  {adding ? "Adding…" : "Add"}
                </button>
              </div>
              {addError && (
                <p className="alert" role="alert">
                  {addError}
                </p>
              )}
            </form>

            {learners.length === 0 ? (
              <Empty>No learners in your class yet.</Empty>
            ) : (
              <ul className="class-list">
                {learners.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={`class-item${l.id === selected?.id ? " active" : ""}`}
                      onClick={() => setSelectedId(l.id)}
                    >
                      <span>{l.name}</span>
                      {isFlagged(l) && <span className="flag">Flagged</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* ── Right: result panels ── */}
          <div className="ed-main">
            <section className="panel">
              <h2>Classification Result{selected ? ` — ${selected.name}` : ""}</h2>
              {!selected ? (
                <Empty>No learner selected.</Empty>
              ) : !classification ? (
                <Empty>No classification result for this learner yet.</Empty>
              ) : (
                <>
                  <p className="result-main">
                    Risk level:{" "}
                    <span className={`risk risk-${(level ?? "unknown").toLowerCase()}`}>
                      {level ?? "Unknown"}
                    </span>
                  </p>
                  {classification.date && (
                    <p className="muted result-line">
                      Classified on {formatDate(classification.date)}
                    </p>
                  )}
                  <p className="muted">This is a screening indicator, not a diagnosis.</p>
                </>
              )}
                          <section className="panel">
              <h2>Classification Result{selected ? ` — ${selected.name}` : ""}</h2>
              {!selected && <Empty>No learner selected.</Empty>}
              {selected && !result && (
                <Empty>No classification result for this learner yet.</Empty>
              )}
              {result && (
                <>
                  <p className="result-main">
                    Risk Level:{" "}
                    <span className={`risk risk-${String(result.risk).toLowerCase()}`}>
                      {result.risk}
                    </span>
                  </p>
                  <p className="result-line">Screening score: {result.confidence} out of 100</p>
                  <p className="muted">Classified: {formatDate(result.classified_on)}</p>
                  <p className="muted">A screening indication, not a diagnosis.</p>
                </>
              )}
              {selected && (
                <Link className="btn run-screening" to={`/educator/screen/${selected.id}`}>
                  Run screening
                </Link>
              )}
            </section>
            </section>

            <section className="panel">
              <h2>Support Plan Recommendations</h2>
              {recommendations.length === 0 ? (
                <Empty>No recommendations yet.</Empty>
              ) : (
                <ul className="support-list">
                  {recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h2>XAI Explanation</h2>
              {explanation.length === 0 ? (
                <Empty>No explanation available yet.</Empty>
              ) : (
                <>
                  <p className="muted caption">
                    What influenced this result most (↑ raises risk, ↓ lowers it).
                  </p>
                  <FeatureBars items={explanation} />
                </>
              )}
            </section>

            <section className="panel">
              <h2>Progress Summary</h2>
              {progress.length < 2 ? (
                <Empty>Not enough progress data yet.</Empty>
              ) : (
                <LineChart points={progress} />
              )}
            </section>

            <section className="panel wide">
              <h2>Class-Wide Overview</h2>
              {classifiedCount === 0 ? (
                <Empty>No classifications recorded this term yet.</Empty>
              ) : (
                <ColumnChart items={riskCounts} />
              )}
            </section>

            {selected && (
              <section className="panel wide">
                <h2>Account Link Codes — {selected.name}</h2>
                <p className="muted caption">
                  Share these privately. Each person enters their code after signing up.
                </p>
                <div className="code-grid">
                  <div>
                    <span className="muted">Learner code (single use)</span>
                    <code className="code">{selected.learner_code ?? "—"}</code>
                    <span className="muted">
                      {selected.learner_connected ? "Connected" : "Not connected yet"}
                    </span>
                  </div>
                  <div>
                    <span className="muted">Guardian code</span>
                    <code className="code">{selected.guardian_code ?? "—"}</code>
                    <span className="muted">
                      {selected.guardians_connected ?? 0} guardian(s) connected
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
