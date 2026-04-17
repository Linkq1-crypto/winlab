// ReferralSystem.jsx – Peer Peering & Corporate Escalation with geek terminal style
import { useState, useEffect } from "react";
import { useLab } from "./LabContext";

// Terminal-style line animation
function TerminalLine({ text, delay = 0, prefix = ">" }) {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  
  if (!visible) return null;
  
  return (
    <div className="font-mono text-sm mb-1">
      <span className="text-green-400">{prefix}</span>
      <span className="text-slate-300 ml-2">{text}</span>
    </div>
  );
}

// Copy to clipboard button with feedback
function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  
  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-green-400 border border-green-600/30 rounded transition-all"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

// Stats display in terminal format
function TerminalStats({ peer, corporate }) {
  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 font-mono text-xs">
      <div className="text-slate-500 mb-2"># Referral Statistics</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-green-400 mb-1">👥 Peer Peering</div>
          <div className="text-slate-300">Tokens generated: <span className="text-blue-400 font-bold">{peer.tokens}</span></div>
          <div className="text-slate-300">Conversions: <span className="text-green-400 font-bold">{peer.conversions}</span></div>
          <div className="text-slate-300">Discount: <span className="text-yellow-400">{peer.discount}%</span></div>
        </div>
        <div>
          <div className="text-purple-400 mb-1">🏢 Corporate Escalation</div>
          <div className="text-slate-300">Tokens generated: <span className="text-blue-400 font-bold">{corporate.tokens}</span></div>
          <div className="text-slate-300">Conversions: <span className="text-green-400 font-bold">{corporate.conversions}</span></div>
          <div className="text-slate-300">Discount: <span className="text-yellow-400">{corporate.discount}%</span></div>
        </div>
      </div>
    </div>
  );
}

export default function ReferralSystem() {
  const { token, plan } = useLab();
  const [activeTab, setActiveTab] = useState("peer"); // "peer" | "corporate" | "stats"
  const [peerToken, setPeerToken] = useState(null);
  const [peerLink, setPeerLink] = useState(null);
  const [corporateToken, setCorporateToken] = useState(null);
  const [corporateLink, setCorporateLink] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load existing referral stats on mount
  useEffect(() => {
    if (token) loadStats();
  }, [token]);

  async function loadStats() {
    try {
      const res = await fetch("/api/referral/stats", {
        headers: { }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        if (data.referralLink) {
          setPeerLink(data.referralLink);
          // Extract token from link
          const tokenParam = new URL(data.referralLink).searchParams.get("ref");
          if (tokenParam) setPeerToken(tokenParam);
        }
      }
    } catch (err) {
      console.error("Failed to load referral stats:", err);
    }
  }

  async function generatePeerToken() {
    if (!token) {
      setError("Authentication required. Please log in first.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/referral/generate-peer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setPeerToken(data.token);
        setPeerLink(data.link);
        setSuccess("✓ Peer referral token generated successfully");
        loadStats();
      } else {
        setError(data.error || "Failed to generate token");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function generateCorporateToken() {
    if (!token) {
      setError("Authentication required. Please log in first.");
      return;
    }
    
    if (!companyName.trim() || !companyEmail.trim()) {
      setError("Company name and email are required");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/referral/generate-corporate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ companyName, companyEmail })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setCorporateToken(data.token);
        setCorporateLink(data.link);
        setSuccess("✓ Corporate escalation token generated successfully");
        loadStats();
      } else {
        setError(data.error || "Failed to generate token");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2 font-mono">
          <span className="text-green-400">sudo</span> adduser --friend
        </h2>
        <p className="text-slate-400 text-sm">
          Propagate knowledge in your network. Invite peers and get discounts on your next renewal.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-6 font-mono text-sm">
        {[
          { id: "peer", label: "👥 Peer Peering", desc: "20% discount" },
          { id: "corporate", label: "🏢 Corporate", desc: "30% discount" },
          { id: "stats", label: "📊 Stats", desc: "Analytics" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 rounded-lg border transition-all text-left
              ${activeTab === tab.id 
                ? "bg-blue-600/20 border-blue-600/40 text-white" 
                : "bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"}`}
          >
            <div className="font-semibold">{tab.label}</div>
            <div className="text-xs text-slate-500">{tab.desc}</div>
          </button>
        ))}
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-600/10 border border-red-600/30 rounded-lg font-mono text-sm text-red-400">
          <span className="text-red-500">[ERROR]</span> {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-600/10 border border-green-600/30 rounded-lg font-mono text-sm text-green-400">
          {success}
        </div>
      )}

      {/* Peer Peering Tab */}
      {activeTab === "peer" && (
        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-6 font-mono">
          <div className="mb-4">
            <TerminalLine text="systemctl status community-growth" delay={0} />
            <TerminalLine text="● status: waiting_for_peers" delay={300} />
            <TerminalLine text="" delay={500} />
            <TerminalLine text='Hint: Invite a friend to get 20% discount' delay={800} prefix="!" />
            <TerminalLine text="Use this code with caution." delay={1100} />
          </div>

          {peerToken ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/60 border border-green-600/30 rounded">
                <div className="text-xs text-slate-500 mb-2"># Your Invite Token</div>
                <div className="text-lg text-green-400 font-bold mb-3">{peerToken}</div>
                <CopyButton text={peerToken} label="📋 Copy Token" />
              </div>
              
              <div className="p-4 bg-slate-800/60 border border-blue-600/30 rounded">
                <div className="text-xs text-slate-500 mb-2"># Referral Link</div>
                <div className="text-xs text-blue-400 break-all mb-3">{peerLink}</div>
                <CopyButton text={peerLink} label="🔗 Copy Link" />
              </div>
              
              <div className="text-xs text-slate-500 mt-4">
                <div className="text-slate-400 mb-1"># How it works:</div>
                <div>1. Share your token or link with a friend</div>
                <div>2. When they deploy a PRO plan, you get -20%</div>
                <div>3. Discount applies to your next renewal</div>
              </div>
            </div>
          ) : (
            <button
              onClick={generatePeerToken}
              disabled={loading}
              className="w-full py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-400 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "⏳ Generating token..." : "🔑 Generate Invite Token"}
            </button>
          )}
        </div>
      )}

      {/* Corporate Escalation Tab */}
      {activeTab === "corporate" && (
        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-6 font-mono">
          <div className="mb-4">
            <TerminalLine text="Escalate to Enterprise Role" delay={0} />
            <TerminalLine text="" delay={300} />
            <TerminalLine text="Tired of seeing your team make production errors?" delay={600} prefix="?" />
            <TerminalLine text="Provision WINLAB in your company." delay={900} />
            <TerminalLine text="Get -30% Root Privilege discount on your licenses" delay={1200} />
          </div>

          {!corporateToken && (
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="acme-corp"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-600 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Company Email</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={e => setCompanyEmail(e.target.value)}
                  placeholder="it@winlab.cloud"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-600 font-mono"
                />
              </div>
            </div>
          )}

          {corporateToken ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/60 border border-purple-600/30 rounded">
                <div className="text-xs text-slate-500 mb-2"># Corporate Escalation Token</div>
                <div className="text-lg text-purple-400 font-bold mb-3">{corporateToken}</div>
                <CopyButton text={corporateToken} label="📋 Copy Token" />
              </div>
              
              <div className="p-4 bg-slate-800/60 border border-blue-600/30 rounded">
                <div className="text-xs text-slate-500 mb-2"># Escalation Link</div>
                <div className="text-xs text-blue-400 break-all mb-3">{corporateLink}</div>
                <CopyButton text={corporateLink} label="🔗 Copy Link" />
              </div>
              
              <div className="text-xs text-slate-500 mt-4">
                <div className="text-slate-400 mb-1"># Enterprise benefits:</div>
                <div>1. Share with your company's IT decision makers</div>
                <div>2. When Business plan activates, you get -30%</div>
                <div>3. Root Privilege applies to your personal licenses</div>
              </div>
            </div>
          ) : (
            <button
              onClick={generateCorporateToken}
              disabled={loading}
              className="w-full py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/40 text-purple-400 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "⏳ Requesting handshake..." : "🤝 Request Corporate Handshake"}
            </button>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === "stats" && (
        stats ? (
          <TerminalStats peer={stats.peer} corporate={stats.corporate} />
        ) : (
          <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-8 text-center font-mono">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-slate-400">No referral data yet</div>
            <div className="text-xs text-slate-600 mt-2">Generate your first token to see statistics</div>
          </div>
        )
      )}

      {/* Footer hint */}
      <div className="mt-6 p-4 bg-slate-900/40 border border-slate-800 rounded-lg font-mono text-xs text-slate-500">
        <div className="text-slate-400 mb-1">💡 Pro tip:</div>
        <div>Share your tokens on social media, Discord, or with colleagues. The more peers deploy, the more you save!</div>
      </div>
    </div>
  );
}
