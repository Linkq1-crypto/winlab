import React, { useMemo, useState } from "react";
import { track } from "../analytics";

export default function SignupPage({
  context = "save_progress",
  score = null,
  grade = null,
  emailPrefill = "",
  onSubmit,
  onGoogleSignup,
  onBack,
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(emailPrefill);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const copy = useMemo(() => getSignupCopy(context, score, grade), [context, score, grade]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    track("signup_started", { context, provider: "password" });

    try {
      await onSubmit?.({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignup() {
    track("signup_started", { context, provider: "google" });
    onGoogleSignup?.();
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 text-sm text-zinc-500 hover:text-white"
        >
          {"<-"} Back
        </button>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
            <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Continue</div>

            <h1 className="text-4xl font-semibold leading-[0.95] tracking-tight md:text-6xl">
              {copy.title}
            </h1>

            <p className="mt-5 max-w-2xl text-lg text-zinc-400">{copy.description}</p>

            {(score != null || grade != null) && (
              <div className="mt-6 grid max-w-sm grid-cols-2 gap-4">
                <Metric label="Score" value={score ?? "-"} />
                <Metric label="Grade" value={grade ?? "-"} />
              </div>
            )}

            <div className="mt-8 grid gap-3">
              {copy.bullets.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-sm text-zinc-300"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 overflow-hidden rounded-3xl border border-zinc-800 bg-black">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div className="text-sm text-zinc-400">run preview - bash</div>
                <div className="text-xs text-green-400">recoverable</div>
              </div>

              <div className="p-4 font-mono text-sm leading-7">
                <div className="text-zinc-500">[verify]</div>
                <div className="text-green-400">service stabilized</div>
                <div className="mt-2 text-zinc-500">[progress]</div>
                <div className="text-zinc-300">save required to continue from this point</div>
                <div className="mt-4 text-zinc-400">winlab@prod-server:~$</div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
            <div className="mb-4 text-sm text-zinc-500">Create your account</div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={handleGoogleSignup}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-left hover:bg-zinc-900"
              >
                Continue with Google
              </button>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-800" />
              <div className="text-xs text-zinc-600">or</div>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <Field
                label="Name"
                value={name}
                onChange={setName}
                placeholder="Your name"
              />
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                type="email"
              />
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="Choose a password"
                type="password"
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-2xl bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
              >
                {loading ? "Creating account..." : copy.cta}
              </button>
            </form>

            <div className="mt-4 text-xs text-zinc-600">
              By continuing, you start with free access and can upgrade when you want to
              go deeper.
            </div>

            <div className="mt-8 rounded-2xl border border-zinc-800 bg-black p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                What happens next
              </div>

              <div className="grid gap-2 text-sm text-zinc-300">
                <div>1. Your run gets saved</div>
                <div>2. Your score and history become persistent</div>
                <div>3. You continue from where you left off</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 outline-none focus:border-zinc-600"
      />
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{String(value)}</div>
    </div>
  );
}

function getSignupCopy(context, score, grade) {
  if (context === "unlock_pro") {
    return {
      title: "You're ready for the deeper tracks.",
      description:
        "Create your account first, then unlock higher levels, advanced chains, and full progression.",
      bullets: [
        "Save your runs and scores",
        "Unlock chain progression",
        "Prepare for Pro and harder modes",
      ],
      cta: "Create account",
    };
  }

  if (context === "continue_chain") {
    return {
      title: "Save this recovery and keep going.",
      description:
        "You've already opened the system up. Save your chain progress and continue from this exact point.",
      bullets: [
        "Resume unfinished chains",
        "Keep step-by-step recovery history",
        "Unlock deeper incident tracks",
      ],
      cta: "Save progress",
    };
  }

  return {
    title:
      grade || score != null ? `Save this run${grade ? ` - ${grade}` : ""}.` : "Save your progress.",
    description:
      "You recovered something real. Create your account to keep the score, the history, and the next incident.",
    bullets: [
      "Save scores and progress",
      "Keep your incident history",
      "Unlock more labs and chains",
    ],
    cta: "Create free account",
  };
}
