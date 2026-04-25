// Dashboard.jsx — WinLab internal dashboard
import { useState, useEffect, useRef, useCallback } from "react";

const T = {
  bg:     '#080808',
  bg1:    '#0e0e0e',
  bg2:    '#141414',
  border: '#222222',
  dim:    '#444444',
  mid:    '#777777',
  light:  '#aaaaaa',
  white:  '#e8e8e8',
  orange: '#ff4500',
  green:  '#16a34a',
  red:    '#dc2626',
  mono:   "'IBM Plex Mono', monospace",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Bebas+Neue&display=swap');
  #wl-dash * { box-sizing: border-box; }
  #wl-dash .wl-block {
    border: 1px solid ${T.border};
    padding: 24px;
    background: ${T.bg1};
  }
  #wl-dash .wl-eyebrow {
    font-family: ${T.mono};
    font-size: 9px;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: ${T.orange};
    margin-bottom: 10px;
  }
  #wl-dash .wl-item {
    font-family: ${T.mono};
    font-size: 12px;
    color: ${T.light};
    padding: 12px 0;
    border-bottom: 1px solid ${T.border};
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: color .2s, background .2s;
  }
  #wl-dash .wl-item:last-child { border-bottom: none; }
  #wl-dash .wl-item:hover { color: #fff; background: ${T.bg2}; padding-left: 8px; }
  #wl-dash .wl-btn {
    font-family: ${T.mono};
    font-size: 10px;
    font-weight: 500;
    letter-spacing: .1em;
    text-transform: uppercase;
    background: #fff;
    color: #000;
    border: none;
    padding: 12px 28px;
    cursor: pointer;
    position: relative;
    transition: background .2s, color .2s;
  }
  #wl-dash .wl-btn::after {
    content: '';
    position: absolute;
    bottom: -3px; right: -3px;
    width: 100%; height: 100%;
    border: 1px solid ${T.orange};
    pointer-events: none;
    transition: bottom .2s, right .2s;
  }
  #wl-dash .wl-btn:hover { background: ${T.orange}; color: #fff; }
  #wl-dash .wl-btn:hover::after { bottom: -5px; right: -5px; }
  #wl-dash .wl-btn-ghost {
    font-family: ${T.mono};
    font-size: 10px;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: ${T.mid};
    background: none;
    border: 1px solid ${T.border};
    padding: 10px 20px;
    cursor: pointer;
    transition: color .2s, border-color .2s;
  }
  #wl-dash .wl-btn-ghost:hover { color: #fff; border-color: ${T.light}; }
  @keyframes wl-notify-in  { from { opacity:0; transform:translateY(8px);} to { opacity:1; transform:translateY(0);} }
  @keyframes wl-notify-out { from { opacity:1; } to { opacity:0; } }
`;

const WL_KEY = "wl_state";

function loadState(progress) {
  const saved = JSON.parse(localStorage.getItem(WL_KEY) || "null");
  const completed = Object.values(progress || {}).filter(l => l.completed).length;
  return {
    xp:        saved?.xp        ?? completed * 20,
    level:     saved?.level     ?? Math.max(1, Math.floor(completed / 2) + 1),
    streak:    saved?.streak    ?? 0,
    lastLogin: saved?.lastLogin ?? 0,
    referrals: saved?.referrals ?? 0,
  };
}

function saveState(s) {
  localStorage.setItem(WL_KEY, JSON.stringify(s));
}

const FAKE_BOARD = ["alex", "maria", "root_0x", "neo", "sys_eng"];

export default function Dashboard({ labs = [], progress = {}, plan, onOpenLab, onUpgrade, onReferral, onManageBilling, achievements = [] }) {
  const [state, setState]     = useState(() => loadState(progress));
  const [notifs, setNotifs]   = useState([]);
  const notifId               = useRef(0);

  // inject CSS once
  useEffect(() => {
    if (!document.getElementById("wl-dash-css")) {
      const el = document.createElement("style");
      el.id = "wl-dash-css";
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);

  // streak check on mount
  useEffect(() => {
    setState(s => {
      const next = { ...s };
      if (Date.now() - s.lastLogin > 86_400_000) next.streak = 0;
      saveState(next);
      return next;
    });
  }, []);

  // social proof ticker
  useEffect(() => {
    const msgs = [
      "🔥 12 users solved an incident",
      "⚡ someone reached level 5",
      "💥 new lab unlocked",
    ];
    const t = setInterval(() => notify(msgs[Math.floor(Math.random() * msgs.length)]), 9000);
    return () => clearInterval(t);
  }, []);

  const notify = useCallback((msg) => {
    const id = ++notifId.current;
    setNotifs(n => [...n, { id, msg }]);
    setTimeout(() => setNotifs(n => n.filter(x => x.id !== id)), 2600);
  }, []);

  function gainXP(amount) {
    setState(s => {
      const xp    = s.xp + amount;
      const level = xp >= s.level * 100 ? s.level + 1 : s.level;
      if (level > s.level) notify("⬆️ Level up!");
      const next = { ...s, xp, level };
      saveState(next);
      return next;
    });
  }

  function handleContinue() {
    const next = labs.find(l => !progress[l.id]?.completed);
    if (next) { gainXP(20); updateStreak(); onOpenLab?.(next.id); }
  }

  function updateStreak() {
    setState(s => {
      if (Date.now() - s.lastLogin > 86_400_000) {
        const next = { ...s, streak: s.streak + 1, lastLogin: Date.now() };
        saveState(next);
        return next;
      }
      return s;
    });
  }

  function copyInvite() {
    navigator.clipboard.writeText("https://winlab.cloud/invite/"+Math.random().toString(36).slice(2,8)).catch(()=>{});
    setState(s => { const n = { ...s, referrals: s.referrals + 1 }; saveState(n); return n; });
    notify("invite link copied ✓");
  }

  const completedCount = Object.values(progress).filter(l => l.completed).length;
  const nextLab        = labs.find(l => !progress[l.id]?.completed);
  const hasPro         = ["pro","business","earlyAccess"].includes(plan);
  const labsToUnlock   = Math.max(0, 5 - completedCount);

  const quickLabs = labs.filter(l => !progress[l.id]?.completed).slice(0, 4);

  return (
    <div id="wl-dash" style={{ fontFamily: T.mono, color: T.white }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase", color: T.orange }}>// SYSTEM_DASHBOARD</div>
          <div style={{ display: "flex", gap: 10 }}>
            {hasPro && <button onClick={onManageBilling} className="wl-btn-ghost">Manage plan</button>}
            <button onClick={onReferral || copyInvite} className="wl-btn-ghost">Referrals ({state.referrals})</button>
            {achievements.length > 0 && (
              <span style={{ fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", color: T.mid, border: `1px solid ${T.border}`, padding: "6px 12px" }}>
                {achievements.length} badge{achievements.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* intelligent resume banner */}
        {nextLab && progress[nextLab.id] && !progress[nextLab.id].completed && (
          <div style={{ padding: "16px 20px", background: "rgba(255, 76, 0, 0.08)", border: `1px solid ${T.orangeDim}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.white, marginBottom: 4 }}>Welcome back!</div>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 300 }}>Want to pick up the <strong>{nextLab.title || nextLab.name || nextLab.id}</strong> lab right where you left off?</div>
            </div>
            <button onClick={() => onOpenLab?.(nextLab.id)} className="wl-btn-ghost" style={{ border: `1px solid ${T.orangeDim}`, color: T.orange }}>
              Resume →
            </button>
          </div>
        )}

        {/* ACTIVE INCIDENT */}
        <section className="wl-block" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          <div>
            <div className="wl-eyebrow">ACTIVE INCIDENT</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: ".02em", color: "#fff", marginBottom: 4 }}>
              {nextLab ? nextLab.title || nextLab.id : "All incidents cleared"}
            </div>
            <div style={{ fontSize: 11, color: T.mid }}>
              {nextLab ? `Production failure · ~${nextLab.estimatedMinutes || 6} min · +20 XP` : "You've completed every available lab."}
            </div>
          </div>
          {nextLab ? (
            <button className="wl-btn" onClick={handleContinue}>Continue →</button>
          ) : (
            <button className="wl-btn" onClick={onUpgrade}>Unlock more →</button>
          )}
        </section>

        {/* CORE METRICS */}
        <section className="wl-block" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0 }}>
          {[
            { id: "xp",     val: state.xp,     label: "XP" },
            { id: "level",  val: state.level,   label: "Level" },
            { id: "streak", val: state.streak,  label: "Day Streak" },
          ].map((m, i) => (
            <div key={m.id} style={{ padding: "0 24px", borderRight: i < 2 ? `1px solid ${T.border}` : "none", textAlign: "center" }}>
              <div className="wl-eyebrow" style={{ textAlign: "center" }}>{m.label}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: "#fff", lineHeight: 1 }}>{m.val}</div>
            </div>
          ))}
        </section>

        {/* PROGRESSION */}
        <section className="wl-block">
          <div className="wl-eyebrow">PROGRESSION</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: T.light }}>
              {completedCount} / {labs.length} labs completed
            </span>
            {!hasPro && labsToUnlock > 0 && (
              <button className="wl-btn-ghost" onClick={onUpgrade} style={{ fontSize: 9 }}>Unlock Pro →</button>
            )}
          </div>
          {/* progress bar */}
          <div style={{ height: 3, background: T.border, position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", left: 0, top: 0, height: "100%",
              width: `${labs.length ? (completedCount / labs.length) * 100 : 0}%`,
              background: T.orange,
              transition: "width .5s ease",
            }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: T.mid }}>
            {!hasPro && labsToUnlock > 0
              ? `${labsToUnlock} lab${labsToUnlock !== 1 ? "s" : ""} to unlock with Pro`
              : "All labs available"}
          </div>
        </section>

        {/* QUICK INCIDENTS */}
        <section className="wl-block">
          <div className="wl-eyebrow">QUICK INCIDENTS</div>
          {quickLabs.length === 0 ? (
            <div style={{ fontSize: 12, color: T.mid, padding: "12px 0" }}>No pending incidents.</div>
          ) : (
            <div>
              {quickLabs.map(lab => (
                <div key={lab.id} className="wl-item" onClick={() => { gainXP(10); onOpenLab?.(lab.id); }}>
                  <span>{lab.title || lab.id}</span>
                  <span style={{ fontSize: 10, color: T.dim }}>{lab.estimatedMinutes || "~6"} min · +{lab.xp || 10} XP →</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* LEADERBOARD */}
        <section className="wl-block">
          <div className="wl-eyebrow">TOP ENGINEERS</div>
          <div>
            {FAKE_BOARD.map((u, i) => (
              <div key={u} className="wl-item" style={{ cursor: "default" }}>
                <span style={{ color: i === 0 ? T.orange : T.light }}>#{i + 1} {u}</span>
                <span style={{ fontSize: 10, color: T.dim }}>{200 - i * 22} XP</span>
              </div>
            ))}
          </div>
        </section>

        {/* REFERRAL */}
        <section className="wl-block" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div className="wl-eyebrow">REFERRAL</div>
            <div style={{ fontSize: 13, color: T.light, marginBottom: 4 }}>
              Invite 3 engineers → unlock <span style={{ color: T.orange }}>PRO</span>
            </div>
            <div style={{ fontSize: 11, color: T.mid }}>
              Invited: <span style={{ color: T.light }}>{state.referrals}</span> / 3
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="wl-btn" onClick={copyInvite}>Copy invite link</button>
            {onReferral && (
              <button className="wl-btn-ghost" onClick={onReferral}>Dashboard →</button>
            )}
          </div>
        </section>

      </div>

      {/* NOTIFICATIONS */}
      <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 200 }}>
        {notifs.map(n => (
          <div key={n.id} style={{
            background: T.bg1, border: `1px solid ${T.border}`,
            padding: "10px 16px", fontFamily: T.mono, fontSize: 12, color: T.light,
            animation: "wl-notify-in .25s ease",
          }}>{n.msg}</div>
        ))}
      </div>
    </div>
  );
}
