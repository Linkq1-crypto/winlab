import { useState } from "react";

export function useAuthModal() {
  const [state, setState] = useState({
    open: false,
    mode: "signup",
    context: "progress",
    score: null,
    grade: null,
    title: undefined,
    description: undefined,
    primaryLabel: undefined,
    secondaryLabel: undefined,
  });

  function openAuthModal(payload = {}) {
    setState({
      open: true,
      mode: payload.mode || "signup",
      context: payload.context || "progress",
      score: payload.score ?? null,
      grade: payload.grade ?? null,
      title: payload.title,
      description: payload.description,
      primaryLabel: payload.primaryLabel,
      secondaryLabel: payload.secondaryLabel,
    });
  }

  function closeAuthModal() {
    setState((prev) => ({
      ...prev,
      open: false,
    }));
  }

  return {
    authModal: state,
    openAuthModal,
    closeAuthModal,
  };
}

export default useAuthModal;
