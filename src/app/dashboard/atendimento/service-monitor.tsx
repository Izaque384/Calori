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
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, context.currentTime);
  compressor.knee.setValueAtTime(18, context.currentTime);
  compressor.ratio.setValueAtTime(8, context.currentTime);
  compressor.attack.setValueAtTime(0.003, context.currentTime);
  compressor.release.setValueAtTime(0.18, context.currentTime);
  compressor.connect(context.destination);

  const master = context.createGain();
  master.gain.setValueAtTime(0.62, context.currentTime);
  master.connect(compressor);

  const basePattern =
    type === "request_bill"
      ? [
          { frequency: 784, start: 0, duration: 0.28 },
          { frequency: 587, start: 0.34, duration: 0.32 },
          { frequency: 784, start: 0.75, duration: 0.38 },
        ]
      : [
          { frequency: 988, start: 0, duration: 0.25 },
          { frequency: 1175, start: 0.31, duration: 0.27 },
          { frequency: 1397, start: 0.68, duration: 0.4 },
        ];

  const pattern = [
    ...basePattern,
    ...basePattern.map((tone) => ({ ...tone, start: tone.start + 1.35 })),
  ];

  for (const tone of pattern) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, context.currentTime + tone.start);
    envelope.gain.exponentialRampToValueAtTime(
      0.9,
      context.currentTime + tone.start + 0.012,
    );
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + tone.start + tone.duration,
    );
    envelope.connect(master);

    const primary = context.createOscillator();
    primary.type = "square";
    primary.frequency.setValueAtTime(tone.frequency, context.currentTime + tone.start);
    primary.connect(envelope);
    primary.start(context.currentTime + tone.start);
    primary.stop(context.currentTime + tone.start + tone.duration);

    const harmonic = context.createOscillator();
    const harmonicGain = context.createGain();
    harmonic.type = "triangle";
    harmonic.frequency.setValueAtTime(tone.frequency * 2, context.currentTime + tone.start);
    harmonicGain.gain.setValueAtTime(0.28, context.currentTime + tone.start);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(envelope);
    harmonic.start(context.currentTime + tone.start);
    harmonic.stop(context.currentTime + tone.start + tone.duration);
  }

  if ("vibrate" in navigator) {
    navigator.vibrate(
      type === "request_bill"
        ? [240, 100, 300, 250, 240, 100, 300]
        : [180, 80, 180, 80, 320, 250, 180, 80, 180, 80, 320],
    );
  }

  window.setTimeout(() => {
    void context.close();
  }, 3200);
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
