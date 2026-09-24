import styles from "./knowledge.module.css";

function point(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 80 + Math.cos(radians) * radius,
    y: 80 + Math.sin(radians) * radius,
  };
}

export function Tachometer({
  rpm,
  redline,
  locale,
  label,
}: {
  readonly rpm: number;
  readonly redline: number;
  readonly locale: string;
  readonly label: string;
}) {
  const scale = Math.ceil(redline / 1000) * 1000;
  const angle = 135 + (Math.min(rpm, scale) / scale) * 270;
  const tip = point(angle, 55);
  const tail = point(angle + 180, 13);
  const labelStep = scale > 7000 ? 2 : 1;
  const ticks = Array.from({ length: scale / 250 + 1 }, (_, index) => {
    const value = index * 250;
    const tickAngle = 135 + (value / scale) * 270;
    return {
      value,
      major: value % 1000 === 0,
      start: point(tickAngle, value % 1000 === 0 ? 59 : 63),
      end: point(tickAngle, 69),
    };
  });
  const numbers = Array.from(
    { length: scale / 1000 + 1 },
    (_, index) => index,
  ).filter((value) => value % labelStep === 0);

  return (
    <div
      aria-label={label}
      aria-valuemax={redline}
      aria-valuemin={0}
      aria-valuenow={Math.min(rpm, redline)}
      className={styles.rpmDial}
      data-needle-angle={Math.round(angle)}
      role="meter"
    >
      <svg aria-hidden="true" viewBox="0 0 160 160">
        <circle className={styles.dialRim} cx="80" cy="80" r="77" />
        <circle className={styles.dialFace} cx="80" cy="80" r="71" />
        {ticks.map(({ value, major, start, end }) => (
          <line
            className={
              value >= redline * 0.85 ? styles.redTick : styles.dialTick
            }
            key={value}
            strokeWidth={major ? 2.5 : 1}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
          />
        ))}
        {numbers.map((number) => {
          const position = point(135 + ((number * 1000) / scale) * 270, 48);
          return (
            <text
              className={styles.dialNumber}
              dominantBaseline="middle"
              key={number}
              textAnchor="middle"
              x={position.x}
              y={position.y}
            >
              {number}
            </text>
          );
        })}
        <text className={styles.dialUnit} textAnchor="middle" x="80" y="63">
          ×1000 RPM
        </text>
        <line
          className={styles.dialNeedleShadow}
          strokeWidth="6"
          x1={tail.x}
          x2={tip.x}
          y1={tail.y}
          y2={tip.y}
        />
        <line
          className={styles.dialNeedle}
          strokeWidth="3"
          x1={tail.x}
          x2={tip.x}
          y1={tail.y}
          y2={tip.y}
        />
        <circle className={styles.dialHub} cx="80" cy="80" r="8" />
        <rect
          className={styles.dialReadout}
          height="24"
          rx="5"
          width="72"
          x="44"
          y="107"
        />
        <text className={styles.dialValue} textAnchor="middle" x="80" y="124">
          {rpm.toLocaleString(locale)}
        </text>
      </svg>
    </div>
  );
}
