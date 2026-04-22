export function createUserProgress() {
  return {
    unlocked: ["apache_down"],
    completed: [],
    skills: {
      systems: 0,
      debugging: 0,
      infra: 0
    }
  };
}

export function completeNode(user, nodeId, tree) {
  if (!user.completed.includes(nodeId)) {
    user.completed.push(nodeId);
  }

  for (const key in tree) {
    if (tree[key].nodes.includes(nodeId)) {
      user.skills[key] += 1;
    }
  }

  for (const key in tree) {
    const section = tree[key];
    if (!section.unlocks) continue;

    const unlocked = section.unlocks.every(req => user.skills[req] > 0);

    if (unlocked) {
      section.nodes.forEach(n => {
        if (!user.unlocked.includes(n)) {
          user.unlocked.push(n);
        }
      });
    }
  }

  return { ...user };
}