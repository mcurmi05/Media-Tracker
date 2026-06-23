import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase-client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getDisplayName, getAvatarUrl } from "../utils/profile.js";
import { Spinner } from "../components/Loader.jsx";
import "../styles/AccountSettings.css";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3 MB

// A small inline status line shown under each section's save button.
function Status({ status }) {
  if (!status?.text) return null;
  return (
    <p className={`acct-status acct-status-${status.kind}`}>{status.text}</p>
  );
}

export default function AccountSettings() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  // ---- profile (display name + avatar) ----
  const [displayName, setDisplayName] = useState(() => getDisplayName(user));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ---- email ----
  const [email, setEmail] = useState(user?.email || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  // ---- password ----
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(null);

  // Pull the live user on mount so a recently-confirmed email change shows up
  // (the cached session can still hold the old address).
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Keep the editable fields in step with the user when it changes (e.g. after
  // the refresh above, or a metadata update). Only depends on the persisted
  // values, so it won't clobber what's being typed.
  useEffect(() => {
    setEmail(user?.email || "");
    setDisplayName(getDisplayName(user));
  }, [user?.email, user?.user_metadata?.display_name]);

  // Wait for auth to resolve; bounce signed-out visitors to sign in.
  if (loading) {
    return (
      <div className="acct-page acct-loading">
        <Spinner />
      </div>
    );
  }
  if (!user) {
    navigate("/signin");
    return null;
  }

  const avatarUrl = getAvatarUrl(user);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileStatus(null);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName.trim() },
    });
    setSavingProfile(false);
    setProfileStatus(
      error
        ? { kind: "error", text: error.message }
        : { kind: "success", text: "Display name updated." },
    );
  };

  const onPickAvatar = () => fileRef.current?.click();

  const onAvatarSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileStatus({ kind: "error", text: "Please choose an image file." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setProfileStatus({ kind: "error", text: "Image must be under 3 MB." });
      return;
    }

    setUploadingAvatar(true);
    setProfileStatus(null);
    try {
      // Keep one avatar per user: clear any existing files in their folder
      // before uploading the new one, so storage doesn't accumulate.
      const { data: existing } = await supabase.storage
        .from(AVATAR_BUCKET)
        .list(user.id);
      if (existing?.length) {
        await supabase.storage
          .from(AVATAR_BUCKET)
          .remove(existing.map((f) => `${user.id}/${f.name}`));
      }

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(path);
      // Store under custom_avatar_url (not avatar_url) so an OAuth provider
      // re-syncing avatar_url on the next sign-in can't overwrite the user's
      // own picture. getAvatarUrl() prefers custom_avatar_url.
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { custom_avatar_url: pub.publicUrl },
      });
      if (metaErr) throw metaErr;

      setProfileStatus({ kind: "success", text: "Profile picture updated." });
    } catch (err) {
      setProfileStatus({
        kind: "error",
        text:
          err?.message ||
          "Upload failed. Make sure the avatars storage bucket exists.",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    if (!user.user_metadata?.custom_avatar_url) return;
    setUploadingAvatar(true);
    setProfileStatus(null);
    try {
      const { data: existing } = await supabase.storage
        .from(AVATAR_BUCKET)
        .list(user.id);
      if (existing?.length) {
        await supabase.storage
          .from(AVATAR_BUCKET)
          .remove(existing.map((f) => `${user.id}/${f.name}`));
      }
      const { error } = await supabase.auth.updateUser({
        data: { custom_avatar_url: null },
      });
      if (error) throw error;
      setProfileStatus({ kind: "success", text: "Profile picture removed." });
    } catch (err) {
      setProfileStatus({ kind: "error", text: err?.message || "Failed to remove." });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    const next = email.trim();
    if (!next || next === user.email) {
      setEmailStatus({ kind: "error", text: "Enter a new email address." });
      return;
    }
    setSavingEmail(true);
    setEmailStatus(null);
    const { error } = await supabase.auth.updateUser({ email: next });
    setSavingEmail(false);
    setEmailStatus(
      error
        ? { kind: "error", text: error.message }
        : {
            kind: "success",
            text: "Check your inbox to confirm the new email address.",
          },
    );
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordStatus({
        kind: "error",
        text: "Enter your current password.",
      });
      return;
    }
    if (password.length < 6) {
      setPasswordStatus({
        kind: "error",
        text: "New password must be at least 6 characters.",
      });
      return;
    }
    if (password !== confirmPassword) {
      setPasswordStatus({ kind: "error", text: "Passwords don't match." });
      return;
    }
    setSavingPassword(true);
    setPasswordStatus(null);

    // Supabase can't verify the current password directly, so re-authenticate
    // with it first — a failed sign-in means it was wrong.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyErr) {
      setSavingPassword(false);
      setPasswordStatus({
        kind: "error",
        text: "Current password is incorrect.",
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) {
      setPasswordStatus({ kind: "error", text: error.message });
    } else {
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setPasswordStatus({ kind: "success", text: "Password updated." });
    }
  };

  return (
    <div className="acct-page">
      <header className="acct-header">
        <h1>Account Settings</h1>
        <p>Manage your profile, email and password.</p>
      </header>

      {/* profile: avatar + display name */}
      <section className="acct-card">
        <h2 className="acct-card-title">Profile</h2>
        <div className="acct-avatar-row">
          <img className="acct-avatar" src={avatarUrl} alt="Profile picture" />
          <div className="acct-avatar-actions">
            <button
              type="button"
              className="acct-btn acct-btn-secondary"
              onClick={onPickAvatar}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? <Spinner /> : "Upload photo"}
            </button>
            {user.user_metadata?.custom_avatar_url && (
              <button
                type="button"
                className="acct-btn acct-btn-ghost"
                onClick={removeAvatar}
                disabled={uploadingAvatar}
              >
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onAvatarSelected}
            />
          </div>
        </div>

        <form className="acct-form" onSubmit={saveProfile}>
          <div className="acct-field">
            <label className="acct-label" htmlFor="acct-name">
              Display name
            </label>
            <input
              id="acct-name"
              className="acct-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
            />
          </div>
          <button className="acct-btn" type="submit" disabled={savingProfile}>
            {savingProfile ? <Spinner /> : "Save profile"}
          </button>
          <Status status={profileStatus} />
        </form>
      </section>

      {/* email */}
      <section className="acct-card">
        <h2 className="acct-card-title">Email</h2>
        <form className="acct-form" onSubmit={saveEmail}>
          <div className="acct-field">
            <label className="acct-label" htmlFor="acct-email">
              Email address
            </label>
            <input
              id="acct-email"
              className="acct-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button className="acct-btn" type="submit" disabled={savingEmail}>
            {savingEmail ? <Spinner /> : "Update email"}
          </button>
          <Status status={emailStatus} />
        </form>
      </section>

      {/* password */}
      <section className="acct-card">
        <h2 className="acct-card-title">Password</h2>
        <form className="acct-form" onSubmit={savePassword}>
          <div className="acct-field">
            <label className="acct-label" htmlFor="acct-pw-current">
              Current password
            </label>
            <input
              id="acct-pw-current"
              className="acct-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
          </div>
          <div className="acct-field">
            <label className="acct-label" htmlFor="acct-pw">
              New password
            </label>
            <input
              id="acct-pw"
              className="acct-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="acct-field">
            <label className="acct-label" htmlFor="acct-pw2">
              Confirm new password
            </label>
            <input
              id="acct-pw2"
              className="acct-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
          </div>
          <button className="acct-btn" type="submit" disabled={savingPassword}>
            {savingPassword ? <Spinner /> : "Update password"}
          </button>
          <Status status={passwordStatus} />
        </form>
      </section>
    </div>
  );
}
