import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      const data = await res.json();
      if (!res.ok) {
        setAddError(
          [].concat(data.name ?? data.age ?? data.detail ?? "Could not add the learner.").join(" ")