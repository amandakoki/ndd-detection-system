import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authFetch } from "../api";
import { logout } from "../auth";
import AppHeader from "../AppHeader";
import LevelPlay from "./LevelPlay";
import { buildDefaultLevels, normalizeLevel } from "./defaultLevels";
import "../educator.css";
import "../portal.css";
import "./game.css";

const MIN_LEVELS = 6;      // the server refuses fewer than this
const TOTAL_LEVELS = 12;   // library levels are topped up with built-in ones to reach this

/**
 * Two ways in:
 *   /learner/play                a learner plays; log goes to /learner/screenings/
 *   /educator/screen/:learnerId  an educator runs it for one of their learners
 * The child never sees a result. The dashboards show it.
 */
export default function ScreeningGame() {
  const navigate = useNavigate();
  const { learnerId } = useParams();
  const isEducator = Boolean(learnerId);

  const [stage, setStage] = useState("loading"); // loading | intro | playing | saving | done | error
  const [levels, setLevels] = useState([]);
  const [usedFallback, setUsedFallback] = useState(false);
  const [index, setIndex] = useState(0);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let library = [];
      try {
        const res = await authFetch("/game/levels/");
        if (res.status === 401) {
          logout();
          navigate("/login");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          library = (data.levels ?? [])
            .map(normalizeLevel)
            .filter(
              (l) => l.tiles.some((t) => t.correct) && l.tiles.some((t) => !t.correct)
            );
        }
      } catch {
        /* fall back to the built-in levels below */
      }
      if (cancelled) return;

      const missing = Math.max(0, TOTAL_LEVELS - library.length);
      setUsedFallback(library.length < TOTAL_LEVELS);
      setLevels([...library, ...buildDefaultLevels(missing)]);
      setStage("intro");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function submit(finalLog) {
    setStage("saving");
    setError("");
    try {
      const path = isEducator
        ? `/educator/learners/${learnerId}/screenings/`
        : "/learner/screenings/";
      const res = await authFetch(path, {
        method: "POST",
        body: JSON.stringify({ levels: finalLog }),
      });
      if (res.status === 401) {
        logout();
        navigate("/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail =
          data.detail ?? (data.levels ? [].concat(data.levels).join(" ") : "");
        setError(detail || "We couldn't save the results.");
        setStage("error");
        return;
      }
      setStage("done");
    } catch {
      setError("Can't reach the server. Is Django running?");
      setStage("error");
    }
  }

  function handleLevelComplete(result) {
    const newLog = [...log, result];
    setLog(newLog);
    if (index + 1 < levels.length) {
      setIndex(index + 1);
    } else {
      submit(newLog);
    }
  }

  function start() {
    setLog([]);
    setIndex(0);
    setStage("playing");
  }

  const back = isEducator ? "/educator" : "/learner";

  return (
    <div className="ed-page">
      <AppHeader roleLabel={isEducator ? "Educator" : "Learner"} />

      <main className="game-wrap">
        <section className="panel game-card">
          {stage === "loading" && <p className="empty">Getting your game ready...</p>}

          {stage === "intro" && (
            <>
              <h1>Letter Matching</h1>
              <p>
                Look at the instruction, then tap the letters that match. Take your time.
                There are {levels.length} short levels.
              </p>
              {isEducator && (
                <p className="muted">
                  You're running this for a learner. Their result will appear on your dashboard.
                </p>
              )}
              {isEducator && usedFallback && (
                <p className="muted">
                  Some levels are built in because the library has fewer than {TOTAL_LEVELS}.
                </p>
              )}
              <button type="button" className="btn game-btn" onClick={start}>
                Start
              </button>
            </>
          )}

          {stage === "playing" && (
            <>
              <div className="game-progress">
                <span>
                  Level {index + 1} of {levels.length}
                </span>
                <div className="game-bar">
                  <div
                    className="game-bar-fill"
                    style={{ width: `${(index / levels.length) * 100}%` }}
                  />
                </div>
              </div>
              {/* key gives every level fresh tiles and counters */}
              <LevelPlay
                key={levels[index].id + index}
                level={levels[index]}
                onComplete={handleLevelComplete}
              />
            </>
          )}

          {stage === "saving" && <p className="empty">Saving...</p>}

          {stage === "done" && (
            <>
              <h1>All done! 🎉</h1>
              <p>Great job. You finished every level.</p>
              <button type="button" className="btn game-btn" onClick={() => navigate(back)}>
                {isEducator ? "View results on the dashboard" : "Back to my page"}
              </button>
            </>
          )}

          {stage === "error" && (
            <>
              <p className="alert" role="alert">{error}</p>
              <button type="button" className="btn game-btn" onClick={() => submit(log)}>
                Try saving again
              </button>
              <button type="button" className="btn-link" onClick={() => navigate(back)}>
                Go back
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}