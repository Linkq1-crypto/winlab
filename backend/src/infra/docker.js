import { exec } from "child_process";

export function createLabContainer(userId, labId) {
  const name = `lab_${userId}_${Date.now()}`;

  exec(`docker run -dit --name ${name} alpine sh`, (err) => {
    if (err) console.error(err);
  });

  return name;
}

export function destroyContainer(name) {
  exec(`docker kill ${name}`);
}
