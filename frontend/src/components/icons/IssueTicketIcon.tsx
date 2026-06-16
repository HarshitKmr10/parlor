import React, { SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
}

function IssueTicketIcon({ width = 29, height = 28 }: Props) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.11003 9.33333L20.6934 3.5L23.0267 9.33333M3.19336 9.33333H26.5267V12.8333C24.7767 12.8333 23.0267 14 23.0267 16.0417C23.0267 18.0833 24.7767 19.8333 26.5267 19.8333V23.3333H3.19336V19.8333C4.94336 19.8333 6.69336 18.6667 6.69336 16.3333C6.69336 14 4.94336 12.8333 3.19336 12.8333V9.33333Z"
        stroke="#EF5A7A"
        stroke-width="2.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M10.7754 14.8086H14.2754M10.7754 18.3086H18.9421"
        stroke="#EF5A7A"
        stroke-width="2.33333"
        stroke-linecap="round"
      />
    </svg>
  );
}

export default IssueTicketIcon;
