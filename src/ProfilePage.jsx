// ProfilePage.jsx – User Profile, Stats, Settings & Account Management
import { useState, useEffect, useCallback } from "react";
import { useLab } from "./LabContext";

const ACHIEVEMENT_BADGES = [
  { id: "first-lab", icon: "🚀", label: "First Steps", desc: "Completed your first lab" },
  { id: "three-labs", icon: "🔥", label: "Getting Serious", desc: "Completed 3 labs" },
  { id: "five-labs", icon: "⚡", label: "Halfway There", desc: "Completed 5 labs" },
  { id: "all-labs", icon: "🏆", label: "SysAdmin Master", desc: "Completed all labs" },
  { id: "linux-master", icon: "🐧", label: "Terminal Wizard", desc: "Completed Linux Terminal" },
  { id: "raid-expert", icon: "💾", label: "RAID Expert", desc: "Completed RAID Simulator" },
];

export default function ProfilePage({ onBack, onNavigate }) {
  const { user, token, plan, progress, achievements, lastActiveLab, deleteAccount, logout } = useLab();

  // Stats
  const completedCount = Object.values(progress).filter(l => l.completed).length;
  const userStreak = user?.currentStreak || 0;
  const userXp = user?.totalXp || 0;

  // Profile editing
  const [name, setName] = useState(user?.name || "");
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Password change
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  // ── Save Profile ───────────────────────────────────────────────────────────
  async function saveProfile() {
    setProfileSaving(true);
    setProfileMsg("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nickname })
      });
      if (res.ok) {
        setProfileMsg("✓ Profile updated");
        setTimeout(() => setProfileMsg(""), 3000);
      } else {
        setProfileMsg("✗ Failed to update profile");
      }
    } catch {
      setProfileMsg("✗ Network error");
    }
    setProfileSaving(false);
  }

  // ── Change Password ────────────────────────────────────────────────────────
  async function changePassword() {
    setPasswordLoading(true);
    setPasswordMsg("");
    if (newPassword.length < 8) {
      setPasswordMsg("✗ Password must be at least 8 characters");
      setPasswordLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/user/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg("✓ Password changed successfully");
        setOldPassword("");
        setNewPassword("");
        setTimeout(() => setPasswordMsg(""), 3000);
      } else {
        setPasswordMsg(`✗ ${data.error || "Failed"}`);
      }
    } catch {
      setPasswordMsg("✗ Network error");
    }
    setPasswordLoading(false);
  }

  // ── Request Data (GDPR Export) ─────────────────────────────────────────────
  async function requestData() {
    try {
      const res = await fetch("/api/user/export-data", {
        headers: { }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "winlab-my-data.json"; a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
  }

  // ── Delete Account ─────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (deleteInput !== "DELETE") return;
    await deleteAccount();
    if (onBack) onBack();
    else window.location.href = "/";
  }

  if (!user || !token) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl block mb-4">🔒</span>
          <h2 className="text-xl font-bold text-white mb-2">Sign in required</h2>
          <p className="text-slate-400 text-sm">Please sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-slate-500 hover:text-white text-sm transition-colors">← Back</button>
          )}
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">👤 Your Profile</h1>
            <p className="text-xs text-slate-500">Manage account, stats, and settings</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-8">

        {/* ── 1. Profile Info ─────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">✏️ Profile Information</h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={80}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nickname</label>
                <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Display nickname" maxLength={40}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input value={email} readOnly
                className="w-full bg-slate-800/50 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed" />
              <p className="text-[10px] text-slate-600 mt-1">Email cannot be changed. Contact support for changes.</p>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${profileMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{profileMsg}</span>
              <button onClick={saveProfile} disabled={profileSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {profileSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* ── 2. Change Password ──────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">🔑 Change Password</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Current Password</label>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">New Password (min 8 chars)</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" minLength={8}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600" />
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${passwordMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{passwordMsg}</span>
              <button onClick={changePassword} disabled={passwordLoading || !oldPassword || !newPassword}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {passwordLoading ? "Updating…" : "Update Password"}
              </button>
            </div>
          </div>
        </div>

        {/* ── 3. Stats ────────────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">📊 Your Statistics</h2>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Labs Done", value: completedCount, icon: "🧪" },
              { label: "Total XP", value: userXp, icon: "⚡" },
              { label: "Current Streak", value: userStreak > 0 ? `🔥 ${userStreak}` : "—", icon: "📅" },
              { label: "Plan", value: plan.toUpperCase(), icon: "💳" },
            ].map((s, i) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-4 text-center">
                <span className="text-xl block mb-1">{s.icon}</span>
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-slate-500 uppercase">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Badges */}
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Badges</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ACHIEVEMENT_BADGES.map(badge => {
              const unlocked = achievements?.find(a => a.id === badge.id);
              return (
                <div key={badge.id} className={`rounded-lg p-3 border transition-all ${
                  unlocked ? "bg-yellow-500/5 border-yellow-500/30" : "bg-slate-800/30 border-slate-800 opacity-40"
                }`}>
                  <span className="text-2xl block mb-1">{badge.icon}</span>
                  <p className="text-xs font-bold text-white">{badge.label}</p>
                  <p className="text-[10px] text-slate-500">{badge.desc}</p>
                  {unlocked && <p className="text-[9px] text-yellow-400 mt-1">✓ Unlocked {new Date(unlocked.unlockedAt).toLocaleDateString()}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. Quick Links ──────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">⚙️ Quick Links</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <button onClick={() => onNavigate?.("aisettings")}
              className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-emerald-600/30 transition-all text-left">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-sm font-semibold text-white">AI Training Settings</p>
                <p className="text-xs text-slate-500">Manage AI consent, incognito mode, export data</p>
              </div>
            </button>
            <button onClick={requestData}
              className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-blue-600/30 transition-all text-left">
              <span className="text-2xl">📦</span>
              <div>
                <p className="text-sm font-semibold text-white">Request Your Data</p>
                <p className="text-xs text-slate-500">Download all your data (GDPR Art. 15)</p>
              </div>
            </button>
          </div>
        </div>

        {/* ── 5. Delete Account ───────────────────────────────────────────── */}
        <div className="bg-red-600/5 border border-red-600/20 rounded-xl p-6">
          <h2 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">🗑️ Danger Zone</h2>
          <p className="text-xs text-slate-400 mb-4">
            Once you delete your account, there is no going back. All your data will be permanently removed.
          </p>

          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 text-xs font-semibold rounded-lg transition-colors">
              Delete Account
            </button>
          ) : (
            <div className="space-y-4 p-4 rounded-lg bg-red-600/10 border border-red-600/20">
              <p className="text-sm text-red-300 font-semibold">Are you absolutely sure?</p>
              <p className="text-xs text-slate-400">Type <code className="text-red-400 font-mono bg-red-600/20 px-1.5 py-0.5 rounded">DELETE</code> to confirm.</p>
              <div className="flex gap-3">
                <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="Type DELETE here" maxLength={6}
                  className="flex-1 bg-slate-800 border border-red-600/30 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500" />
                <button onClick={confirmDelete} disabled={deleteInput !== "DELETE"}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                  Confirm Delete
                </button>
                <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                  className="px-4 py-2 border border-slate-700 text-slate-400 hover:text-white text-xs rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
