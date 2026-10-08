"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RequestItem = {
  id: string;
  type: "call_waiter" | "request_bill";
  tableName: string;
  createdAt: string;
};

type Props = {
  initialRequests: RequestItem[];
};

const SOUND_KEY = "calori-service-sound-enabled";

function playChimeOnce(type: RequestItem["type"]) {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const frequencies = type === "request_bill"
    ? [642.58, 809.6, 962.78]
    : [698.46, 880, 1046.5];

  master.gain.setValueAtTime(0.95, context.currentTime);
  master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.5);

  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;

  master.connect(compressor);
  compressor.connect(context.destination);

  for (const frequency of frequencies) {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    voiceGain.gain.value = 0.38;

    oscillator.connect(voiceGain);
    voiceGain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.5);
  }

  window.setTimeout(() => {
    void context.close();
  }, 1650);
}

function playTone(type: RequestItem["type"]) {
  const chimeDurationMs = 1500;
  const intervalBetweenChimesMs = 100;
  const stepMs = chimeDurationMs + intervalBetweenChimesMs;

  playChimeOnce(type);

  window.setTimeout(() => {
    playChimeOnce(type);
  }, stepMs);

  window.setTimeout(() => {
    playChimeOnce(type);
  }, stepMs * 2);

  if ("vibrate" in navigator) {
    navigator.vibrate(
      type === "request_bill"
        ? [260, 120, 320, 1000, 260, 120, 320, 1000, 260, 120, 320]
        : [180, 90, 180, 90, 360, 1000, 180, 90, 180, 90, 360, 1000, 180, 90, 180, 90, 360],
    );
  }
}

export default function ServiceMonitor({ initialRequests }: Props) {
  const router = useRouter();
  const knownIds = useRef(new Set(initialRequests.map((request) => request.id)));
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [newRequest, setNewRequest] = useState<RequestItem | null>(null);

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem(SOUND_KEY) === "true");
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const response = await fetch("/api/dashboard/service-requests", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as { requests: RequestItem[] };
        if (cancelled) return;

        const currentIds = new Set(data.requests.map((request) => request.id));
        const fresh = data.requests.filter((request) => !knownIds.current.has(request.id));

        if (fresh.length > 0) {
          const latest = fresh[fresh.length - 1];
          setNewRequest(latest);

          if (soundEnabled) {
            playTone(latest.type);
          }

          router.refresh();
        }

        knownIds.current = currentIds;
      } catch {
        // Mantém o painel funcional mesmo se uma rodada de atualização falhar.
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(
            poll,
            document.visibilityState === "visible" ? 5000 : 30000,
          );
        }
      }
    }

    function handleVisibility() {
      if (document.visibilityState !== "visible" || cancelled) return;
      if (timer) window.clearTimeout(timer);
      void poll();
    }

    timer = window.setTimeout(poll, 5000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router, soundEnabled]);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem(SOUND_KEY, String(next));

    if (next) {
      playTone("call_waiter");
    }
  }

  return (
    <div className="service-monitor-bar">
      <button
        className={soundEnabled ? "sound-toggle enabled" : "sound-toggle"}
        type="button"
        onClick={toggleSound}
      >
        <span className="sound-indicator" />
        {soundEnabled ? "Alertas sonoros ativos" : "Ativar alertas sonoros"}
      </button>

      <span className="monitor-status">Atualização automática</span>

      {newRequest && (
        <button
          className="new-service-toast"
          type="button"
          onClick={() => setNewRequest(null)}
        >
          <strong>
            {newRequest.type === "request_bill" ? "Conta solicitada" : "Garçom chamado"}
          </strong>
          <span>{newRequest.tableName}</span>
        </button>
      )}
    </div>
  );
}
