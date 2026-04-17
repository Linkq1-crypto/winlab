// CertPublicPage.jsx — Public certificate verification at /cert/:certId
import { useEffect, useState } from "react";

export default function CertPublicPage({ certId }) {
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/cert/verify/${encodeURIComponent(certId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) setCert(data);
        else setError("Certificate not found or invalid.");
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [certId]);

  const date = cert ? new Date(cert.issuedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  }) : "";

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center px-4 py-16">
      {/* Logo */}
      <a href="/" className="mb-10">
        <span className="text-blue-500 font-black text-2xl tracking-tight">WIN</span>
        <span className="text-white font-black text-2xl tracking-tight">LAB</span>
      </a>

      {loading && (
        <p className="text-slate-400 text-sm animate-pulse">Verifying certificate…</p>
      )}

      {error && (
        <div className="max-w-md w-full bg-red-600/10 border border-red-600/30 rounded-2xl p-8 text-center">
          <p className="text-red-400 font-semibold text-lg mb-2">Invalid Certificate</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <p className="text-slate-500 text-xs mt-4 font-mono">{certId}</p>
        </div>
      )}

      {cert && (
        <div className="max-w-2xl w-full">
          {/* Valid badge */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="inline-flex items-center gap-2 bg-green-600/15 border border-green-600/30 text-green-400 text-sm font-semibold px-4 py-2 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Verified Certificate
            </span>
          </div>

          {/* Certificate card */}
          <div className="relative rounded-2xl border-2 border-blue-600/40 bg-[#0d0d0f] p-10 text-center overflow-hidden">
            <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-blue-600/60 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-blue-600/60 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-blue-600/60 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-blue-600/60 rounded-br-2xl" />

            <div className="mb-6">
              <span className="text-blue-600 font-black text-3xl tracking-tight">WIN</span>
              <span className="text-white font-black text-3xl tracking-tight">LAB</span>
            </div>

            <p className="text-slate-400 text-sm uppercase tracking-widest mb-4">
              Certificate of Excellence
            </p>

            <p className="text-slate-400 mb-2">This certifies that</p>
            <h2 className="text-3xl font-bold text-white mb-6">{cert.name || "WINLAB Graduate"}</h2>

            <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto mb-8">
              has successfully completed all{" "}
              <strong className="text-white">{cert.labsCompleted} professional sysadmin labs</strong>{" "}
              on WINLAB, demonstrating competency in Linux administration, RAID storage,
              virtualisation, LDAP/SSSD, and real-world incident response.
            </p>

            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-full border-2 border-green-500/40 bg-green-500/10 flex items-center justify-center text-4xl">
                🏆
              </div>
            </div>

            <p className="text-slate-500 text-xs">Issued on {date}</p>
            <p className="text-slate-600 text-xs mt-1 font-mono">ID: {cert.certId}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => window.print()}
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
          </div>

          <p className="text-center text-slate-600 text-xs mt-8">
            Verified at winlab.cloud · <a href="/" className="text-slate-400 hover:text-slate-300">Get your certificate →</a>
          </p>
        </div>
      )}
    </div>
  );
}
