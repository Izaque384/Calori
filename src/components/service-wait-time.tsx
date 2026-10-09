"use client";

import { useEffect, useMemo, useState } from "react";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export default function ServiceWaitTime({ createdAt }: { createdAt: string }) {
  const created = useMemo(() => new Date(createdAt).getTime(), [createdAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - created);
  const urgency = elapsed >= 8 * 60_000 ? "critical" : elapsed >= 3 * 60_000 ? "attention" : "normal";

  return <span className={`service-wait-time ${urgency}`}>aguardando há <strong>{formatElapsed(elapsed)}</strong></span>;
}
