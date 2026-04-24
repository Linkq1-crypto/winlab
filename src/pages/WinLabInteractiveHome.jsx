import React, { useMemo, useState } from "react";
import AuthFlow from "../components/AuthFlow";
import HeroSection, { TerminalWindow } from "../components/HeroSection";
import LandingTerminalDemo from "../components/LandingTerminalDemo";
import { getOnboardingTrack } from "../data/onboardingLabTracks";
import { useAuthModal } from "../hooks/useAuthModal";

const INCIDENT_FILE = "incident_nginx.err";

export default function WinLabInteractiveHome() {
  const { authModal, openAuthModal, closeAuthModal } = useAuthModal();
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedLab, setSelectedLab] = useState("nginx-port-conflict");
  const [routerStatus, setRouterStatus] = useState("booting");
  const [labStatus, setLabStatus] = useState("pending");
  const [selectedFile, setSelectedFile] = useState(INCIDENT_FILE);
  const [fileOpened, setFileOpened] = useState(false);
  const [trafficState, setTrafficState] = useState("down");
  const [demoCompleted, setDemoCompleted] = useState(false);
  const [startingIncident, setStartingIncident] = useState(false);
  const [startError, setStartError] = useState("");
  const track = useMemo(
    () => (selectedLevel ? getOnboardingTrack(selectedLevel) : null),
    [selectedLevel]
  );

  async function startFullIncident(labSlug = "nginx-port-conflict") {
    setStartingIncident(true);
    setStartError("");

    try {
      const response = await fetch("/api/incidents/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  function handleAuthRequest() {
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
    await startFullIncident(selectedLab);
  }

  return (
    <div className="h-screen overflow-hidden bg-[#06090d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.10),transparent_30%)]" />

      <div className="relative flex h-full flex-col">
        <TopSystemBar routerStatus={routerStatus} labStatus={labStatus} />

        <div className="grid flex-1 gap-4 overflow-hidden px-4 py-4 lg:grid-cols-[260px_1.1fr_0.72fr]">
          <div className="grid gap-4 overflow-hidden">
            <FileManagerPanel
              fileAlertActive={labStatus === "active" && !fileOpened}
              selectedFile={selectedFile}
              onOpenFile={(fileId) => {
                setSelectedFile(fileId);
                setFileOpened(true);
                if (labStatus === "active") {
                  setTrafficState("recovering");
                }
              }}
            />
            <IncidentCatalogPanel selectedLab={selectedLab} track={track} />
          </div>

          <div className="grid gap-4 overflow-hidden lg:grid-rows-[0.86fr_1.14fr]">
            <HeroSection
              selectedLab={selectedLab}
              onStatusChange={setRouterStatus}
              onLevelSelected={(level) => {
                const nextTrack = getOnboardingTrack(level);
                setSelectedLevel(level);
                setSelectedLab(nextTrack.primaryLab?.slug || "nginx-port-conflict");
                setLabStatus("pending");
                setFileOpened(false);
                setTrafficState("down");
                setDemoCompleted(false);
                setStartError("");
              }}
              onRoutingReady={() => {
                setLabStatus("ready");
              }}
            />

            <LandingTerminalDemo
              selectedLevel={selectedLevel}
              selectedLab={selectedLab}
              routerStatus={routerStatus}
              labStatus={labStatus}
              selectedFile={selectedFile}
              fileOpened={fileOpened}
              gateLoading={startingIncident}
              gateError={startError}
              onLabStateChange={setLabStatus}
              onTrafficRecovering={() => setTrafficState("recovering")}
              onSmallWin={() => {
                setDemoCompleted(true);
                setTrafficState("stable");
                setLabStatus("resolved");
              }}
              onCreateAccount={handleAuthRequest}
              onContinueGuest={() => setStartError("")}
              onUnlock={() => {
                window.location.href = "/pricing";
              }}
            />
          </div>

          <div className="grid gap-4 overflow-hidden lg:grid-rows-[0.56fr_0.44fr]">
            <TrafficMonitorPanel trafficState={trafficState} />
            <PreviewPane fileOpened={fileOpened} selectedFile={selectedFile} />
          </div>
        </div>

        <DockBar selectedLevel={selectedLevel} selectedLab={selectedLab} fileOpened={fileOpened} />
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

function TopSystemBar({ routerStatus, labStatus }) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-zinc-800 bg-[#0b0f14] px-4 font-mono text-[12px] text-zinc-400">
      <div>winlab-os :: prod-eu-west-1</div>
      <div className="flex items-center gap-4">
        <span>router={routerStatus}</span>
        <span>lab={labStatus}</span>
        <span>uptime=00:03:17</span>
      </div>
    </div>
  );
}

function FileManagerPanel({ fileAlertActive, selectedFile, onOpenFile }) {
  const files = [
    "incident_nginx.err",
    "nginx.conf",
    "journalctl.out",
    "traffic.snapshot",
  ];

  return (
    <TerminalWindow title="file-manager" subtitle="/var/log/prod-eu-west-1">
      <div className="h-full overflow-y-auto bg-[#05080d] p-4 font-mono text-[13px] leading-[1.6] text-zinc-300">
        <div className="mb-3 text-zinc-500">drwxr-xr-x logs/</div>
        {files.map((file) => {
          const active = file === selectedFile;
          const alert = file === INCIDENT_FILE && fileAlertActive;
          return (
            <button
              key={file}
              type="button"
              onClick={() => onOpenFile(file)}
              className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                active
                  ? "border-zinc-500 bg-zinc-900 text-zinc-100"
                  : "border-zinc-800 bg-[#0b1016] hover:border-zinc-700"
              } ${alert ? "animate-pulse border-red-500/70 shadow-[0_0_18px_rgba(239,68,68,0.25)]" : ""}`}
            >
              <span>{file}</span>
              <span className={alert ? "text-red-400" : "text-zinc-600"}>{alert ? "alert" : "log"}</span>
            </button>
          );
        })}
      </div>
    </TerminalWindow>
  );
}

function IncidentCatalogPanel({ selectedLab, track }) {
  const labs = track?.previewLabs || [];

  return (
    <TerminalWindow title="incident-catalog" subtitle="queued incidents">
      <div className="h-full overflow-y-auto bg-[#05080d] p-4 font-mono text-[13px] leading-[1.6] text-zinc-300">
        {labs.length === 0 ? (
          <div className="text-zinc-500">[SYSTEM]: awaiting operator classification</div>
        ) : (
          labs.map((lab) => (
            <div
              key={lab.slug}
              className={`mb-2 rounded-lg border px-3 py-2 ${
                lab.slug === selectedLab
                  ? "border-zinc-500 bg-zinc-900 text-zinc-100"
                  : "border-zinc-800 bg-[#0b1016] text-zinc-500"
              }`}
            >
              <div>{lab.slug}</div>
              <div className="mt-1 text-[12px]">{lab.title}</div>
            </div>
          ))
        )}
      </div>
    </TerminalWindow>
  );
}

function TrafficMonitorPanel({ trafficState }) {
  const bars =
    trafficState === "stable"
      ? [22, 31, 38, 47, 59, 72, 78, 81]
      : trafficState === "recovering"
        ? [10, 14, 18, 22, 31, 42, 51, 58]
        : [64, 52, 41, 28, 18, 12, 8, 5];

  return (
    <TerminalWindow title="traffic-monitor" subtitle="public edge / 5m">
      <div className="flex h-full flex-col bg-[#05080d] p-4">
        <div className="mb-4 font-mono text-[13px] text-zinc-500">
          status={trafficState === "stable" ? "normalized" : trafficState === "recovering" ? "recovering" : "degraded"}
        </div>
        <div className="flex flex-1 items-end gap-2">
          {bars.map((bar, index) => (
            <div key={`${index}-${bar}`} className="flex flex-1 items-end">
              <div
                className={`w-full rounded-t-md ${
                  trafficState === "stable"
                    ? "bg-blue-500"
                    : trafficState === "recovering"
                      ? "bg-cyan-500"
                      : "bg-red-500"
                }`}
                style={{ height: `${bar}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </TerminalWindow>
  );
}

function PreviewPane({ fileOpened, selectedFile }) {
  return (
    <TerminalWindow title="preview-pane" subtitle={selectedFile}>
      <div className="h-full overflow-y-auto bg-[#05080d] p-4 font-mono text-[13px] leading-[1.65] text-zinc-300">
        {fileOpened ? (
          <>
            <div>[nginx] bind() to 0.0.0.0:80 failed (98: Address already in use)</div>
            <div>[nginx] emergency: still unable to bind()</div>
            <div>[systemd] nginx.service entered failed state</div>
          </>
        ) : (
          <div className="text-zinc-500">[SYSTEM]: preview unavailable until file open.</div>
        )}
      </div>
    </TerminalWindow>
  );
}

function DockBar({ selectedLevel, selectedLab, fileOpened }) {
  return (
    <div className="flex h-12 items-center justify-between border-t border-zinc-800 bg-[#0b0f14] px-4 font-mono text-[12px] text-zinc-500">
      <div className="flex items-center gap-3">
        <span>router</span>
        <span>lab</span>
        <span>files</span>
        <span>traffic</span>
      </div>
      <div className="flex items-center gap-4">
        <span>level={selectedLevel || "pending"}</span>
        <span>incident={selectedLab}</span>
        <span>preview={fileOpened ? "open" : "closed"}</span>
      </div>
    </div>
  );
}
