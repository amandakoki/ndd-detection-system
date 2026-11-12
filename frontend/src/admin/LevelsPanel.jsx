import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../api";
import { logout } from "../auth";
import Modal from "./Modal";

const DIFF_LABEL = { 1: "Very easy", 2: "Easy", 3: "Medium", 4: "Hard", 5: "Very hard" };
const toList = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

function FieldErr({ errors, name }) {
  if (!errors[name]) return null;
  return (
    <p className="field-error" role="alert">
      {[].concat(errors[name]).join(" ")}
    </p>
  );
}

function LevelModal({ level, onClose, onSaved }) {
  const editing = Boolean(level);
  const [form, setForm] = useState(
    level
      ? {
          name: level.name,
          skill: level.skill,
          difficulty: level.difficulty,
          order: level.order,
          prompt: level.prompt,
          correct: level.correct_items.join(", "),
          other: level.other_items.join(", "),
          is_active: level.is_active,
        }
      : { name: "", skill: "", difficulty: 1, order: "", prompt: "", correct: "", other: "", is_active: true }
  );
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    const body = {
      name: form.name.trim(),
      skill: form.skill.trim(),
      difficulty: Number(form.difficulty),
      prompt: form.prompt.trim(),
      correct_items: toList(form.correct),
      other_items: toList(form.other),
      is_active: form.is_active,
    };
    if (String(form.order).trim() !== "") body.order = Number(form.order);

    try {
      const res = await authFetch(editing ? `/sysadmin/levels/${level.id}/` : "/sysadmin/levels/", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.detail ? { form: data.detail } : data);
        return;
      }
      onSaved();
    } catch {
      setErrors({ form: "Can't reach the server. Is Django running?" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? "Edit level" : "Add level"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="lv-name">Level name</label>
          <input id="lv-name" name="name" value={form.name} onChange={set} />
          <FieldErr errors={errors} name="name" />
        </div>
        <div className="field">
          <label htmlFor="lv-skill">Skill</label>
          <input id="lv-skill" name="skill" value={form.skill} onChange={set} placeholder="e.g. Letter recognition" />
          <FieldErr errors={errors} name="skill" />
        </div>
        <div className="field">
          <label htmlFor="lv-difficulty">Difficulty</label>
          <select id="lv-difficulty" name="difficulty" value={form.difficulty} onChange={set}>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>{d} · {DIFF_LABEL[d]}</option>
            ))}
          </select>
          <FieldErr errors={errors} name="difficulty" />
        </div>
        <div className="field">
          <label htmlFor="lv-order">Play order</label>
          <input id="lv-order" type="number" min="0" name="order" value={form.order} onChange={set} />
          <p className="hint">Lowest plays first. Leave blank to add at the end.</p>
          <FieldErr errors={errors} name="order" />
        </div>
        <div className="field">
          <label htmlFor="lv-prompt">What the child is asked to do</label>
          <input id="lv-prompt" name="prompt" value={form.prompt} onChange={set} placeholder="e.g. Tap every letter b" />
          <FieldErr errors={errors} name="prompt" />
        </div>
        <div className="field">
          <label htmlFor="lv-correct">Correct answers</label>
          <input id="lv-correct" name="correct" value={form.correct} onChange={set} placeholder="Separate with commas, e.g. b, b, b" />
          <FieldErr errors={errors} name="correct_items" />
        </div>
        <div className="field">
          <label htmlFor="lv-other">Incorrect choices</label>
          <input id="lv-other" name="other" value={form.other} onChange={set} placeholder="Separate with commas, e.g. d, p, q" />
          <FieldErr errors={errors} name="other_items" />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Shown to learners
        </label>
        {errors.form && <p className="alert" role="alert">{errors.form}</p>}
        <div className="modal-actions">
          <button className="btn btn-inline" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save level"}
          </button>
          <button className="btn-outline" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function LevelsPanel({ minLevels, onChanged }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", levels: [] });
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new level

  useEffect(() => {
    let cancelled = false;
    authFetch("/sysadmin/levels/")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          logout();
          navigate("/login");
          return;
        }
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        if (!cancelled) setState({ status: "ready", levels: data.levels ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", levels: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, navigate]);

  const active = state.levels.filter((l) => l.is_active);
  const tooFew = minLevels != null && active.length < minLevels;
  const notRising = active.some((l, i) => i > 0 && l.difficulty < active[i - 1].difficulty);

  return (
    <>
      <div className="panel-head">
        <div>
          <h2>Learning content library</h2>
          <p className="muted">Game levels shown to learners, in play order</p>
        </div>
        <button type="button" className="btn btn-inline" onClick={() => setEditing(null)}>
          + Add level
        </button>
      </div>

      {state.status === "loading" && <p className="empty">Loading levels...</p>}
      {state.status === "error" && (
        <p className="alert" role="alert">
          We couldn't load the levels.{" "}
          <button type="button" className="btn-link" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </p>
      )}

      {state.status === "ready" && (
        <>
          {state.levels.length === 0 ? (
            <p className="empty">No levels yet. Add the levels children will play.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Level name</th>
                    <th>Skill</th>
                    <th>Difficulty</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.levels.map((l, i) => (
                    <tr key={l.id}>
                      <td>{i + 1}</td>
                      <td>{l.name}</td>
                      <td>{l.skill}</td>
                      <td>{l.difficulty} · {DIFF_LABEL[l.difficulty]}</td>
                      <td>
                        <span className={`pill ${l.is_active ? "ok" : "off"}`}>
                          {l.is_active ? "Active" : "Hidden"}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn-link" onClick={() => setEditing(l)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="small-note">
            Levels play in order. Difficulty should rise so every child can be scored.
          </p>
          {tooFew && (
            <p className="alert">
              Only {active.length} active level{active.length === 1 ? "" : "s"}. At least {minLevels} are
              needed before a child can be scored.
            </p>
          )}
          {notRising && (
            <p className="alert">Difficulty doesn't rise steadily in play order.</p>
          )}
        </>
      )}

      {editing !== undefined && (
        <LevelModal
          level={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            setReloadKey((k) => k + 1);
            onChanged();
          }}
        />
      )}
    </>
  );
}