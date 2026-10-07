type CaloriBrandProps = {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
  tagline?: boolean;
};

export function CaloriMark({
  size = 30,
  inverse = false,
}: {
  size?: number;
  inverse?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 48"
      fill="none"
      aria-hidden="true"
      className="calori-mark"
    >
      <path
        d="M23.7 1.6c2.2 7.8-1.5 12.7-6.1 17.2-4.1 4-7.2 7.8-6.7 13.2.3 3.1 1.8 5.7 4 7.8C7.2 38.5 2 33.1 2 26.1 2 18 8.4 13.3 14.3 9.1c4-2.8 7-4.9 9.4-7.5Z"
        fill={inverse ? "#F8F1EA" : "#C65A3A"}
      />
      <path
        d="M30.9 13.4c4.7 5.3 7.1 10.2 7.1 15.4 0 8.2-6.1 14.9-14.7 17.6 1.9-2.3 3.1-4.9 3-7.8-.2-4.1-3.3-6.7-5.4-9.4-2.2-2.8-2.4-5.8-.7-9.2 2.2 2.7 3.8 5.1 3.7 7.9 3.6-3.7 6.8-7.7 7-14.5Z"
        fill={inverse ? "#F8F1EA" : "#C65A3A"}
      />
    </svg>
  );
}

export default function CaloriBrand({
  compact = false,
  inverse = false,
  className = "",
  tagline = false,
}: CaloriBrandProps) {
  return (
    <span
      className={[
        "calori-brand-lockup",
        compact ? "compact" : "",
        inverse ? "inverse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CaloriMark size={compact ? 24 : 32} inverse={inverse} />
      <span className="calori-brand-copy">
        <strong>Calori</strong>
        {tagline && <small>A experiência digital do seu restaurante</small>}
      </span>
    </span>
  );
}
