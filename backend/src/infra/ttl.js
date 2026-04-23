import { destroyContainer } from "./docker.js";

export function scheduleDestroy(containerName, ttl = 1800) {
  setTimeout(() => {
    destroyContainer(containerName);
  }, ttl * 1000);
}
