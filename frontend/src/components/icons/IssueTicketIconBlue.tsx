import React, { SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
}

function IssueTicketIconBlue({ width = 29, height = 28 }: Props) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.79753 9.33333L20.3809 3.5L22.7142 9.33333M2.88086 9.33333H26.2142V12.8333C24.4642 12.8333 22.7142 14 22.7142 16.0417C22.7142 18.0833 24.4642 19.8333 26.2142 19.8333V23.3333H2.88086V19.8333C4.63086 19.8333 6.38086 18.6667 6.38086 16.3333C6.38086 14 4.63086 12.8333 2.88086 12.8333V9.33333Z"
        stroke="#5B5BD6"
        stroke-width="2.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M10.4629 14.8086H13.9629M10.4629 18.3086H18.6296"
        stroke="#5B5BD6"
        stroke-width="2.33333"
        stroke-linecap="round"
      />
    </svg>
  );
}

export default IssueTicketIconBlue;
