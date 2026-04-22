import EnhancedTerminalLab from "./EnhancedTerminalLab";
import { CODEX_INCIDENT_LABS } from "./data/codexIncidentLabs";

const ID_MAP = {
  "codex-api-timeout": "api-timeout-n-plus-one",
  "codex-auth-bypass": "auth-bypass-jwt-trust",
  "codex-stripe-webhook": "stripe-webhook-forgery",
};

export default function CodexIncidentLab({ labId }) {
  const catalogId = ID_MAP[labId];
  const lab = CODEX_INCIDENT_LABS.find((l) => l.id === catalogId);

  if (!lab) {
    return <div className="p-8 text-slate-500">Codex incident lab not found.</div>;
  }

  return (
    <EnhancedTerminalLab
      labId={labId}
      codexIncident={{
        labId: lab.id,
        title: lab.title,
        scope: lab.scope,
        entryPoints: lab.entryPoints,
        goal: lab.goal,
        ...lab.incident,
      }}
      defaultMentorOpen={true}
    />
  );
}
