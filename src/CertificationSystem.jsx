// CertificationSystem.jsx – Generate + display + verify certificate
import { useState } from "react";
import { useLab } from "./LabContext";

// ── Certificate card (rendered + printable) ───────────────────────────────────
function CertCard({ certId, name, issuedAt }) {
  const date = new Date(issuedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });

  return (
    <div
      id="winlab-cert"
      className="relative mx-auto max-w-2xl rounded-2xl border-2 border-blue-600/40 bg-[#0d0d0f] p-10 text-center overflow-hidden"
    >
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-blue-600/60 rounded-tl-2xl" />
      <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-blue-600/60 rounded-tr-2xl" />
      <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-blue-600/60 rounded-bl-2xl" />
      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-blue-600/60 rounded-br-2xl" />

      {/* Logo */}
      <div className="mb-6">
        <span className="text-blue-600 font-black text-3xl tracking-tight">WIN</span>
        <span className="text-white font-black text-3xl tracking-tight">LAB</span>
      </div>

      <p className="text-slate-400 text-sm uppercase tracking-widest mb-4">
        Certificate of Excellence
      </p>

      <p className="text-slate-400 mb-2">This certifies that</p>
      <h2 className="text-3xl font-bold text-white mb-6">{name || "WINLAB Graduate"}</h2>

      <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto mb-8">
        has successfully completed all <strong className="text-white">10 professional sysadmin labs</strong>{" "}
        on WINLAB, demonstrating competency in Linux administration, RAID storage,
        virtualisation, LDAP/SSSD, and real-world incident response.
      </p>

      {/* Badge */}
      <div className="flex justify-center mb-8">
        <div className="w-20 h-20 rounded-full border-2 border-green-500/40 bg-green-500/10 flex items-center justify-center text-4xl">
          🏆
        </div>
      </div>

      <p className="text-slate-500 text-xs">Issued on {date}</p>
      <p className="text-slate-600 text-xs mt-1 font-mono">ID: {certId}</p>
    </div>
  );
}

// ── Public verifier ───────────────────────────────────────────────────────────
function CertVerifier() {
  const [certId, setCertId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function verify() {
    if (!certId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cert/verify/${encodeURIComponent(certId.trim())}`);
      setResult(await res.json());
    } catch {
      setResult({ valid: false, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-12 border-t border-slate-800 pt-8">
      <h3 className="text-lg font-semibold text-white mb-4">Verify a Certificate</h3>
      <div className="flex gap-3 max-w-md">
        <input
          value={certId}
          onChange={e => setCertId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && verify()}
          placeholder="WINLAB-1234567890-ABCDEF12"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 font-mono"
        />
        <button
          onClick={verify}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "…" : "Verify"}
        </button>
      </div>

      {result && (
        <div className={`
          mt-4 p-4 rounded-xl border text-sm max-w-md
          ${result.valid
            ? "bg-green-600/10 border-green-600/30 text-green-300"
            : "bg-red-600/10 border-red-600/30 text-red-300"}
        `}>
          {result.valid ? (
            <>
              <p className="font-semibold">✓ Valid certificate</p>
              <p className="text-slate-400 mt-1">Holder: {result.name || "—"}</p>
              <p className="text-slate-400">Issued: {new Date(result.issuedAt).toLocaleDateString()}</p>
              <p className="text-slate-400">Labs completed: {result.labsCompleted}</p>
            </>
          ) : (
            <p>✗ Certificate not found or invalid.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CertificationSystem() {
  const { completedCount, allCompleted, token, user } = useLab();

  const [cert, setCert]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  async function generate() {
    if (!token) { setError("Please sign in to generate your certificate."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cert/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setCert(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function printCert() {
    window.print();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Certificate of Excellence</h1>
      <p className="text-slate-400 mb-8">
        Complete all 10 labs to earn a verifiable certificate.
      </p>

      {/* Progress indicator */}
      {!allCompleted && (
        <div className="mb-8 p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-slate-400">Labs completed</span>
            <span className="text-white font-semibold">{completedCount} / 10</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-700"
              style={{ width: `${(completedCount / 10) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-3">
            {10 - completedCount} more lab{10 - completedCount !== 1 ? "s" : ""} to unlock your certificate.
          </p>
        </div>
      )}

      {/* Generate button */}
      {allCompleted && !cert && (
        <div className="mb-8 text-center">
          <p className="text-green-400 font-semibold mb-4">
            🎉 You've completed all 10 labs!
          </p>
          <button
            onClick={generate}
            disabled={loading}
            className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-lg transition-colors disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate My Certificate"}
          </button>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>
      )}

      {/* Certificate display */}
      {cert && (
        <div className="mb-6">
          <CertCard
            certId={cert.certId}
            name={user?.name}
            issuedAt={cert.issuedAt}
          />
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={printCert}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm border border-slate-700"
            >
              🖨️ Print / Save PDF
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(cert.certId)}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm border border-slate-700"
            >
              📋 Copy ID
            </button>
            <a
              href={`https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin + "/cert/" + cert.certId)}`}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
            >
              Share on LinkedIn
            </a>
          </div>
        </div>
      )}

      {/* Support link */}
      <div className="text-center text-xs text-slate-600 mb-8">
        <span>Certificate issues? </span>
        <a href="mailto:certification@winlab.cloud" className="text-slate-400 hover:text-slate-300 underline underline-offset-2">certification@winlab.cloud</a>
      </div>

      <CertVerifier />
    </div>
  );
}
