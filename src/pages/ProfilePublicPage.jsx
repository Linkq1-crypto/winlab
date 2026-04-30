import { Download, KeyRound, Server, ShieldAlert, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function PageNav() {
  return (
    <nav className="winlab-public-nav">
      <a href="/" className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-red-600">
          <Server className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-lg font-black italic tracking-tighter text-white">WINLAB</span>
      </a>
      <div className="winlab-public-nav-links">
        <a href="/" className="text-xs text-gray-500 transition-colors hover:text-white">Back</a>
      </div>
    </nav>
  );
}

function formatPlan(plan) {
  if (!plan) return 'Starter';
  return String(plan).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase());
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

  async function saveProfile(event) {
    event.preventDefault();
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
      setUser((current) => (current ? { ...current, ...data } : current));
      setSaveState('Profile updated.');
    } catch {
      setSaveState('Network error while saving profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function updatePassword(event) {
    event.preventDefault();
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
    <div className="winlab-public-page font-sans">
      <PageNav />
      <div className="winlab-public-main max-w-4xl">
        <div className="winlab-public-hero">
          <p className="winlab-public-eyebrow">Account</p>
          <h1 className="winlab-public-title">Profile</h1>
          <p className="winlab-public-copy mb-8">
            Manage identity, security, and exports without forcing a crowded desktop dashboard onto a phone screen.
          </p>
        </div>

        {loading && <div className="winlab-public-card text-sm text-gray-500">Loading profile...</div>}

        {!loading && authError && (
          <div className="winlab-public-card max-w-2xl border-red-500/15 bg-red-500/5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-600/10 text-red-500">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="mb-2 text-xl font-black text-white">Sign in required</h2>
                <p className="text-sm leading-relaxed text-gray-400">
                  This page uses your active WinLab session. Sign in from the dashboard, then open `/profile` again.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && user && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Plan', formatPlan(user.plan)],
                ['Total XP', user.totalXp ?? 0],
                ['Current streak', user.currentStreak ?? 0],
                ['Joined', joinedDate],
              ].map(([label, value]) => (
                <div key={label} className="winlab-public-card">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</p>
                  <p className="text-xl font-black text-white">{value}</p>
                </div>
              ))}
            </section>

            <section className="winlab-public-card">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600/10 text-red-500">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Identity</h2>
                  <p className="text-xs text-gray-500">Public name, nickname and account metadata.</p>
                </div>
              </div>

              <form onSubmit={saveProfile} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-600">Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="min-h-[44px] w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-500/30" placeholder="Your name" />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-600">Nickname</label>
                  <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="min-h-[44px] w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-500/30" placeholder="Display nickname" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-600">Email</label>
                  <input value={user.email || ''} readOnly className="min-h-[44px] w-full rounded-2xl border border-white/5 bg-black/60 px-4 py-3 text-sm text-gray-500" />
                </div>
                <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className={`text-sm ${saveState === 'Profile updated.' ? 'text-emerald-400' : 'text-red-400'}`}>{saveState}</span>
                  <button type="submit" disabled={profileSaving} className="min-h-[48px] rounded-2xl bg-red-600 px-6 py-3 text-sm font-black text-white disabled:opacity-50">
                    {profileSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="winlab-public-card">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600/10 text-red-500">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Password</h2>
                    <p className="text-xs text-gray-500">Change credentials without leaving the dashboard.</p>
                  </div>
                </div>

                <form onSubmit={updatePassword} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-600">Current password</label>
                    <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="min-h-[44px] w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-500/30" />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-600">New password</label>
                    <input type="password" value={newPassword} minLength={8} onChange={(e) => setNewPassword(e.target.value)} className="min-h-[44px] w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-500/30" />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className={`text-sm ${passwordState === 'Password updated.' ? 'text-emerald-400' : 'text-red-400'}`}>{passwordState}</span>
                    <button type="submit" disabled={passwordSaving || !oldPassword || !newPassword} className="min-h-[48px] rounded-2xl border border-white/10 px-6 py-3 text-sm font-black text-white disabled:opacity-50">
                      {passwordSaving ? 'Updating...' : 'Update password'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="winlab-public-card">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600/10 text-red-500">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Data export</h2>
                    <p className="text-xs text-gray-500">Download profile, progress, and certificate data.</p>
                  </div>
                </div>

                <p className="mb-4 text-sm leading-relaxed text-gray-400">
                  Exports are generated from the authenticated account in JSON format and include profile metadata, saved lab progress, and issued certificates.
                </p>
                <button type="button" onClick={exportData} className="min-h-[48px] w-full rounded-2xl bg-white px-6 py-4 text-sm font-black text-black">
                  Export my data
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
