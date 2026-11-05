import { useRef, useState } from "react";
import { getSavedAvatar, processAvatarFile, saveAvatar } from "../lib/avatar";
import { getSavedBio } from "../lib/profile";

const MAX_BIO_LENGTH = 160;

function getSavedName() {
  try {
    return localStorage.getItem("couchcrew:name") || "";
  } catch {
    return "";
  }
}

// Shared by the standalone Settings page and the in-room settings drawer —
// same name/avatar/bio editor either way. `onSave` is called with the new
// { name, avatar, bio } after it's written to localStorage, so a caller
// already in a room can also push it to the server (profile:update) — the
// bio shows up when someone taps your name or photo (see MemberProfileCard).
export default function ProfileForm({ onSave }) {
  const [name, setName] = useState(getSavedName);
  const [avatar, setAvatar] = useState(getSavedAvatar);
  const [bio, setBio] = useState(getSavedBio);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setError("");
      const dataUrl = await processAvatarFile(file);
      setAvatar(dataUrl);
    } catch (err) {
      setError(err.message || "Couldn't use that photo.");
    }
  }

  function removePhoto() {
    setAvatar(null);
  }

  function save(e) {
    e.preventDefault();
    const trimmed = name.trim();
    const trimmedBio = bio.trim().slice(0, MAX_BIO_LENGTH);
    try {
      localStorage.setItem("couchcrew:name", trimmed);
      localStorage.setItem("couchcrew:bio", trimmedBio);
    } catch {
      // Storage can be unavailable (private browsing, etc.) — the form
      // still works for the current session.
    }
    saveAvatar(avatar);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSave?.({ name: trimmed, avatar, bio: trimmedBio });
  }

  return (
    <form className="profile-form" onSubmit={save}>
      <div className="avatar-row">
        <span className="avatar-preview" aria-hidden="true">
          {avatar ? <img src={avatar} alt="" /> : (name.trim()[0] || "?").toUpperCase()}
        </span>
        <div className="avatar-actions">
          <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
            {avatar ? "Change photo" : "Add photo"}
          </button>
          {avatar && (
            <button type="button" className="secondary" onClick={removePhoto}>
              Remove
            </button>
          )}
          {/* No `capture` attribute: that would force the camera on mobile
              and hide the gallery entirely. Leaving it off lets the
              browser's own picker offer both "Camera" and "Photo Library". */}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>
      </div>
      {error && <p className="video-error">{error}</p>}
      <label htmlFor="display-name">Display name</label>
      <input
        id="display-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
      />
      <label htmlFor="bio">Bio</label>
      <textarea
        id="bio"
        value={bio}
        onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
        placeholder="A line about yourself — shown when someone taps your name or photo"
        rows={3}
      />
      <span className="bio-count">
        {bio.length}/{MAX_BIO_LENGTH}
      </span>
      <button type="submit">{saved ? "Saved!" : "Save"}</button>
    </form>
  );
}
