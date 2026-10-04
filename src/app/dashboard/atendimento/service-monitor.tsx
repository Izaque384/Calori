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

function playTone(type: RequestItem["type"]) {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 0.02);
  master.connect(context.destination);

  const pattern =
    type === "request_bill"
      ? [
          { frequency: 820, start: 0, duration: 0.22 },
          { frequency: 620, start: 0.28, duration: 0.24 },
          { frequency: 820, start: 0.62, duration: 0.28 },
        ]
      : [
          { frequency: 880, start: 0, duration: 0.2 },
          { frequency: 1100, start: 0.27, duration: 0.22 },
          { frequency: 1320, start: 0.58, duration: 0.3 },
        ];

  for (const tone of pattern) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(tone.frequency, context.currentTime + tone.start);

    envelope.gain.setValueAtTime(0.0001, context.currentTime + tone.start);
    envelope.gain.exponentialRampToValueAtTime(
      0.95,
      context.currentTime + tone.start + 0.02,
    );
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + tone.start + tone.duration,
    );

    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(context.currentTime + tone.start);
    oscillator.stop(context.currentTime + tone.start + tone.duration);
  }

  master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.05);

  if ("vibrate" in navigator) {
    navigator.vibrate(type === "request_bill" ? [160, 90, 240] : [140, 80, 140, 80, 220]);
  }

  window.setTimeout(() => {
    void context.close();
  }, 1250);
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
