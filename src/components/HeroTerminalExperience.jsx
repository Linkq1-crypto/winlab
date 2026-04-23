import React, { useEffect, useMemo, useState } from "react";
import { track } from "../analytics";
import { pickVariant } from "../services/abTest";
import ChainLaunchExperience from "./ChainLaunchExperience";
import TerminalIntroSequence from "./TerminalIntroSequence";

export default function HeroTerminalExperience({
  user = null,
  repoSourcePath = "/srv/winlab",
  onSignup,
  onUpgrade,
  onPricing,
  onTrackEvent,
}) {
  const [showLaunch, setShowLaunch] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  const heroVariant = useMemo(
    () => pickVariant("hero_headline", ["A1", "A2", "A3"]),
    []
  );
  const ctaVariant = useMemo(
    () => pickVariant("hero_cta", ["B1", "B2", "B3"]),
    []
  );
  const secondaryVariant = useMemo(
    () => pickVariant("hero_secondary_cta", ["C1", "C2", "C3"]),
    []
  );
  const heroCopy = getHeroCopy(heroVariant, ctaVariant, secondaryVariant);

  useEffect(() => {
    emitTrack("hero_variant_seen", {
      heroVariant,
      ctaVariant,
      secondaryVariant,
      primaryCta: heroCopy.primaryCta,
      secondaryCta: heroCopy.secondaryCta,
    });
  }, [heroVariant, ctaVariant, secondaryVariant, heroCopy.primaryCta, heroCopy.secondaryCta]);

  function emitTrack(event, payload) {
    onTrackEvent?.(event, payload);
    if (!onTrackEvent) {
      track(event, payload);
    }
  }

  function startLaunch(source) {
    emitTrack("launch_experience_started", {
      heroVariant,
      ctaVariant,
      secondaryVariant,
      source,
    });
    setShowLaunch(true);
  }

  function handlePrimaryClick() {
    emitTrack("hero_cta_clicked", {
      heroVariant,
      ctaVariant,
      secondaryVariant,
      cta: heroCopy.primaryCta,
    });
    startLaunch("primary_cta");
  }

  function handleSecondaryClick() {
    emitTrack("hero_secondary_clicked", {
      heroVariant,
      ctaVariant,
      secondaryVariant,
      cta: heroCopy.secondaryCta,
    });

    if (heroCopy.secondaryAction === "launch") {
      startLaunch("secondary_cta");
      return;
    }

    const element = document.getElementById("how-it-works");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (showLaunch) {
    return (
      <ChainLaunchExperience
        user={user}
        repoSourcePath={repoSourcePath}
        onSignup={onSignup}
        onUpgrade={onUpgrade}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="border-b border-zinc-900">
        <div className="mx-auto grid max-w-7xl items-start gap-6 px-4 py-8 md:px-6 md:py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="pt-2">
            <div className="mb-4 text-sm text-zinc-500">WINLAB</div>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.92] tracking-tight md:text-7xl">
              {heroCopy.headlineTop}
              <br />
              {heroCopy.headlineBottom}
            </h1>

            <p className="mt-5 max-w-2xl text-lg text-zinc-400">{heroCopy.subheadline}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePrimaryClick}
                className="rounded-2xl bg-white px-5 py-3 text-black hover:bg-zinc-200"
              >
                {heroCopy.primaryCta}
              </button>

              {heroCopy.secondaryCta ? (
                <button
                  type="button"
                  onClick={handleSecondaryClick}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 hover:bg-black"
                >
                  {heroCopy.secondaryCta}
                </button>
              ) : null}
            </div>

            <div className="mt-6 text-sm text-zinc-600">
              Joined by engineers from 120+ countries
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="text-sm text-zinc-400">prod-eu-west-1 - bash</div>
              <div className="text-xs text-red-400">live</div>
            </div>

            <div className="min-h-[360px] bg-black p-4 md:p-5">
              <TerminalIntroSequence
                speed={820}
                onComplete={() => {
                  setIntroDone(true);
                  emitTrack("hero_terminal_intro_complete", {
                    heroVariant,
                    ctaVariant,
                    secondaryVariant,
                  });
                }}
              />

              {introDone ? (
                <GhostCommandHint
                  onUse={() => {
                    emitTrack("hero_terminal_hint_seen", {
                      heroVariant,
                      ctaVariant,
                      secondaryVariant,
                    });
                  }}
                />
              ) : null}
            </div>

            <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-500">
              live incident - terminal active - AI mentor available
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-zinc-900">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-4 md:px-6">
          <StepCard
            index="01"
            title="Enter a real incident"
            text="No slides. No lesson. The system is already failing."
          />
          <StepCard
            index="02"
            title="Diagnose the problem"
            text="Read logs, inspect services, and understand what actually broke."
          />
          <StepCard
            index="03"
            title="Fix it under pressure"
            text="Use AI review or patch when you need signal, not noise."
          />
          <StepCard
            index="04"
            title="Watch the next failure surface"
            text="In chains, one fix often reveals the next problem underneath."
          />
        </div>
      </section>

      <section className="border-b border-zinc-900">
        <div className="mx-auto grid max-w-7xl items-start gap-6 px-4 py-12 md:px-6 lg:grid-cols-[1fr_420px]">
          <div>
            <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
              Not a course
            </div>
            <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
              No videos. No theory.
              <br />
              Just failures.
            </h2>

            <p className="mt-4 max-w-2xl text-zinc-400">
              Learn by recovering systems that feel broken enough to matter.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-4 text-sm text-zinc-500">Available levels</div>

            <div className="grid gap-3">
              <LevelRow title="Novice" text="Guided. Learn the loop." />
              <LevelRow title="Junior" text="Readable logs. Clearer clues." />
              <LevelRow title="Mid" text="Less signal. More reasoning." />
              <LevelRow title="Senior" text="Messy systems. Higher pressure." />
              <LevelRow title="SRE" text="No help. Just recovery." />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 p-8 md:p-10">
          <div className="max-w-3xl">
            <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Start</div>

            <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
              Break a real system.
              <br />
              Right now.
            </h2>

            <p className="mt-4 text-zinc-400">
              Start free. Pay only when you want to go deeper.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePrimaryClick}
                className="rounded-2xl bg-white px-5 py-3 text-black hover:bg-zinc-200"
              >
                {heroCopy.primaryCta}
              </button>

              <button
                type="button"
                onClick={() => {
                  emitTrack("pricing_preview_clicked", {
                    heroVariant,
                    ctaVariant,
                    secondaryVariant,
                  });
                  onPricing?.();
                }}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 hover:bg-black"
              >
                View pricing
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function GhostCommandHint({ onUse }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    onUse?.();
    const timeoutId = window.setTimeout(() => setVisible(false), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [onUse]);

  if (!visible) return null;

  return (
    <div className="mt-5">
      <div className="font-mono text-sm text-zinc-400">winlab@prod-server:~$</div>
      <div className="animate-pulse font-mono text-sm text-zinc-600">help</div>
    </div>
  );
}

function StepCard({ index, title, text }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{index}</div>
      <div className="mt-3 text-lg font-medium">{title}</div>
      <div className="mt-2 text-sm text-zinc-400">{text}</div>
    </div>
  );
}

function LevelRow({ title, text }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-4">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-zinc-500">{text}</div>
    </div>
  );
}

function getHeroCopy(heroVariant, ctaVariant, secondaryVariant) {
  return {
    ...getHeadlineVariant(heroVariant),
    ...getCtaVariant(ctaVariant, secondaryVariant),
  };
}

function getHeadlineVariant(variant) {
  switch (variant) {
    case "A2":
      return {
        headlineTop: "Your server is down.",
        headlineBottom: "Do something.",
        subheadline:
          "You're dropped into a live terminal. Logs are failing. Users are impacted. Fix the system before it gets worse.",
      };
    case "A3":
      return {
        headlineTop: "No videos. No theory.",
        headlineBottom: "Just failures.",
        subheadline:
          "Learn DevOps and recovery by stepping into broken systems and making them work again.",
      };
    case "A1":
    default:
      return {
        headlineTop: "Production is already broken.",
        headlineBottom: "Fix it.",
        subheadline:
          "Real incidents. Real terminals. Real pressure. No videos. No theory. Just failures.",
      };
  }
}

function getCtaVariant(ctaVariant, secondaryVariant) {
  let primaryCta = "Start first incident";
  if (ctaVariant === "B2") primaryCta = "Enter terminal";
  if (ctaVariant === "B3") primaryCta = "Break a real system";

  let secondaryCta = null;
  let secondaryAction = null;
  if (secondaryVariant === "C1") {
    secondaryCta = "How it works ->";
    secondaryAction = "scroll";
  } else if (secondaryVariant === "C2") {
    secondaryCta = "Watch it fail";
    secondaryAction = "launch";
  }

  return {
    primaryCta,
    secondaryCta,
    secondaryAction,
  };
}
