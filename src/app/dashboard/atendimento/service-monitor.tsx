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
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
  gain.connect(context.destination);

  const first = context.createOscillator();
  first.type = "sine";
  first.frequency.value = type === "request_bill" ? 740 : 880;
  first.connect(gain);
  first.start();
  first.stop(context.currentTime + 0.18);

  const second = context.createOscillator();
  second.type = "sine";
  second.frequency.value = type === "request_bill" ? 560 : 1040;
  second.connect(gain);
  second.start(context.currentTime + 0.2);
  second.stop(context.currentTime + 0.4);

  window.setTimeout(() => {
    void context.close();
  }, 650);
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
