import React from 'react';

interface InfoIconProps {
  width?: number;
  height?: number;
  className?: string;
}

const InfoIcon: React.FC<InfoIconProps> = ({ 
  width = 16, 
  height = 16, 
  className = '' 
}) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M8.00013 14.0149C11.1394 14.0149 13.6843 11.47 13.6843 8.33069C13.6843 5.19139 11.1394 2.64648 8.00013 2.64648C4.86083 2.64648 2.31592 5.19139 2.31592 8.33069C2.31592 11.47 4.86083 14.0149 8.00013 14.0149Z" 
        stroke="#959595" 
        strokeWidth="1.26316"
      />
      <path 
        d="M8.31566 5.48766C8.31566 5.66207 8.17428 5.80345 7.99987 5.80345C7.82546 5.80345 7.68408 5.66207 7.68408 5.48766C7.68408 5.31326 7.82546 5.17188 7.99987 5.17188C8.17428 5.17188 8.31566 5.31326 8.31566 5.48766Z" 
        fill="#959595" 
        stroke="#959595" 
        strokeWidth="0.842105"
      />
      <path 
        d="M8 11.4894V7.06836" 
        stroke="#959595" 
        strokeWidth="1.26316"
      />
    </svg>
  );
};

export default InfoIcon;

