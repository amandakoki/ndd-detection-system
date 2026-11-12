import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../api";
import { logout } from "../auth";
import Modal from "./Modal";

const ROLE_LABEL = {
  educator: "Educator",
  learner: "Learner",
  parent: "Guardian",
  admin: "Admin",
};

function FieldErr({ errors, name }) {
  if (!errors[name]) return null;
  return (
    <p className="field-error" role="alert">
      {[].concat(errors[name]).join(" ")}
    </p>
  );
}

function AddUserModal({ onClose, onDone }) {
  const [form, setForm] = useState({ name: "", email: "", role: "educator", password: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const res = await authFetch("/sysadmin/users/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.detail ? { form: data.detail } : data);
        return;
      }
      onDone();
    } catch {
      setErrors({ form: "Can't reach the server. Is Django running?" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add user" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="au-name">Full name</label>
          <input id="au-name" name="name" value={form.name} onChange={set} />
          <FieldErr errors={errors} name="name" />
        </div>
        <div className="field">
          <label htmlFor="au-email">Email</label>
          <input id="au-email" type="email" name="email" value={form.email} onChange={set} />
          <FieldErr errors={errors} name="email" />
        </div>
        <div className="field">
          <label htmlFor="au-role">Role</label>
          <select id="au-role" name="role" value={form.role} onChange={set}>
            <option value="educator">Educator</option>
            <option value="learner">Learner</option>
            <option value="parent">Guardian</option>
          </select>
          <FieldErr errors={errors} name="role" />
        </div>
        <div className="field">
          <label htmlFor="au-password">Temporary password</label>
          <input id="au-password" type="password" name="password" value={form.password} onChange={set} autoComplete="new-password" />
          <p className="hint">At least 8 characters. Share it with them privately.</p>
          <FieldErr errors={errors} name="password" />
        </div>
        {errors.form && <p className="alert" role="alert">{errors.form}</p>}
        <p className="small-note">A verification email is sent to the new user.</p>
        <div className="modal-actions">
          <button className="btn btn-inline" type="submit" disabled={busy}>
            {busy ? "Adding..." : "Add user"}
          </button>
          <button className="btn-outline" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ManageModal({ user, onClose, onChanged }) {
  const [current, setCurrent] = useState(user);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function run(action, doneText) {
    setError("");
    setMessage("");
    setBusy(action);
    try {
      const res = await authFetch(`/sysadmin/users/${current.id}/action/`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "That didn't work.");
        return;
      }
      setCurrent(data);
      setMessage(doneText);
      onChanged();
    } catch {
      setError("Can't reach the server.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Modal title="Manage user" onClose={onClose}>
      <dl className="detail-list">
        <div><dt>Name</dt><dd>{current.name}</dd></div>
        <div><dt>Email</dt><dd>{current.email}</dd></div>
        <div><dt>Role</dt><dd>{ROLE_LABEL[current.role] ?? current.role}</dd></div>
        <div><dt>Email status</dt><dd>{current.email_verified ? "Verified" : "Not verified"}</dd></div>
        <div><dt>Status</dt><dd>{current.is_active ? "Active" : "Inactive"}</dd></div>
      </dl>

      {error && <p className="alert" role="alert">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="modal-actions">
        {current.is_active ? (
          <button
            type="button"
            className="btn-outline danger"
            disabled={!!busy}
            onClick={() => {
              if (window.confirm(`Deactivate ${current.email}? They won't be able to log in.`)) {
                run("deactivate", "Account deactivated.");
              }
            }}
          >
            Deactivate account
          </button>
        ) : (
          <button
            type="button"
            className="btn-outline"
            disabled={!!busy}
            onClick={() => run("activate", "Account activated.")}
          >
            Activate account
          </button>
        )}
        {!current.email_verified && (
          <>
            <button type="button" className="btn-outline" disabled={!!busy} onClick={() => run("resend", "Verification email sent.")}>
              Resend verification email
            </button>
            <button type="button" className="btn-outline" disabled={!!busy} onClick={() => run("verify", "Email marked as verified.")}>
              Mark email as verified
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function UsersPanel({ onChanged }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", rows: [], count: 0, pages: 1 });
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () => {
        const params = new URLSearchParams({ page: String(page) });
        if (q.trim()) params.set("q", q.trim());
        if (role) params.set("role", role);
        if (statusFilter) params.set("status", statusFilter);

        authFetch(`/sysadmin/users/?${params}`)
          .then(async (res) => {
            if (cancelled) return;
            if (res.status === 401) {
              logout();
              navigate("/login");
              return;
            }
            if (!res.ok) throw new Error("Request failed");
            const data = await res.json();
            if (cancelled) return;
            setState({ status: "ready", rows: data.results, count: data.count, pages: data.pages });
            if (data.page !== page) setPage(data.page);
          })
          .catch(() => {
            if (!cancelled) setState((s) => ({ ...s, status: "error" }));
          });
      },
      q ? 300 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, role, statusFilter, page, reloadKey, navigate]);

  function changed() {
    setReloadKey((k) => k + 1);
    onChanged();
  }

  return (
    <>
      <div className="panel-head">
        <h2>Users</h2>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          aria-label="Search users"
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="educator">Educators</option>
          <option value="learner">Learners</option>
          <option value="parent">Guardians</option>
          <option value="admin">Admins</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button type="button" className="btn btn-inline" onClick={() => setAdding(true)}>
          + Add user
        </button>
      </div>

      {state.status === "loading" && <p className="empty">Loading users...</p>}
      {state.status === "error" && (
        <p className="alert" role="alert">
          We couldn't load the users.{" "}
          <button type="button" className="btn-link" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </p>
      )}

      {state.status === "ready" && (
        <>
          {state.rows.length === 0 ? (
            <p className="empty">No users match your search.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Verified</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td><span className="pill">{ROLE_LABEL[u.role] ?? u.role}</span></td>
                      <td>
                        <span className={`pill ${u.email_verified ? "ok" : "warn"}`}>
                          {u.email_verified ? "Verified" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <span className={`dot ${u.is_active ? "ok" : ""}`} />
                        {u.is_active ? "Active" : "Inactive"}
                      </td>
                      <td>
                        <button type="button" className="btn-link" onClick={() => setManaging(u)}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pager">
            <span>
              {state.count} user{state.count === 1 ? "" : "s"} · page {page} of {state.pages}
            </span>
            <span>
              <button type="button" className="btn-link" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
                ‹
              </button>{" "}
              <button type="button" className="btn-link" disabled={page >= state.pages} onClick={() => setPage(page + 1)} aria-label="Next page">
                ›
              </button>
            </span>
          </div>
        </>
      )}

      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            changed();
          }}
        />
      )}
      {managing && (
        <ManageModal user={managing} onClose={() => setManaging(null)} onChanged={changed} />
      )}
    </>
  );
}