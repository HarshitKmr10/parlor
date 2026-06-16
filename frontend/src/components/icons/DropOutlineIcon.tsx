
import React from 'react';
import type { SVGProps } from 'react';

export function DropOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" {...props} xmlns="http://www.w3.org/2000/svg">
        <rect width="18" height="18" fill="currentColor" fillOpacity="0.01"/>
        <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M3.60156 10.7998C3.60156 7.7998 5.40156 5.0998 9.00156 1.7998C12.6016 5.0998 14.4016 7.7998 14.4016 10.7998C14.4016 13.7822 11.9839 16.1998 9.00156 16.1998C6.01923 16.1998 3.60156 13.7822 3.60156 10.7998ZM13.1444 9.96349C11.6097 9.38526 9.94704 10.1543 8.38903 10.8749C7.1208 11.4615 5.92194 12.016 4.9179 11.7856C4.84185 11.4695 4.80156 11.1393 4.80156 10.7998C4.80156 8.53424 6.03379 6.32614 9.00156 3.44809C11.6036 5.97147 12.8716 7.97985 13.1444 9.96349Z" />
    </svg>
  );
}
