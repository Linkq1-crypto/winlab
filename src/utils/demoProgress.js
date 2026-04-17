// Demo progress persistence - localStorage based
export function saveDemoProgress(step, component = "terminal_demo") {
  try {
    const data = {
      step,
      component,
      timestamp: Date.now(),
      completed: step >= 6,
    };
    localStorage.setItem("winlab_demo_progress", JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn("[DemoProgress] Failed to save progress:", e);
    return false;
  }
}

export function loadDemoProgress() {
  try {
    const raw = localStorage.getItem("winlab_demo_progress");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[DemoProgress] Failed to load progress:", e);
    return null;
  }
}

export function clearDemoProgress() {
  localStorage.removeItem("winlab_demo_progress");
}

export function hasExistingProgress() {
  const progress = loadDemoProgress();
  return progress !== null && progress.step > 0;
}

export function getProgressSummary() {
  const progress = loadDemoProgress();
  if (!progress) {
    return { hasProgress: false, step: 0, completed: false };
  }
  return {
    hasProgress: true,
    step: progress.step,
    completed: progress.completed,
    component: progress.component,
    age: Date.now() - progress.timestamp,
  };
}
