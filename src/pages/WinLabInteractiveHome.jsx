import React, { useEffect, useRef, useState } from "react";
import AuthFlow from "../components/AuthFlow";
import HeroSection from "../components/HeroSection";
import LandingFeaturedLabs from "../components/LandingFeaturedLabs";
import LandingPricingSection from "../components/LandingPricingSection";
import LandingTerminalDemo from "../components/LandingTerminalDemo";
import { track } from "../analytics";
import { CATALOG_TOTALS, getOnboardingTrack } from "../data/onboardingLabTracks";
import { useAuthModal } from "../hooks/useAuthModal";

const FALLBACK_HOME_DATA = Object.freeze({
  stats: Object.freeze({
    engineers: 12000,
    countries: 120,
    labs: CATALOG_TOTALS.totalCatalogItems,
    avgRating: 4.8,
  }),
  featuredLabs: Object.freeze([
    Object.freeze({
      slug: "nginx-down",
      title: "Nginx Down",
      description: "Restore a failed edge service before user traffic fully drops.",
      durationMin: 12,
      difficulty: "junior",
      tier: "free",
      rating: 4.8,
    }),
    Object.freeze({
      slug: "api-timeout",
      title: "API Timeout",
      description: "Trace the timeout chain and restore traffic before impact spreads.",
      durationMin: 18,
      difficulty: "junior",
      tier: "free",
      rating: 4.8,
    }),
    Object.freeze({
      slug: "permission-denied",
      title: "Permission Denied",
      description: "Fix a write path that fails with real production permissions.",
      durationMin: 16,
      difficulty: "mid",
      tier: "pro",
      rating: 4.9,
    }),
  ]),
  pricing: Object.freeze({
    freeLabs: 4,
    proMonthlyUsd: 19,
    currency: "EUR",
  }),
  socialProof: Object.freeze({
    headline: "Joined by engineers from 120+ countries",
  }),
});

export default function WinLabInteractiveHome() {
  const { authModal, openAuthModal, closeAuthModal } = useAuthModal();
  const [homeData, setHomeData] = useState(FALLBACK_HOME_DATA);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [previewIncidentSlug, setPreviewIncidentSlug] = useState("");
  const [connectionStage, setConnectionStage] = useState("idle");
  const [demoCompleted, setDemoCompleted] = useState(false);
  const [startingIncident, setStartingIncident] = useState(false);
  const [startError, setStartError] = useState("");
  const sessionIdRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `winlab-${Date.now()}`
  );
  const demoRef = useRef(null);
  const connectionTimersRef = useRef([]);
  const selectedTrack = selectedLevel ? getOnboardingTrack(selectedLevel) : null;

  useEffect(() => {
    const controller = new AbortController();

    async function loadHomeData() {
      try {
        const response = await fetch("/api/public/home", {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Home API failed with status ${response.status}`);
        }

        const payload = await response.json();
        setHomeData({
          stats: {
            ...(payload?.stats || FALLBACK_HOME_DATA.stats),
            labs: CATALOG_TOTALS.totalCatalogItems,
          },
          featuredLabs: payload?.featuredLabs || FALLBACK_HOME_DATA.featuredLabs,
          pricing: {
            ...(payload?.pricing || FALLBACK_HOME_DATA.pricing),
            freeLabs: 4,
            currency: "EUR",
          },
          socialProof: payload?.socialProof || FALLBACK_HOME_DATA.socialProof,
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          setHomeData(FALLBACK_HOME_DATA);
        }
      }
    }

    loadHomeData();
    return () => controller.abort();
  }, []);

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
          title: "Login required",
          description: "Sign in to launch your real incident terminal.",
          primaryLabel: "Log in",
          secondaryLabel: "Not now",
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
      title: "Nice. Want to try the full incident?",
      description: "Sign in to continue.",
      primaryLabel: "Create free account",
      secondaryLabel: "Not now",
    });
  }

  async function handleAuthSuccess() {
    document.cookie = "mock_auth=1; Path=/; SameSite=Lax";
    await startFullIncident(selectedTrack?.primaryLab?.slug || "nginx-port-conflict");
  }

  async function startDockerLab(labId) {
    const selectedLabId = labId || selectedTrack?.primaryLab?.slug || "nginx-port-conflict";
    const response = await fetch("/api/lab/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labId: selectedLabId,
        sessionId: sessionIdRef.current,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || "Failed to start Docker lab session.");
    }

    return response.json();
  }

  async function verifyDockerLab(labId) {
    const selectedLabId = labId || selectedTrack?.primaryLab?.slug || "nginx-port-conflict";
    const response = await fetch("/api/lab/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labId: selectedLabId,
        sessionId: sessionIdRef.current,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || "Failed to verify Docker lab session.");
    }

    return response.json();
  }

  function openSignupAfterVerify() {
    window.setTimeout(() => {
      openAuthModal({
        mode: "signup",
        context: "progress",
        title: "Save your progress and unlock more incidents",
        description: "Create your free account to continue from this recovery.",
        primaryLabel: "Create free account",
        secondaryLabel: "Not now",
      });
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <HeroSection
        stats={homeData.stats}
        onStart={scrollToDemo}
        onSeeHowItWorks={scrollToHowItWorks}
        onRoutingReady={scrollToDemo}
        onPreviewIncident={(incidentSlug) => {
          setPreviewIncidentSlug(incidentSlug);
          scrollToDemo();
        }}
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
          previewIncidentSlug={previewIncidentSlug}
          onSmallWin={handleDemoWin}
          onStartLab={startDockerLab}
          onVerifyLab={verifyDockerLab}
          onVerifySuccess={openSignupAfterVerify}
          gateLoading={startingIncident}
          gateError={startError}
          onCreateAccount={handleAuthContinue}
          onContinueGuest={() => {
            setStartError("");
          }}
        />
      </div>

      <LandingFeaturedLabs featuredLabs={homeData.featuredLabs} />
      <LandingPricingSection
        freeLabs={homeData.pricing?.freeLabs || 4}
        onPricing={() => {
          window.location.href = "/pricing";
        }}
      />

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
