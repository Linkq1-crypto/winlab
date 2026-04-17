// AISettings.jsx – AI training consent + incognito mode (EN / IT / Hinglish)
// Drop into user Settings page or as standalone route
import { useState, useEffect } from "react";

const COPY = {
  en: {
    title: "AI Training Settings",
    subtitle: "Help our tutor get smarter — or keep your data private. You choose.",
    trainingLabel: "Contribute to AI training",
    trainingDesc: "Your anonymous questions help the AI improve for everyone. All personal data is stripped automatically.",
    incognitoLabel: "Incognito Mode",
    incognitoDesc: "Temporarily disable AI training for this session. Your questions won't be saved for training.",
    viewAnonymization: "See how we anonymize data →",
    dataManagement: "Data Management",
    exportData: "Export my AI contributions",
    deleteData: "Delete my AI contributions",
    deleteConfirm: "Are you sure? This cannot be undone.",
    deleted: "Your AI training data has been deleted.",
    exported: "Your AI training data is ready for download.",
  },
  it: {
    title: "Impostazioni AI Training",
    subtitle: "Aiuta il tutor a diventare più bravo — o tieni i tuoi dati privati. Scegli tu.",
    trainingLabel: "Contribuisci al training AI",
    trainingDesc: "Le tue domande anonime aiutano l'AI a migliorare per tutti. I dati personali vengono rimossi automaticamente.",
    incognitoLabel: "Modalità Incognito",
    incognitoDesc: "Disabilita temporaneamente il training AI per questa sessione. Le tue domande non verranno salvate.",
    viewAnonymization: "Guarda come anonimizziamo i dati →",
    dataManagement: "Gestione Dati",
    exportData: "Esporta i miei contributi AI",
    deleteData: "Elimina i miei contributi AI",
    deleteConfirm: "Sei sicuro? Non si può annullare.",
    deleted: "I tuoi dati di training AI sono stati eliminati.",
    exported: "I tuoi dati di training AI sono pronti per il download.",
  },
  hi: {
    title: "AI Training Settings",
    subtitle: "Tutor ko smarter banao — ya apna data private rakho. Aapki choice.",
    trainingLabel: "AI training mein contribute karo",
    trainingDesc: "Aapke anonymous sawal AI ko sabke liye behtar banate hain. Personal data automatically strip ho jata hai.",
    incognitoLabel: "Incognito Mode",
    incognitoDesc: "Is session ke liye AI training temporarily band karo. Aapke sawal training ke liye save nahi honge.",
    viewAnonymization: "Dekho hum data ko kaise anonymize karte hain →",
    dataManagement: "Data Management",
    exportData: "Mere AI contributions export karo",
    deleteData: "Mere AI contributions delete karo",
    deleteConfirm: "Pakka? Yeh undo nahi hoga.",
    deleted: "Aapka AI training data delete ho gaya.",
    exported: "Aapka AI training data download ke liye ready hai.",
  },
};

export default function AISettings({ language = "en", token }) {
  const t = COPY[language] || COPY.en;
  const [consent, setConsent] = useState(null);
  const [incognito, setIncognito] = useState(false);
  const [showAnonExample, setShowAnonExample] = useState(false);
  const [notification, setNotification] = useState("");

  useEffect(() => {
    // Load from DB (authoritative); fall back to localStorage during fetch
    const cached = localStorage.getItem("winlab_ml_consent");
    if (cached !== null) setConsent(cached === "true");
    fetch("/api/user/profile", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const val = data.mlConsent === true;
          setConsent(val);
          localStorage.setItem("winlab_ml_consent", val);
        }
      })
      .catch(() => {});
    const incog = sessionStorage.getItem("winlab_incognito");
    setIncognito(incog === "true");
  }, []);

  function toggleConsent(val) {
    setConsent(val);
    localStorage.setItem("winlab_ml_consent", val);
    fetch("/api/user/ml-consent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mlConsent: val }),
    }).catch(() => {});
  }

  function toggleIncognito(val) {
    setIncognito(val);
    sessionStorage.setItem("winlab_incognito", val);
  }

  async function exportData() {
    try {
      const res = await fetch("/api/user/ai-training-data", {
        credentials: "include",
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "winlab-ai-training-data.json"; a.click();
        URL.revokeObjectURL(url);
        setNotification(t.exported);
      }
    } catch {}
    setTimeout(() => setNotification(""), 3000);
  }

  async function deleteData() {
    if (!confirm(t.deleteConfirm)) return;
    try {
      await fetch("/api/user/ai-training-data", {
        method: "DELETE",
        credentials: "include",
      });
      setNotification(t.deleted);
    } catch {}
    setTimeout(() => setNotification(""), 3000);
  }

  if (consent === null) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-lg font-bold text-white">{t.title}</h3>
        <p className="text-sm text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      {/* Notification */}
      {notification && (
        <div className="p-3 rounded-lg border border-emerald-600/30 bg-emerald-600/10 text-emerald-400 text-sm">
          {notification}
        </div>
      )}

      {/* AI Training Consent */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-slate-800/50">
        <div className="flex-1">
          <label className="text-sm font-semibold text-white">{t.trainingLabel}</label>
          <p className="text-xs text-slate-400 mt-1">{t.trainingDesc}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input type="checkbox" checked={consent} onChange={(e) => toggleConsent(e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-slate-700 rounded-full peer-checked:bg-emerald-500 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
        </label>
      </div>

      {/* Incognito Mode */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-slate-800/50">
        <div className="flex-1">
          <label className="text-sm font-semibold text-white">{t.incognitoLabel}</label>
          <p className="text-xs text-slate-400 mt-1">{t.incognitoDesc}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input type="checkbox" checked={incognito} onChange={(e) => toggleIncognito(e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-slate-700 rounded-full peer-checked:bg-red-500 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
        </label>
      </div>

      {/* Anonymization Example */}
      <div>
        <button onClick={() => setShowAnonExample(!showAnonExample)} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          {t.viewAnonymization}
        </button>
        {showAnonExample && (
          <div className="mt-3 space-y-3">
            {[
              { before: "My server 192.168.1.50 (john@corp.local) keeps crashing", after: "My server [IP] ([USER]@[DOMAIN]) keeps crashing" },
              { before: "Error in /home/mario.rossi/logs/app.log", after: "Error in [FILEPATH]/app.log" },
            ].map((ex, i) => (
              <div key={i} className="rounded-lg border border-slate-800 overflow-hidden text-xs">
                <div className="bg-red-600/10 px-3 py-1.5 border-b border-red-600/20">
                  <span className="text-red-400 font-semibold">Before:</span>
                  <span className="text-red-300 ml-2 font-mono">{ex.before}</span>
                </div>
                <div className="bg-green-600/10 px-3 py-1.5">
                  <span className="text-green-400 font-semibold">After:</span>
                  <span className="text-green-300 ml-2 font-mono">{ex.after}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Management */}
      <div className="pt-4 border-t border-slate-800">
        <h4 className="text-sm font-semibold text-white mb-3">{t.dataManagement}</h4>
        <div className="flex gap-3">
          <button onClick={exportData} className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
            {t.exportData}
          </button>
          <button onClick={deleteData} className="px-4 py-2 text-xs bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 rounded-lg transition-colors">
            {t.deleteData}
          </button>
        </div>
      </div>
    </div>
  );
}
