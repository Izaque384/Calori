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

const CHIME_URL =
  "https://raw.githubusercontent.com/ibrews/Understudy/main/android/app/src/main/res/raw/chime.wav";

function playFallbackTone() {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const gain = context.createGain();
  const oscillator = context.createOscillator();

  oscillator.type = "square";
  oscillator.frequency.value = 1046;
  gain.gain.setValueAtTime(0.32, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.75);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.75);

  window.setTimeout(() => {
    void context.close();
  }, 900);
}

function playChimeOnce(type: RequestItem["type"]) {
  const audio = new Audio(CHIME_URL);
  audio.volume = 1;
  audio.preload = "auto";
  audio.playbackRate = type === "request_bill" ? 0.92 : 1;

  void audio.play().catch(() => {
    playFallbackTone();
  });
}

function playTone(type: RequestItem["type"]) {
  playChimeOnce(type);

  window.setTimeout(() => {
    playChimeOnce(type);
  }, 1900);

  if ("vibrate" in navigator) {
    navigator.vibrate(
      type === "request_bill"
        ? [260, 120, 320, 240, 260]
        : [180, 90, 180, 90, 360],
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
            window.setTimeout(() => {
              if (!cancelled) playTone(latest.type);
            }, 7000);
          }

          router.refresh();
        }

        knownIds.current = currentIds;
      } catch {
        // Mantém o painel funcional mesmo se uma rodada de polling falhar.
      }
    }

    const timer = window.setInterval(poll, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
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

      <span className="monitor-status">Atualização automática a cada 5s</span>

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
