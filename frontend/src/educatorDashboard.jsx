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