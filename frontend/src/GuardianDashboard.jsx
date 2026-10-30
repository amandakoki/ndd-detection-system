import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "./api";
import { logout } from "./auth";
import { formatDate } from "./format";
import { LineChart } from "./charts";
import AppHeader from "./AppHeader";
import LinkCodeForm from "./LinkCodeForm";
import "./educator.css";
import "./portal.css";

export default function GuardianDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", items: [] });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    authFetch("/guardian/dashboard/")
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
          setState({ status: "ready", items: data.children ?? [] });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", items: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, navigate]);

  function reload() {
    setState({ status: "loading", items: [] });
    setReloadKey((k) => k + 1);
  }

  const { items } = state;
  const child = items.find((c) => c.id === selectedId) ?? items[0] ?? null;
  const result = child?.classification ?? null;
  const progress = child?.progress ?? [];

  return (
    <div className="ed-page">
      <AppHeader roleLabel="Guardian" />

      {state.status === "loading" && <p className="ed-state">Loading...</p>}

      {state.status === "error" && (
        <div className="ed-state">
          <p>We couldn't load your information.</p>
          <button type="button" className="btn-link" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && items.length === 0 && (
        <div className="panel connect-card">
          <h2>Connect your child</h2>
          <LinkCodeForm
            label="Guardian code"
            hint="Your child's educator will give you this code."
            onLinked={reload}
          />
        </div>
      )}

      {state.status === "ready" && child && (
        <div className="portal-body">
          {items.length > 1 && (
            <div className="child-tabs">
              {items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`child-tab ${c.id === child.id ? "active" : ""}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <h1>My Child: {child.name}</h1>

          <div className="portal-grid">
            <section className="panel">
              <h2>Latest Result</h2>
              {result ? (
                <>
                  <p className="result-main">
                    Risk Level:{" "}
                    <span className={`risk risk-${String(result.risk).toLowerCase()}`}>
                      {result.risk}
                    </span>
                  </p>
                  <p className="result-line">Confidence Score: {result.confidence}%</p>
                  <p className="muted">Checked on: {formatDate(result.classified_on)}</p>
                </>
              ) : (
                <p className="empty">No result for your child yet.</p>
              )}
            </section>

            <section className="panel">
              <h2>Why We Think This</h2>
              {result?.factors?.length ? (
                <>
                  <p className="muted caption">The main things behind this result:</p>
                  <ul className="support-list">
                    {result.factors.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="empty">No explanation available yet.</p>
              )}
            </section>

            <section className="panel">
              <h2>What You Can Do At Home</h2>
              {result?.home_support?.length ? (
                <ul className="support-list">
                  {result.home_support.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              ) : (
                <p className="empty">No suggestions yet.</p>
              )}
            </section>

            <section className="panel">
              <h2>Progress Over Time</h2>
              {progress.length >= 2 ? (
                <LineChart points={progress} />
              ) : (
                <p className="empty">Not enough progress data yet.</p>
              )}
            </section>
          </div>

          <section className="panel connect-more">
            <h2>Connect another child</h2>
            <LinkCodeForm
              label="Guardian code"
              hint="Enter the code from your other child's educator."
              onLinked={reload}
            />
          </section>
        </div>
      )}
    </div>
  );
}