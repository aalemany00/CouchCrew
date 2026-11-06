import { useEffect, useState } from "react";
import {
  changePassword,
  deleteAccount,
  fetchMe,
  getCachedUser,
  getSecurityQuestion,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "../lib/auth";

// Shown in Settings, above the profile form. Signed out: sign in / sign up
// / forgot password (security question, since no email service is set up
// for this project - see LOG.md). Signed in: your email (never shown to
// anyone else, never sent to a room) plus a change-password form.
export default function AccountSection({ onAccountChange }) {
  const [user, setUser] = useState(getCachedUser);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => {
      setUser(u);
      setChecked(true);
      onAccountChange?.(u);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAuthed(u) {
    setUser(u);
    onAccountChange?.(u);
  }

  async function handleSignedOut() {
    setUser(null);
    onAccountChange?.(null);
  }

  return (
    <section className="account-section">
      <h2>Account</h2>
      {!checked ? null : user ? (
        <SignedIn user={user} onSignedOut={handleSignedOut} />
      ) : (
        <SignedOut onAuthed={handleAuthed} />
      )}
    </section>
  );
}

function SignedIn({ user, onSignedOut }) {
  // "actions" | "changePassword" | "deleteAccount" - mutually exclusive so
  // there's never a change-password form and a delete-account confirmation
  // open at the same time.
  const [view, setView] = useState("actions");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function backToActions() {
    setView("actions");
    setError("");
    setCurrentPassword("");
    setNewPassword("");
    setDeletePassword("");
  }

  async function submitChangePassword(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      backToActions();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    onSignedOut();
  }

  async function submitDeleteAccount(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await deleteAccount({ password: deletePassword });
      onSignedOut();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-signed-in">
      <p className="room-tag">
        Signed in as <strong>{user.email}</strong> — only you can see this.
      </p>
      {view === "actions" && (
        <div className="account-actions">
          <button type="button" className="secondary" onClick={() => setView("changePassword")}>
            Change password
          </button>
          <button type="button" className="secondary" onClick={handleSignOut}>
            Sign out
          </button>
          <button type="button" className="secondary danger" onClick={() => setView("deleteAccount")}>
            Delete account
          </button>
        </div>
      )}

      {view === "changePassword" && (
        <form className="profile-form" onSubmit={submitChangePassword}>
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <p className="watch-error">{error}</p>}
          <div className="account-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save new password"}
            </button>
            <button type="button" className="secondary" onClick={backToActions}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {view === "deleteAccount" && (
        <form className="profile-form" onSubmit={submitDeleteAccount}>
          <p className="watch-error">
            This permanently deletes your account and can't be undone. Your name, photo, and bio
            stay on this device as a local (non-account) profile.
          </p>
          <label htmlFor="delete-password">Enter your password to confirm</label>
          <input
            id="delete-password"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            required
          />
          {error && <p className="watch-error">{error}</p>}
          <div className="account-actions">
            <button type="submit" className="danger" disabled={busy}>
              {busy ? "Deleting…" : "Delete my account"}
            </button>
            <button type="button" className="secondary" onClick={backToActions}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {saved && <p className="room-tag">Password updated.</p>}
    </div>
  );
}

function SignedOut({ onAuthed }) {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Forgot-password sub-state: ask for the email first, show the question,
  // then take the answer + a new password.
  const [resetStep, setResetStep] = useState("email");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");

  function switchMode(next) {
    setMode(next);
    setError("");
    setPassword("");
    setResetStep("email");
    setAnswer("");
    setNewPassword("");
  }

  async function submitSignIn(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onAuthed(await signIn({ email, password }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitSignUp(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onAuthed(await signUp({ email, password, name, securityQuestion, securityAnswer }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitForgotEmail(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      setQuestion(await getSecurityQuestion(email));
      setResetStep("answer");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitForgotAnswer(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onAuthed(await resetPassword({ email, securityAnswer: answer, newPassword }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-signed-out">
      <div className="account-tabs">
        <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => switchMode("signin")}>
          Sign In
        </button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>
          Sign Up
        </button>
        <button type="button" className={mode === "forgot" ? "active" : ""} onClick={() => switchMode("forgot")}>
          Forgot Password
        </button>
      </div>

      {mode === "signin" && (
        <form className="profile-form" onSubmit={submitSignIn}>
          <label htmlFor="signin-email">Email</label>
          <input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="signin-password">Password</label>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="watch-error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      )}

      {mode === "signup" && (
        <form className="profile-form" onSubmit={submitSignUp}>
          <label htmlFor="signup-name">Display name</label>
          <input id="signup-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <label htmlFor="signup-question">Security question</label>
          <input
            id="signup-question"
            type="text"
            placeholder="e.g. What was your first pet's name?"
            value={securityQuestion}
            onChange={(e) => setSecurityQuestion(e.target.value)}
            required
          />
          <label htmlFor="signup-answer">Answer</label>
          <input
            id="signup-answer"
            type="text"
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
            required
          />
          {error && <p className="watch-error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Sign Up"}
          </button>
        </form>
      )}

      {mode === "forgot" && resetStep === "email" && (
        <form className="profile-form" onSubmit={submitForgotEmail}>
          <label htmlFor="forgot-email">Email</label>
          <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="watch-error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Next"}
          </button>
        </form>
      )}

      {mode === "forgot" && resetStep === "answer" && (
        <form className="profile-form" onSubmit={submitForgotAnswer}>
          <label htmlFor="forgot-answer">{question}</label>
          <input
            id="forgot-answer"
            type="text"
            placeholder="Your answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
          />
          <label htmlFor="forgot-new-password">New password</label>
          <input
            id="forgot-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <p className="watch-error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}
    </div>
  );
}
