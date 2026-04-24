import React, { useEffect, useRef, useState } from "react";
import AuthFlow from "../components/AuthFlow";
import HeroSection from "../components/HeroSection";
import LandingTerminalDemo from "../components/LandingTerminalDemo";
import { track } from "../analytics";
import { getOnboardingTrack } from "../data/onboardingLabTracks";
import { useAuthModal } from "../hooks/useAuthModal";

export default function WinLabInteractiveHome() {
  const { authModal, openAuthModal, closeAuthModal } = useAuthModal();
  const [selectedLevel, setSelectedLevel] = useState("");
  const [connectionStage, setConnectionStage] = useState("idle");
  const [demoCompleted, setDemoCompleted] = useState(false);
  const [startingIncident, setStartingIncident] = useState(false);
  const [startError, setStartError] = useState("");
  const demoRef = useRef(null);
  const connectionTimersRef = useRef([]);
  const selectedTrack = selectedLevel ? getOnboardingTrack(selectedLevel) : null;

  useEffect(() => {
    return () => {
      connectionTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  function scrollToDemo() {
    demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToHowItWorks() {
    document.getElementById("how-it-works")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleDemoWin() {
    if (demoCompleted) return;
    setDemoCompleted(true);
    track("signup_modal_opened", { context: "demo_small_win", mode: "signup_gate_armed" });
  }

  async function startFullIncident(labSlug = "nginx-port-conflict") {
    setStartingIncident(true);
    setStartError("");

    try {
      const response = await fetch("/api/incidents/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ labSlug }),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.terminalUrl) {
        window.location.href = payload.terminalUrl;
        return;
      }

      const errorCode = payload?.error?.code || payload?.code || "";
      if (response.status === 401 || errorCode === "AUTH_REQUIRED") {
        openAuthModal({
          mode: "login",
          context: "progress",
          title: "[AUTH]: authentication required",
          description: "[SYSTEM]: persist identity to continue routing.",
          primaryLabel: "[AUTH]: authenticate",
          secondaryLabel: "[ACCESS]: defer",
        });
        return;
      }

      if (response.status === 403 || errorCode === "PLAN_UPGRADE_REQUIRED") {
        window.location.href = "/pricing";
        return;
      }

      throw new Error(payload?.error?.message || "We could not start the incident right now.");
    } catch (error) {
      setStartError(error.message || "We could not start the incident right now.");
    } finally {
      setStartingIncident(false);
    }
  }

  async function handleAuthContinue() {
    if (!demoCompleted) return;

    openAuthModal({
      mode: "signup",
      context: "progress",
      title: "[AUTH]: persistence unavailable",
      description: "[SYSTEM]: create identity to save progress and continue routing.",
      primaryLabel: "[AUTH]: create identity",
      secondaryLabel: "[ACCESS]: continue volatile",
    });
  }

  async function handleAuthSuccess() {
    document.cookie = "mock_auth=1; Path=/; SameSite=Lax";
    await startFullIncident(selectedTrack?.primaryLab?.slug || "nginx-port-conflict");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <HeroSection
        onRoutingReady={scrollToDemo}
        onLevelSelected={(level) => {
          connectionTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
          connectionTimersRef.current = [];
          setSelectedLevel(level);
          setConnectionStage("prepared");
          setDemoCompleted(false);
          setStartError("");

          connectionTimersRef.current.push(
            window.setTimeout(() => {
              setConnectionStage("connected");
            }, 1300)
          );

          connectionTimersRef.current.push(
            window.setTimeout(() => {
              setConnectionStage("prompt");
            }, 1450)
          );
        }}
      />

      <div ref={demoRef}>
        <LandingTerminalDemo
          selectedLevel={selectedLevel}
          connectionStage={connectionStage}
          onSmallWin={() => handleDemoWin()}
          gateLoading={startingIncident}
          gateError={startError}
          onCreateAccount={handleAuthContinue}
          onContinueGuest={() => {
            setStartError("");
          }}
          onUnlock={() => {
            window.location.href = "/pricing";
          }}
        />
      </div>

      {authModal.open ? (
        <AuthFlow
          initialView="modal"
          modalState={authModal}
          onClose={closeAuthModal}
          onLogin={handleAuthSuccess}
          onSignup={handleAuthSuccess}
          onGoogleSignup={handleAuthSuccess}
          onBuyFounding={() => {
            window.location.href = "/pricing";
          }}
          onBuyPro={() => {
            window.location.href = "/pricing";
          }}
          onBuyLifetime={() => {
            window.location.href = "/pricing";
          }}
        />
      ) : null}
    </div>
  );
}
