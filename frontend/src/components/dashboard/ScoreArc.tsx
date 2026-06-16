import React from 'react';

interface ScoreArcProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const createArc = (
  startAngle: number,
  endAngle: number,
  radius = 45,
) => {
  const start = polarToCartesian(50, 50, radius, endAngle);
  const end = polarToCartesian(50, 50, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

export const ScoreArc: React.FC<ScoreArcProps> = ({
  score,
  size = 168,
  strokeWidth = 10,
}) => {
  const redEnd = -60;
  const orangeEnd = 0;
  const greenEnd = 60;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* Background Arc */}
      <path
        d={createArc(-90, 90)}
        fill="none"
        stroke="#e0e0e0"
        strokeWidth={strokeWidth}
        className="transition-all duration-300"
      />

      {/* Score Segments */}
      <path
        d={createArc(-90, redEnd)}
        fill="none"
        stroke="#ef4444"
        strokeWidth={strokeWidth}
        className="transition-all duration-300"
      />
      <path
        d={createArc(redEnd, orangeEnd)}
        fill="none"
        stroke="#f97316"
        strokeWidth={strokeWidth}
        className="transition-all duration-300"
      />
      <path
        d={createArc(orangeEnd, greenEnd)}
        fill="none"
        stroke="#22c55e"
        strokeWidth={strokeWidth}
        className="transition-all duration-300"
      />

      {/* Score Text */}
      <text
        x="40"
        y="40"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15"
        fontWeight="bold"
        className="transition-all duration-300"
      >
        {score}
      </text>
      <text
        x="66"
        y="40"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fill="#888"
        className="transition-all duration-300"
      >
        / 100
      </text>
    </svg>
  );
};
