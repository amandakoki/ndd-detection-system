import { useEffect, useMemo, useRef, useState } from "react";
import { shuffle } from "./defaultLevels";

/**
 * Plays ONE level.
 * The child taps every correct tile. Each tile can be tapped once.
 *   clicks = all taps, hits = correct taps, misses = wrong taps.
 * When every correct tile is found, calls onComplete({ clicks, hits, misses }).
 */
export default function LevelPlay({ level, onComplete }) {
  const tiles = useMemo(
    () => shuffle(level.tiles).map((t, id) => ({ ...t, id })),
    [level]
  );
  const totalCorrect = tiles.filter((t) => t.correct).length;

  const [status, setStatus] = useState({}); // tile id -> "hit" | "miss"
  const counts = useRef({ clicks: 0, hits: 0, misses: 0 });
  const finished = useRef(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function tap(tile) {
    if (finished.current || status[tile.id]) return;

    counts.current.clicks += 1;
    if (tile.correct) counts.current.hits += 1;
    else counts.current.misses += 1;

    setStatus((s) => ({ ...s, [tile.id]: tile.correct ? "hit" : "miss" }));

    if (counts.current.hits === totalCorrect) {
      finished.current = true;
      // brief pause so the child sees the last tile light up
      timer.current = setTimeout(() => onComplete({ ...counts.current }), 700);
    }
  }

  return (
    <div className="lv">
      <p className="lv-prompt">{level.prompt}</p>
      <div className="lv-grid">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className={`lv-tile ${status[tile.id] ? `lv-${status[tile.id]}` : ""}`}
            onClick={() => tap(tile)}
            disabled={Boolean(status[tile.id])}
          >
            {tile.text}
          </button>
        ))}
      </div>
    </div>
  );
}