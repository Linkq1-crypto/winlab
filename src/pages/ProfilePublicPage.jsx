import { useEffect, useMemo, useState } from 'react';
import { Server, Download, KeyRound, User, ShieldAlert } from 'lucide-react';

function PageNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
      <a href="/" className="flex items-center gap-2">
        <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded">
          <Server className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-black tracking-tighter text-white italic text-lg">WINLAB</span>
      </a>
      <a href="/" className="text-xs text-gray-500 hover:text-white transition-colors">Back to Dashboard</a>
    </nav>
  );
}

function formatPlan(plan) {
  if (!plan) return 'Starter';
  return String(plan).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

export default function ProfilePublicPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [passwordState, setPasswordState] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      setLoading(true);
      try {
        const res = await fetch('/api/user/me', { credentials: 'include' });
        if (res.status === 401) {
          if (!cancelled) setAuthError(true);
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          if (!cancelled) setAuthError(true);
          return;
        }
        if (!cancelled) {
          setUser(data);
          setName(data.name || '');
          setNickname(data.nickname || '');
          setAuthError(false);
        }
      } catch {
        if (!cancelled) setAuthError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();
    return () => { cancelled = true; };
  }, []);

  const joinedDate = useMemo(() => {
    if (!user?.createdAt) return 'Unknown';
    return new Date(user.createdAt).toLocaleDateString();
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileSaving(true);
    setSaveState('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, nickname }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveState(data?.error || 'Unable to update profile.');
        return;
      }
      setUser((current) => current ? { ...current, ...data } : current);
      setSaveState('Profile updated.');
    } catch {
      setSaveState('Network error while saving profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function updatePassword(e) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordState('');
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPasswordState(data?.error || 'Unable to change password.');
        return;
      }
      setOldPassword('');
      setNewPassword('');
      setPasswordState('Password updated.');
    } catch {
      setPasswordState('Network error while updating password.');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function exportData() {
    try {
      const res = await fetch('/api/user/export-data', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'winlab-profile-export.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans">
      <PageNav />
      <div className="max-w-4xl mx-auto px-6 py-20">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Account</p>
        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">Profile</h1>
        <p className="text-gray-500 mb-16 max-w-2xl leading-relaxed">
          Manage your operator identity, security settings, and data export from one place.
        </p>

        {loading && (
          <div className="rounded-3xl border border-white/5 bg-zinc-950 p-8 text-sm text-gray-500">
            Loading profile...
          </div>
        )}

        {!loading && authError && (
          <div className="rounded-3xl border border-red-500/15 bg-red-500/5 p-8 max-w-2xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase italic tracking-tight mb-2">Sign in required</h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  This page uses your active WinLab session. Sign in from the dashboard, then open `/profile` again.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && user && (
          <div className="space-y-8">
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-[28px] border border-white/5 bg-zinc-950 p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Plan</p>
                <p className="text-2xl font-black text-white italic">{formatPlan(user.plan)}</p>
              </div>
              <div className="rounded-[28px] border border-white/5 bg-zinc-950 p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Total XP</p>
                <p className="text-2xl font-black text-white italic">{user.totalXp ?? 0}</p>
              </div>
              <div className="rounded-[28px] border border-white/5 bg-zinc-950 p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Current Streak</p>
                <p className="text-2xl font-black text-white italic">{user.currentStreak ?? 0}</p>
              </div>
              <div className="rounded-[28px] border border-white/5 bg-zinc-950 p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Joined</p>
                <p className="text-lg font-black text-white italic">{joinedDate}</p>
              </div>
            </section>

            <section className="rounded-[32px] border border-white/5 bg-zinc-950 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Identity</h2>
                  <p className="text-xs text-gray-500">Public name, nickname and account metadata.</p>
                </div>
              </div>

              <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/30"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Nickname</label>
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/30"
                    placeholder="Display nickname"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Email</label>
                  <input
                    value={user.email || ''}
                    readOnly
                    className="w-full bg-black/60 border border-white/5 rounded-2xl px-4 py-3 text-sm text-gray-500"
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className={`text-sm ${saveState === 'Profile updated.' ? 'text-emerald-400' : 'text-red-400'}`}>{saveState}</span>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-6 py-3 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest italic hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {profileSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
              <div className="rounded-[32px] border border-white/5 bg-zinc-950 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Password</h2>
                    <p className="text-xs text-gray-500">Change your credentials without leaving the dashboard.</p>
                  </div>
                </div>

                <form onSubmit={updatePassword} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Current password</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      minLength={8}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/30"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className={`text-sm ${passwordState === 'Password updated.' ? 'text-emerald-400' : 'text-red-400'}`}>{passwordState}</span>
                    <button
                      type="submit"
                      disabled={passwordSaving || !oldPassword || !newPassword}
                      className="px-6 py-3 rounded-2xl border border-white/10 text-white font-black uppercase tracking-widest hover:bg-white/5 transition-all disabled:opacity-50"
                    >
                      {passwordSaving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-[32px] border border-white/5 bg-zinc-950 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                    <Download className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Data Export</h2>
                    <p className="text-xs text-gray-500">Download your stored profile, progress and certificates.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Exports are generated from the authenticated account in JSON format and include profile metadata, saved lab progress and issued certificates.
                  </p>
                  <button
                    type="button"
                    onClick={exportData}
                    className="w-full px-6 py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                  >
                    Export My Data
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
