// AIPrivacyModal.jsx – Transparent AI training consent (EN / IT / Hinglish)
import { useState, useEffect } from "react";

// ─── Translations ──────────────────────────────────────────────────────────────
const COPY = {
  en: {
    title: "🤖 Help Our Tutor Get Smarter",
    subtitle: "Your questions make the AI better for everyone — and your data stays private.",
    howItWorks: "How It Works",
    step1: "You ask a question (e.g. \"How do I fix nginx error 502?\")",
    step2: "The system AUTOMATICALLY strips your IP, name, email, and personal paths",
    step3: "Only the anonymous technical question remains: \"How do I fix error [CODE] on [SERVER]?\"",
    step4: "This anonymous data helps the AI answer better for the next student",
    whatWeNeverDo: "🛡️ What We NEVER Do",
    never1: "Sell your data — ever",
    never2: "Show ads or profile you",
    never3: "Store your name, email, or IP in training data",
    toggleLabel: "Yes, help the tutor improve (anonymous)",
    noLabel: "No thanks, just use it for me",
    acceptBtn: "Got it — let's go →",
    settingsNote: "You can change this anytime in Settings.",
    viewCode: "See how we anonymize data →",
  },
  it: {
    title: "🤖 Aiuta il Tutor a Diventare Più Bravo",
    subtitle: "Le tue domande migliorano l'AI per tutti — e i tuoi dati restano privati.",
    howItWorks: "Come Funziona",
    step1: "Fai una domanda (es: \"Come fisso l'errore 502 di nginx?\")",
    step2: "Il sistema RIMUOVE AUTOMATICAMENTE IP, nome, email e percorsi personali",
    step3: "Resta solo la domanda tecnica anonima: \"Come fisso l'errore [CODICE] su [SERVER]?\"",
    step4: "Questi dati anonimi aiutano l'AI a rispondere meglio al prossimo studente",
    whatWeNeverDo: "🛡️ Cosa NON Facciamo MAI",
    never1: "Vendere i tuoi dati — mai",
    never2: "Mostrare pubblicità o profilarti",
    never3: "Salvare nome, email o IP nei dati di training",
    toggleLabel: "Sì, aiuta il tutor a migliorare (anonimo)",
    noLabel: "No grazie, usa solo per me",
    acceptBtn: "Ho capito — andiamo →",
    settingsNote: "Puoi cambiare questa opzione quando vuoi nelle Impostazioni.",
    viewCode: "Guarda come anonimizziamo i dati →",
  },
  hi: {
    title: "🤖 Tutor Ko Aur Smart Banao",
    subtitle: "Aapke sawal AI ko sabke liye behtar banate hain — aur aapka data private rehta hai.",
    howItWorks: "Kaise Kaam Karta Hai",
    step1: "Aap sawal poochte ho (jaise: \"Nginx error 502 kaise fix karu?\")",
    step2: "System AUTOMATICALLY aapka IP, naam, email aur personal paths hata deta hai",
    step3: "Sirf anonymous technical sawal bachta hai: \"Error [CODE] kaise fix karu [SERVER] par?\"",
    step4: "Yeh anonymous data AI ko next student ke liye behtar jawab dene mein help karta hai",
    whatWeNeverDo: "🛡️ Hum KABHI Nahi Karte",
    never1: "Aapka data bechte hain — kabhi nahi",
    never2: "Ads dikhate hain ya profile banate hain",
    never3: "Naam, email, ya IP training data mein save karte hain",
    toggleLabel: "Haan, tutor ko improve karne mein help karo (anonymous)",
    noLabel: "Nahi, sirf mere liye use karo",
    acceptBtn: "Samajh gaya — chalo shuru karte hain →",
    settingsNote: "Aap kabhi bhi Settings mein yeh change kar sakte ho.",
    viewCode: "Dekho hum data ko kaise anonymize karte hain →",
  },
};

// ─── Anonymization Example (shown in modal) ────────────────────────────────────
const ANONYMIZATION_EXAMPLES = {
  en: [
    {
      before: '"My server 192.168.1.50 (john@corp.local) keeps crashing when I run systemctl restart nginx"',
      after: '"My server [IP] ([USER]@[DOMAIN]) keeps crashing when I run systemctl restart nginx"',
    },
    {
      before: '"Error in /home/mario.rossi/logs/app.log — permission denied on line 42"',
      after: '"Error in [HOME_DIR]/[USER]/logs/app.log — permission denied on line 42"',
    },
  ],
  it: [
    {
      before: '"Il mio server 192.168.1.50 (mario@azienda.it) crasha quando faccio systemctl restart nginx"',
      after: '"Il mio server [IP] ([USER]@[DOMAIN]) crasha quando faccio systemctl restart nginx"',
    },
  ],
  hi: [
    {
      before: '"Mera server 192.168.1.50 (raj@company.in) crash ho raha hai jab main systemctl restart nginx run karta hu"',
      after: '"Mera server [IP] ([USER]@[DOMAIN]) crash ho raha hai jab main systemctl restart nginx run karta hu"',
    },
  ],
};

// ─── Main Modal ────────────────────────────────────────────────────────────────
export default function AIPrivacyModal({ language = "en", onAccept, onDecline }) {
  const t = COPY[language] || COPY.en;
  const examples = ANONYMIZATION_EXAMPLES[language] || ANONYMIZATION_EXAMPLES.en;
  const [consent, setConsent] = useState(true);
  const [showExample, setShowExample] = useState(false);

  useEffect(() => {
    // Trap focus inside modal
    const handleEsc = (e) => { if (e.key === "Escape") handleAccept(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  function handleAccept() {
    if (typeof onAccept === "function") onAccept(consent);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) handleAccept(); }}>
      <div className="bg-[#0d0d0f] border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">{t.title}</h2>
          <p className="text-sm text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">{t.howItWorks}</h3>
          <div className="space-y-3">
            {[t.step1, t.step2, t.step3, t.step4].map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-300">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Anonymization Example */}
        <div className="px-6 pb-4">
          <button onClick={() => setShowExample(!showExample)} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
            {t.viewCode}
          </button>
          {showExample && (
            <div className="mt-3 space-y-3">
              {examples.map((ex, i) => (
                <div key={i} className="rounded-lg border border-slate-800 overflow-hidden">
                  <div className="bg-red-600/10 px-3 py-1.5 border-b border-red-600/20">
                    <span className="text-[10px] text-red-400 font-semibold uppercase">Before (raw)</span>
                    <p className="text-xs text-red-300 mt-0.5 font-mono break-all">{ex.before}</p>
                  </div>
                  <div className="bg-green-600/10 px-3 py-1.5">
                    <span className="text-[10px] text-green-400 font-semibold uppercase">After (anonymous)</span>
                    <p className="text-xs text-green-300 mt-0.5 font-mono break-all">{ex.after}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What We Never Do */}
        <div className="px-6 py-4 bg-slate-900/50 border-y border-slate-800">
          <h3 className="text-sm font-semibold text-white mb-2">{t.whatWeNeverDo}</h3>
          <ul className="space-y-1 text-sm text-slate-400">
            <li>✗ {t.never1}</li>
            <li>✗ {t.never2}</li>
            <li>✗ {t.never3}</li>
          </ul>
        </div>

        {/* Consent Toggle */}
        <div className="px-6 py-5 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" checked={consent} onChange={() => setConsent(!consent)} className="sr-only peer" />
              <div className="w-10 h-6 bg-slate-700 rounded-full peer-checked:bg-emerald-500 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
            </div>
            <span className="text-sm text-white">{t.toggleLabel}</span>
          </label>

          {/* Accept Button */}
          <button
            onClick={handleAccept}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-[#0b0f1a] font-bold rounded-xl transition-colors"
          >
            {t.acceptBtn}
          </button>

          <p className="text-xs text-slate-600 text-center">{t.settingsNote}</p>
        </div>
      </div>
    </div>
  );
}
