import React, { useEffect, useState } from "react";
import { track } from "../analytics";
import SignupPage from "../pages/SignupPage";
import PricingPage from "../pages/PricingPage";
import AuthModal from "./AuthModal";

export default function AuthFlow({
  user = null,
  initialView = "modal",
  modalState = null,
  onClose,
  onLogin,
  onSignup,
  onGoogleSignup,
  onBuyFounding,
  onBuyPro,
  onBuyLifetime,
}) {
  const [view, setView] = useState(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView, modalState?.context, modalState?.mode]);

  useEffect(() => {
    if (view === "modal" && modalState?.open !== false) {
      track("signup_modal_opened", {
        context: modalState?.context || "progress",
        mode: modalState?.mode || "signup",
      });
    }

    if (view === "pricing") {
      track("pricing_page_viewed", {
        source: modalState?.mode === "upgrade" ? "upgrade_modal" : "auth_modal",
      });
    }
  }, [view, modalState]);

  if (view === "signup") {
    return (
      <SignupPage
        context={mapModalContextToSignupContext(modalState)}
        score={modalState?.score ?? null}
        grade={modalState?.grade ?? null}
        onBack={() => setView("modal")}
        onSubmit={onSignup}
        onGoogleSignup={onGoogleSignup}
      />
    );
  }

  if (view === "pricing") {
    return (
      <PricingPage
        user={user}
        onStartFree={() => setView("signup")}
        onBuyFounding={onBuyFounding}
        onBuyPro={onBuyPro}
        onBuyLifetime={onBuyLifetime}
      />
    );
  }

  return (
    <AuthModal
      open={modalState?.open ?? true}
      mode={modalState?.mode || "signup"}
      context={modalState?.context || "progress"}
      score={modalState?.score ?? null}
      grade={modalState?.grade ?? null}
      onClose={onClose}
      onPrimary={() => {
        if (modalState?.mode === "upgrade") {
          setView("pricing");
          return;
        }

        if (modalState?.mode === "login") {
          onLogin?.();
          return;
        }

        setView("signup");
      }}
      onSecondary={onClose}
    />
  );
}

function mapModalContextToSignupContext(modalState) {
  if (!modalState) return "save_progress";
  if (modalState.context === "locked_chain") return "unlock_pro";
  if (modalState.context === "continue_chain") return "continue_chain";
  return "save_progress";
}
