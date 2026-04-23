import { discoverLabs } from "./labDiscovery.js";
import { enhanceScope } from "./labScope.js";
import { buildPrompt } from "./promptBuilder.js";

export function createAIService({ repoRoot, aiRouter }) {
  if (!repoRoot) throw new Error("repoRoot is required");
  if (!aiRouter || typeof aiRouter.run !== "function") {
    throw new Error("aiRouter.run is required");
  }

  const labs = discoverLabs(repoRoot).map((lab) => ({
    ...enhanceScope(lab, { repoRoot }),
    repoRoot,
  }));

  function getLab(labId) {
    return labs.find((lab) => lab.id === labId);
  }

  async function run({ tenantId, userId, labId, mode = "review", context = {} }) {
    const lab = getLab(labId);
    if (!lab) throw new Error("Lab not found");

    const prompt = buildPrompt({ lab, mode });

    return aiRouter.run({
      tenantId,
      userId,
      lab,
      mode,
      context: {
        ...context,
        fileHint: context.fileHint || lab.entryPoints?.[0],
      },
      customPrompt: prompt,
    });
  }

  return { labs, getLab, run };
}

export default { createAIService };

