// LegalLayout.jsx – Privacy Policy + Terms of Service
import { useState } from "react";

const LAST_UPDATED = "April 2026";

// NOTE: "WinLab" is a provisional trading name. Full legal entity details
// (registered company name, address, VAT) will be added upon incorporation.

const PRIVACY = {
  headline: "Data Processing & Privacy Protocol",
  sections: [
    {
      title: "0. Data Controller",
      body: "The data controller is WinLab (trading name, incorporation pending), contactable at privacy@winlab.cloud. Full legal entity details (registered name, address, VAT number) will be published here upon company incorporation. Until then, WinLab operates as an individual sole-trader entity. For all data protection enquiries contact: privacy@winlab.cloud.",
    },
    {
      title: "1. Data Collection & Legal Basis",
      body: "We collect and process the following data under the specified legal bases (GDPR Art. 6): (a) Email, name, password hash — Art. 6(1)(b) performance of contract; (b) Lab progress and session state — Art. 6(1)(b) performance of contract; (c) Analytics and usage data — Art. 6(1)(a) consent, given via the cookie banner; (d) AI training interactions — Art. 6(1)(a) explicit consent, given separately; (e) Security and fraud prevention logs — Art. 6(1)(f) legitimate interest. Payment information is processed exclusively by Stripe Inc. — we never store raw card data.",
    },
    {
      title: "2. AI Processing & Training",
      body: "When using the AI Mentor, only your technical queries are transmitted to our processing partners. No personally identifiable information (PII) — including your name, email, IP address, or payment details — is ever shared with AI models or used for training without your explicit consent. All data is anonymized automatically before any AI training use. You can withdraw consent and delete all AI training data at any time via Settings → AI Training.",
    },
    {
      title: "3. Data Anonymization",
      body: "Our open-source anonymization system automatically removes IP addresses, email addresses, usernames, file paths, API keys, SSH keys, JWT tokens, and phone numbers from all data before it can be used for AI training. The code is publicly available for independent review.",
    },
    {
      title: "4. International Data Transfers",
      body: "Some of our sub-processors are located outside the EU/EEA: (a) Stripe Inc. (USA) — payment processing, covered by Stripe's EU Standard Contractual Clauses (SCCs) and adequacy decision; (b) Anthropic PBC (USA) — AI inference only, no personal data transmitted, covered by Anthropic's DPA and SCCs; (c) Resend Inc. (USA) — transactional email, covered by SCCs. All transfers are governed by appropriate safeguards under GDPR Art. 46. No personal data is transferred to countries without adequate protection without explicit SCCs in place.",
    },
    {
      title: "5. Your Rights",
      body: "Under GDPR you have the right to: (a) Access — obtain a copy of your personal data; (b) Rectification — correct inaccurate data; (c) Erasure — request deletion of your account and all personal data; (d) Restriction — limit how we process your data; (e) Portability — receive your data in a machine-readable format; (f) Objection — object to processing based on legitimate interest; (g) Withdraw consent — at any time, without affecting prior processing. To exercise any right contact privacy@winlab.cloud. We respond within 30 days.",
    },
    {
      title: "6. Right to Lodge a Complaint",
      body: "If you believe we are processing your data unlawfully, you have the right to lodge a complaint with the supervisory authority in your country of residence. For users in Italy: Garante per la Protezione dei Dati Personali — www.garanteprivacy.it. For users in other EU countries: find your national authority at edpb.europa.eu. For users in the UK: Information Commissioner's Office (ICO) — ico.org.uk.",
    },
    {
      title: "7. Age Restriction",
      body: "WinLab is not directed at children. You must be at least 16 years old to create an account (or the minimum age required by the law of your country of residence for digital consent, if higher). By registering, you confirm you meet this requirement.",
    },
    {
      title: "8. Cookies",
      body: "We use cookies in three categories: (a) Essential — httpOnly session cookie (JWT, 24h), required for login and security. No consent required. (b) Analytics — anonymous pageview, scroll depth, UTM source tracking. Requires consent. (c) AI Training — anonymized lab interaction data used to improve the AI Mentor. Requires explicit consent. You can manage preferences at any time via the cookie banner or Settings → Privacy. See our Cookie Policy for the full list of cookies and their retention periods.",
    },
    {
      title: "9. Data Retention & Deletion",
      body: "Your account data is retained for as long as your subscription is active. You may request complete deletion of your account, lab history, and all associated data at any time by emailing support@winlab.cloud. Deletion is processed within 30 days. Anonymized training data (with no personal identifiers) may be retained indefinitely.",
    },
    {
      title: "10. Security",
      body: "All traffic is encrypted in transit via TLS 1.3. Passwords are hashed with bcrypt (cost factor 12). Sensitive fields are encrypted with AES-256-CTR. Simulated terminal inputs are ephemeral and not stored permanently unless explicitly required for lab-completion validation.",
    },
  ],
};

const TERMS = {
  headline: "Service Level Agreement & Usage Terms",
  sections: [
    {
      title: "1. License",
      body: "Upon purchase, WINLAB grants you a non-transferable, non-exclusive, limited license to access our proprietary simulation environment for personal educational purposes. The simulation engine, lab scenarios, AI prompt structures, and all associated content remain the exclusive intellectual property of WINLAB.",
    },
    {
      title: "2. Prohibited Use",
      body: "You agree not to attempt to reverse-engineer, decompile, or extract the simulation engine or its underlying logic. You further agree not to use the AI Mentor to generate, test, or refine malicious scripts intended for use in real-world attacks, privilege escalation on systems you do not own, or any other activity that violates applicable law.",
    },
    {
      title: "3. Payments & Refunds",
      body: "Subscriptions (Pro, Business) are billed monthly or annually in advance via Stripe. You may cancel at any time; access continues until the end of the current billing period. Due to the immediate, digital nature of our lab content, refunds are not provided once a lab session has been initiated, except as required by applicable consumer protection law in your jurisdiction (including EU Directive 2011/83/EU on consumer rights).",
    },
    {
      title: "4. Age & Eligibility",
      body: "You must be at least 16 years old (or the minimum digital consent age in your country) to purchase a subscription. By completing a purchase you confirm you meet this requirement. Corporate accounts must be created by an authorised representative of the purchasing entity.",
    },
    {
      title: "5. Disclaimer of Liability",
      body: "WINLAB is a high-fidelity simulation environment. While our scenarios are designed to reflect real-world conditions accurately, we are not responsible for any consequences arising from applying lab techniques to actual production systems. Always validate procedures in a dedicated staging environment before deploying to production.",
    },
    {
      title: "6. B2B & Corporate Accounts",
      body: "Corporate (Business plan) account holders are solely responsible for the conduct of all invited team members operating under their organisation's account. WINLAB reserves the right to suspend or terminate accounts found in violation of these terms without prior notice.",
    },
    {
      title: "7. Governing Law & Disputes",
      body: "For users based in the European Union: these Terms are governed by the law of the user's country of residence, and disputes shall be submitted to the courts of that jurisdiction, in accordance with EU consumer protection rules. For users outside the EU: these Terms are governed by Italian law, and any disputes shall be subject to the exclusive jurisdiction of the courts of Italy. Nothing in this clause affects your statutory rights as a consumer.",
    },
    {
      title: "8. Changes to Terms",
      body: "We may update these Terms at any time. We will notify registered users by email at least 14 days before material changes take effect. Continued use of the service after the effective date constitutes acceptance of the revised Terms.",
    },
  ],
};

function LegalSection({ sections }) {
  return (
    <div className="space-y-6">
      {sections.map((s, i) => (
        <div key={i}>
          <h3 className="text-sm font-semibold text-slate-300 mb-1.5">{s.title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function LegalLayout({ onBack, initialTab = "privacy" }) {
  const [tab, setTab] = useState(initialTab); // "privacy" | "terms"
  const doc = tab === "privacy" ? PRIVACY : TERMS;

  return (
    <div className="winlab-public-page text-white">
      <div className="winlab-public-main max-w-2xl">

        {/* Header */}
        <div className="winlab-public-hero">
          <div className="flex items-center gap-1 mb-6">
            <span className="text-blue-500 font-black text-lg tracking-tight">WIN</span>
            <span className="text-white font-black text-lg tracking-tight">LAB</span>
          </div>

          {/* Tab switcher */}
          <div className="mb-6 flex w-full max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-1 sm:w-fit">
            {[
              { id: "privacy", label: "Privacy Policy" },
              { id: "terms",   label: "Terms of Service" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`min-h-[44px] whitespace-nowrap px-4 py-1.5 rounded-md text-xs font-medium transition-all
                  ${tab === t.id
                    ? "bg-slate-700 text-white"
                    : "text-slate-500 hover:text-slate-300"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="winlab-public-eyebrow mb-3 text-slate-600">
            Last Updated: {LAST_UPDATED}
          </p>
          <h1 className="winlab-public-title max-w-xl text-white">{doc.headline}</h1>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800 mb-8" />

        {/* Content */}
        <LegalSection sections={doc.sections} />

        {/* Divider */}
        <div className="border-t border-slate-800 mt-10 mb-8" />

        {/* Footer */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] text-slate-700">
              Questions? <a href="mailto:support@winlab.cloud" className="text-slate-500 hover:text-slate-400 underline underline-offset-2">support@winlab.cloud</a>
            </p>
            <button
              onClick={onBack}
              className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
            >
              ← Back to Dashboard
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-slate-600 pt-3 border-t border-slate-800/50">
            <a href="mailto:support@winlab.cloud" className="hover:text-slate-400 transition-colors">support@winlab.cloud</a>
            <a href="mailto:billing@winlab.cloud" className="hover:text-slate-400 transition-colors">billing@winlab.cloud</a>
            <a href="mailto:hello@winlab.cloud" className="hover:text-slate-400 transition-colors">hello@winlab.cloud</a>
            <a href="mailto:sales@winlab.cloud" className="hover:text-slate-400 transition-colors">sales@winlab.cloud</a>
            <a href="mailto:security@winlab.cloud" className="hover:text-slate-400 transition-colors">security@winlab.cloud</a>
            <a href="mailto:privacy@winlab.cloud" className="hover:text-slate-400 transition-colors">privacy@winlab.cloud</a>
          </div>
        </div>

      </div>
    </div>
  );
}
