// OnboardingFlow.jsx – Post-signup intent selection → AI consent → auto-launch first lab
import { useState, useEffect } from "react";
import { useLab } from "./LabContext";
import AIPrivacyModal from "./AIPrivacyModal";

function detectLanguage() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Kolkata") || tz.includes("Calcutta") || tz.includes("Mumbai")) return "hi";
    const lang = (navigator.language || navigator.languages?.[0] || "").toLowerCase();
    if (lang.includes("it") || lang.includes("italian")) return "it";
    if (lang.includes("in") || lang.includes("hi")) return "hi";
  } catch {}
  return "en";
}

const INTENTS = [
  { id: "linux",    icon: "🐧", label: "Linux Administration",  labs: ["linux-terminal"],                       desc: "Master the terminal, services, and troubleshooting" },
  { id: "cloud",    icon: "☁️", label: "Cloud & Virtualization", labs: ["vsphere", "os-install"],               desc: "vSphere, VM provisioning, infrastructure as code" },
  { id: "devops",   icon: "🔧", label: "DevOps & Automation",    labs: ["real-server", "advanced-scenarios"],   desc: "CI/CD, monitoring, incident response" },
  { id: "security", icon: "🛡️", label: "Security & Hardening",   labs: ["sssd-ldap", "security-audit"],        desc: "LDAP, firewalls, audit & compliance" },
];

export default function OnboardingFlow({ onComplete }) {
  const { canAccessLab, LABS } = useLab();
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(0); // 0 = intent, 1 = AI consent, 2 = confirm
  const [language] = useState(detectLanguage());
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Check if user already gave AI consent
  useEffect(() => {
    const consent = localStorage.getItem("winlab_ai_consent");
    if (consent !== null) {
      // Already consented or declined — skip modal
    }
  }, []);

  function handleIntentContinue() {
    if (!selected) return;
    const alreadyConsented = localStorage.getItem("winlab_ai_consent");
    if (alreadyConsented === null) {
      // First time — show AI privacy modal
      setShowPrivacyModal(true);
    } else {
      setStep(2);
    }
  }

  function handleAIConsent(consent) {
    setAiConsentState(consent);
    setShowPrivacyModal(false);
    setStep(2);
  }

  function handleContinue() {
    if (!selected) return;
    const intent = INTENTS.find(i => i.id === selected);
    const firstLab = intent.labs.find(l => canAccessLab(l)) || intent.labs[0];
    if (onComplete) onComplete(firstLab);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/[0.06] rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-1 mb-2">
          <span className="text-blue-500 font-black text-xl tracking-tight">WIN</span>
          <span className="text-white font-black text-xl tracking-tight">LAB</span>
        </div>

        {step === 0 && (
          <>
            <h1 className="text-3xl font-black text-white mb-2">What do you want to learn?</h1>
            <p className="text-slate-400 text-sm mb-8">Pick your focus area. We'll start your first lab right away.</p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {INTENTS.map(intent => (
                <button
                  key={intent.id}
                  onClick={() => setSelected(intent.id)}
                  className={`flex flex-col gap-2 p-5 rounded-xl border text-left transition-all min-h-[120px]
                    ${selected === intent.id
                      ? "border-blue-600 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700"}`}
                >
                  <span className="text-3xl">{intent.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-white leading-snug">{intent.label}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{intent.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && selected && (
          <>
            {(() => {
              const intent = INTENTS.find(i => i.id === selected);
              const firstLab = intent.labs.find(l => canAccessLab(l)) || intent.labs[0];
              const labData = LABS.find(l => l.id === firstLab);
              return (
                <>
                  <h1 className="text-3xl font-black text-white mb-2">Ready to start?</h1>
                  <p className="text-slate-400 text-sm mb-8">We'll launch your first lab now.</p>

                  <div className="p-6 rounded-xl border border-blue-600/30 bg-blue-600/5 mb-8">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{labData?.icon || "🖥️"}</span>
                      <div>
                        <p className="text-lg font-bold text-white">{labData?.name || intent.label}</p>
                        <p className="text-xs text-slate-400 mt-1">First lab in your {intent.label} path</p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {step === 0 && (
            <button
              onClick={() => setStep(1)}
              disabled={!selected}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Continue →
            </button>
          )}
          {step === 1 && (
            <>
              <button
                onClick={() => setStep(0)}
                className="px-5 py-3 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 rounded-lg text-sm font-medium transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleContinue}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                Start Lab →
              </button>
            </>
          )}
        </div>

        {/* Skip */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Or{" "}
          <button
            onClick={() => onComplete && onComplete("linux-terminal")}
            className="text-slate-500 hover:text-slate-300 underline underline-offset-2"
          >
            skip to dashboard
          </button>
        </p>
      </div>
    </div>
  );
}
