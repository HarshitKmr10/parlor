import React from 'react';

const ProgressCircle = ({ progress, size = 16 }) => {
  // Calculate path for pie slice
  const getSlicePath = (percentage, size, padding = 2) => {
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size - padding * 2) / 2;

    // Convert percentage to angle (0-360 degrees)
    const angle = (percentage / 100) * 360;

    // Convert angle to radians
    const angleRad = (angle - 90) * Math.PI / 180;

    // Calculate end point
    const endX = centerX + radius * Math.cos(angleRad);
    const endY = centerY + radius * Math.sin(angleRad);

    // Create arc flag (0 for < 180 degrees, 1 for >= 180 degrees)
    const largeArcFlag = angle > 180 ? 1 : 0;

    // Generate SVG path
    const path = [
      `M ${centerX} ${padding}`, // Start at top center
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
      `L ${centerX} ${centerY}`, // Line to center
      'Z', // Close path
    ].join(' ');

    return path;
  };

  const getProgressColor = (score) => {
    if (score < 50) return 'fill-red-500';
    if (score <= 75) return 'fill-yellow-500';
    return 'fill-green-500';
  };

  const getStrokeColor = (score) => {
    if (score < 50) return 'stroke-red-500';
    if (score <= 75) return 'stroke-yellow-500';
    return 'stroke-green-500';
  };

  const getBackgroundColor = (score) => {
    if (score === 100) return 'fill-green-500';
    return 'fill-white';
  };

  return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform ">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - 2) / 2}
            className={`${getBackgroundColor(progress)} ${getStrokeColor(progress)} transition-all duration-300`}
          />
          {/* Progress slice - only show if not 100% */}
          {progress < 100 && (
            <path
              d={getSlicePath(progress, size)}
              className={`${getProgressColor(progress)} transition-all duration-300`}
            />
          )}
        </svg>
      </div>
  );
};

export default ProgressCircle;
