export const glossary = {
  // IT → EN fixed DevOps terminology
  "coda": "queue",
  "ambiente": "environment",
  "servizio": "service",
  "istanza": "instance",
  "errore": "error",
  "incidente": "incident",
  "log": "log",
  "processo": "process",
  "rete": "network",
  "porta": "port",
  "disco": "disk",
  "memoria": "memory",
  "permesso": "permission",
  "configurazione": "configuration",
  "riavvio": "restart",
  "avvio": "start",
  "arresto": "stop",
  "connessione": "connection",
  "database": "database",
  "worker": "worker",
  "pipeline": "pipeline",
  "deploy": "deploy",
  "staging": "staging",
  "produzione": "production",
  "nodo": "node",
  "contenitore": "container",
  "immagine": "image",
  "volume": "volume",
  "certificato": "certificate",
  "firewall": "firewall",
  "bilanciatore": "load balancer",
  "replica": "replica",
  "shard": "shard",
  "timeout": "timeout",
  "latenza": "latency",
  "throughput": "throughput",
  "scalabilità": "scalability",
};

export function applyGlossary(text) {
  let result = text;
  for (const [it, en] of Object.entries(glossary)) {
    result = result.replace(new RegExp(`\\b${it}\\b`, 'gi'), en);
  }
  return result;
}
