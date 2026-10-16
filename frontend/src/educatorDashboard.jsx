import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_ROOT } from "./api";
import { getSession, logout } from "./auth";
import "./educator.css";

const RISK_LEVELS = ["High", "Medium", "Low"];

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

function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

/* Horizontal bars: top contributing features */
function FeatureBars({ items }) {
  const max = Math.max(...items.map((i) => i.weight), 0.01);
  return (
    <ul className="hbars">
      {items.map((item) => (
        <li key={item.name}>
          <span className="hbar-label">{item.name}</span>
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

/* Line chart: progress over time (values from 0 to 100) */
function LineChart({ points }) {
  const W = 320;
  const H = 160;
  const pad = { l: 30, r: 10, t: 10, b: 26 };
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
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

export default function EducatorDashboard() {
  const navigate = useNavigate();
  const { user, access } = getSession();
  const [state, setState] = useState({ status: "loading", learners: [] });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

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

  const { learners } = state;
  const selected = learners.find((l) => l.id === selectedId) ?? learners[0] ?? null;
  const result = selected?.classification ?? null;
  const progress = selected?.progress ?? [];

  const overview = RISK_LEVELS.map((label) => ({
    label,
    count: learners.filter((l) => l.classification?.risk === label).length,
  }));
  const classifiedCount = overview.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="ed-page">
      <header className="ed-header">
        <strong className="ed-brand">NDD System</strong>
        <span className="ed-user">
          Educator: {user.name} |{" "}
          <button type="button" className="btn-link" onClick={handleLogout}>
            Log Out
          </button>
        </span>
      </header>

      {state.status === "loading" && <p className="ed-state">Loading your class...</p>}

      {state.status === "unavailable" && (
        <p className="ed-state">
          Class data isn't available yet. It will appear here once learners and
          results have been added.
        </p>
      )}

      {state.status === "error" && (
        <div className="ed-state">
          <p>We couldn't load your class data.</p>
          <button type="button" className="btn-link" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <div className="ed-body">
          <aside className="ed-sidebar">
            <h2>My Class List</h2>
            {learners.length === 0 ? (
              <Empty>No learners in your class yet.</Empty>
            ) : (
              <ul className="class-list">
                {learners.map((learner) => (
                  <li key={learner.id}>
                    <button
                      type="button"
                      className={`class-item ${learner.id === selected?.id ? "active" : ""}`}
                      aria-pressed={learner.id === selected?.id}
                      onClick={() => setSelectedId(learner.id)}
                    >
                      <span>{learner.name}</span>
                      {learner.flagged && <span className="flag">Flagged</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <main className="ed-main">
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
                  <p className="result-line">Confidence Score: {result.confidence}%</p>
                  <p className="muted">Classified: {formatDate(result.classified_on)}</p>
                </>
              )}
            </section>

            <section className="panel">
              <h2>Support Plan Recommendations</h2>
              {result?.support?.length ? (
                <ul className="support-list">
                  {result.support.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <Empty>No recommendations yet.</Empty>
              )}
            </section>

            <section className="panel">
              <h2>XAI Explanation</h2>
              {result?.features?.length ? (
                <>
                  <p className="muted caption">Top contributing features</p>
                  <FeatureBars items={result.features} />
                </>
              ) : (
                <Empty>No explanation available yet.</Empty>
              )}
            </section>

            <section className="panel">
              <h2>Progress Summary</h2>
              {progress.length >= 2 ? (
                <>
                  <p className="muted caption">Progress trend over time</p>
                  <LineChart points={progress} />
                </>
              ) : (
                <Empty>Not enough progress data yet.</Empty>
              )}
            </section>

            <section className="panel wide">
              <h2>Class-Wide Overview</h2>
              {classifiedCount > 0 ? (
                <>
                  <p className="muted caption">
                    Number of learners by risk level, this term
                  </p>
                  <ColumnChart items={overview} />
                </>
              ) : (
                <Empty>No classifications recorded this term yet.</Empty>
              )}
            </section>
          </main>
        </div>
      )}
    </div>
  );
}