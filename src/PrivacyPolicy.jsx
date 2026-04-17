// PrivacyPolicy.jsx – Full privacy policy (EN / IT / Hinglish)
import { useState } from "react";

const POLICY = {
  en: {
    title: "Privacy Policy",
    lastUpdated: "April 2026",
    sections: [
      {
        heading: "1. Data Controller",
        content: "The data controller is WinLab (trading name, incorporation pending), reachable at privacy@winlab.cloud. Full legal entity details will be published upon company incorporation.",
      },
      {
        heading: "2. What We Collect & Legal Basis",
        content: "We process the following data under these legal bases (GDPR Art. 6): Email, name, password hash — Art. 6(1)(b) performance of contract; Lab progress — Art. 6(1)(b) performance of contract; Analytics — Art. 6(1)(a) consent; AI training data — Art. 6(1)(a) explicit consent; Security logs — Art. 6(1)(f) legitimate interest. Payment card details are never stored — processed exclusively by Stripe.",
      },
      {
        heading: "3. AI Training — Your Choice",
        content: "With your explicit consent, we may use your anonymized lab interactions to improve our AI tutor. All personal data (IP, name, email, file paths, keys) is automatically stripped before training use. You can withdraw consent at any time via Settings → AI Training.",
      },
      {
        heading: "4. Data Anonymization",
        content: "Our open-source anonymizer automatically removes IP addresses, email addresses, usernames, file paths, API keys, SSH keys, JWT tokens, and phone numbers from all data before AI training use. The code is publicly available for independent review.",
      },
      {
        heading: "5. International Transfers",
        content: "Some sub-processors are outside the EU/EEA: Stripe Inc. (USA) — payment processing, covered by SCCs; Anthropic PBC (USA) — AI inference, no personal data transmitted, covered by DPA + SCCs; Resend Inc. (USA) — transactional email, covered by SCCs. All transfers comply with GDPR Art. 46.",
      },
      {
        heading: "6. Data Storage & Security",
        content: "Your data is encrypted at rest and in transit (TLS 1.3). Passwords use bcrypt (cost 12). Sensitive fields use AES-256-CTR. Access is restricted to authorized personnel only.",
      },
      {
        heading: "7. Your Rights",
        content: "Under GDPR you have the right to: access, rectification, erasure, restriction, portability, objection, and withdrawal of consent. To exercise any right contact privacy@winlab.cloud — we respond within 30 days.",
      },
      {
        heading: "8. Right to Complain",
        content: "You have the right to lodge a complaint with your national supervisory authority. Italy: Garante — garanteprivacy.it. EU: edpb.europa.eu. UK: ICO — ico.org.uk.",
      },
      {
        heading: "9. Age Restriction",
        content: "WinLab is not directed at children under 16. By registering you confirm you meet the minimum digital consent age in your country of residence.",
      },
      {
        heading: "10. Data Retention",
        content: "Account data is retained while your account is active. Deletion requests are processed within 30 days. Anonymized training data may be retained indefinitely.",
      },
      {
        heading: "11. Contact",
        content: "Privacy: privacy@winlab.cloud — Security vulnerabilities: security@winlab.cloud.",
      },
    ],
  },
  it: {
    title: "Informativa sulla Privacy",
    lastUpdated: "Aprile 2026",
    sections: [
      {
        heading: "1. Titolare del Trattamento",
        content: "Il titolare del trattamento è WinLab (nome commerciale, costituzione societaria in corso), contattabile all'indirizzo privacy@winlab.cloud. I dati completi della persona giuridica (ragione sociale, sede, P.IVA) saranno pubblicati alla costituzione della società.",
      },
      {
        heading: "2. Dati Raccolti e Basi Giuridiche",
        content: "Trattiamo i seguenti dati con le rispettive basi giuridiche (Art. 6 GDPR): Email, nome, password hash — Art. 6(1)(b) esecuzione del contratto; Progressi nei lab — Art. 6(1)(b) esecuzione del contratto; Dati analytics — Art. 6(1)(a) consenso; Dati training AI — Art. 6(1)(a) consenso esplicito; Log di sicurezza — Art. 6(1)(f) interesse legittimo. I dati delle carte di pagamento non vengono mai memorizzati da noi — i pagamenti sono gestiti esclusivamente da Stripe.",
      },
      {
        heading: "3. Training AI — La Tua Scelta",
        content: "Con il tuo consenso esplicito, possiamo usare le tue interazioni anonimizzate nei lab per migliorare il nostro tutor AI. Tutti i dati personali (IP, nome, email, percorsi file, chiavi) vengono rimossi automaticamente prima dell'uso per training. Puoi ritirare il consenso in qualsiasi momento da Impostazioni → Training AI.",
      },
      {
        heading: "4. Anonimizzazione dei Dati",
        content: "Il nostro sistema open-source rimuove automaticamente indirizzi IP, email, nomi utente, percorsi file, chiavi API, chiavi SSH, token JWT e numeri di telefono da tutti i dati prima dell'uso per training AI. Il codice è disponibile pubblicamente per revisione indipendente.",
      },
      {
        heading: "5. Trasferimenti Internazionali",
        content: "Alcuni sub-responsabili si trovano fuori UE/SEE: Stripe Inc. (USA) — pagamenti, coperto da Clausole Contrattuali Standard (SCC); Anthropic PBC (USA) — inferenza AI, nessun dato personale trasmesso, coperto da DPA + SCC; Resend Inc. (USA) — email transazionali, coperto da SCC. Tutti i trasferimenti rispettano l'Art. 46 GDPR.",
      },
      {
        heading: "6. Sicurezza",
        content: "I tuoi dati sono crittografati in transito (TLS 1.3) e a riposo. Le password usano bcrypt (costo 12). I campi sensibili usano AES-256-CTR. L'accesso è limitato al personale autorizzato.",
      },
      {
        heading: "7. I Tuoi Diritti",
        content: "Ai sensi del GDPR hai diritto di: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso. Per esercitare qualsiasi diritto scrivi a privacy@winlab.cloud — rispondiamo entro 30 giorni.",
      },
      {
        heading: "8. Diritto di Reclamo",
        content: "Hai il diritto di proporre reclamo al Garante per la Protezione dei Dati Personali: www.garanteprivacy.it. Per gli utenti in altri paesi UE: edpb.europa.eu.",
      },
      {
        heading: "9. Età Minima",
        content: "WinLab non è rivolta a minori di 16 anni. Registrandoti confermi di soddisfare il requisito di età minima per il consenso digitale nel tuo paese.",
      },
      {
        heading: "10. Conservazione dei Dati",
        content: "I dati dell'account vengono conservati finché l'account è attivo. Le richieste di cancellazione sono evase entro 30 giorni. I dati di training anonimizzati possono essere conservati indefinitamente.",
      },
      {
        heading: "11. Contatti",
        content: "Privacy: privacy@winlab.cloud — Segnalazioni di sicurezza: security@winlab.cloud.",
      },
    ],
  },
  hi: {
    title: "Privacy Policy",
    lastUpdated: "11 April 2026",
    sections: [
      {
        heading: "1. Hum Kya Collect Karte Hain",
        content: "Hum aapka email, naam, aur learning progress collect karte hain WINLAB service provide karne ke liye. Hum kabhi payment card details collect ya store nahi karte — sab payments Stripe se securely process hote hain.",
      },
      {
        heading: "2. Hum Aapka Data Kaise Use Karte Hain",
        content: "Aapka data sirf iske liye use hota hai: (a) account banana aur manage karna, (b) learning progress track karna, (c) AI-powered tutoring dena, aur (d) anonymized data analysis se services improve karna.",
      },
      {
        heading: "3. AI Training — Aapki Choice",
        content: "Aapke explicit consent ke saath, hum aapke anonymized questions aur interactions use kar sakte hain apne AI tutor ko improve karne ke liye. Saara personal data (IP, naam, email, file paths) automatically strip ho jata hai training se pehle. Aap kabhi bhi consent withdraw kar sakte ho.",
      },
      {
        heading: "4. Data Anonymization",
        content: "Humara open-source anonymizer automatically IP addresses, emails, usernames, file paths, API keys, SSH keys, JWT tokens, aur phone numbers remove karta hai AI training se pehle. Code publicly available hai independent review ke liye.",
      },
      {
        heading: "5. Data Storage aur Security",
        content: "Aapka personal data rest aur transit dono mein encrypted hai. Hum password hashing ke liye bcrypt aur sensitive fields ke liye AES-256-CTR encryption use karte hain. Access sirf authorized personnel tak limited hai.",
      },
      {
        heading: "6. Aapke Rights",
        content: "Aapka right hai: (a) apna data access karna, (b) saare AI training contributions export karna, (c) AI training data delete karna, (d) AI training consent withdraw karna, (e) account deletion request karna. Humse contact karo privacy@winlab.cloud par.",
      },
      {
        heading: "7. Third-Party Services",
        content: "Hum Stripe use karte hain payments ke liye, Anthropic/DashScope AI services ke liye, aur Prisma database management ke liye. Inmein se koi provider aapke personal data ko access nahi kar sakta beyond what is necessary.",
      },
      {
        heading: "8. Data Retention",
        content: "Hum aapka account data tab tak retain karte hain jab tak account active hai. Agar aap account delete karte ho, saara personal data 30 days mein permanently remove ho jata hai. Anonymized training data indefinitely retain ho sakta hai.",
      },
      {
        heading: "9. Contact",
        content: "Kisi bhi privacy-related question ke liye, humse contact karo privacy@winlab.cloud par. Security vulnerability reports ke liye: security@winlab.cloud.",
      },
    ],
  },
};

export default function PrivacyPolicy({ language = "en" }) {
  const t = POLICY[language] || POLICY.en;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-sm text-slate-500">Last updated: {t.lastUpdated}</p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {t.sections.map((section, i) => (
            <div key={i} className="border-b border-slate-800 pb-6">
              <h2 className="text-lg font-semibold text-white mb-3">{section.heading}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <a href="/" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
