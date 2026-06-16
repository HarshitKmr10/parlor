import React from 'react';
import clsx from 'clsx';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  showBadge?: boolean;
}

function SimilarTicketIcon({ className, showBadge = false, ...props }: Props) {
  return (
    <div
      className={clsx(
        className,
        'shrink-0 flex items-center justify-center rounded-sm'
      )}
      {...props}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.5 4.1665V5.83317M12.5 9.1665V10.8332M12.5 14.1665V15.8332M4.16667 4.1665H15.8333C16.2754 4.1665 16.6993 4.3421 17.0118 4.65466C17.3244 4.96722 17.5 5.39114 17.5 5.83317V8.33317C17.058 8.33317 16.634 8.50877 16.3215 8.82133C16.0089 9.13389 15.8333 9.55781 15.8333 9.99984C15.8333 10.4419 16.0089 10.8658 16.3215 11.1783C16.634 11.4909 17.058 11.6665 17.5 11.6665V14.1665C17.5 14.6085 17.3244 15.0325 17.0118 15.345C16.6993 15.6576 16.2754 15.8332 15.8333 15.8332H4.16667C3.72464 15.8332 3.30072 15.6576 2.98816 15.345C2.67559 15.0325 2.5 14.6085 2.5 14.1665V11.6665C2.94203 11.6665 3.36595 11.4909 3.67851 11.1783C3.99107 10.8658 4.16667 10.4419 4.16667 9.99984C4.16667 9.55781 3.99107 9.13389 3.67851 8.82133C3.36595 8.50877 2.94203 8.33317 2.5 8.33317V5.83317C2.5 5.39114 2.67559 4.96722 2.98816 4.65466C3.30072 4.3421 3.72464 4.1665 4.16667 4.1665Z"
          stroke="#5B5BD6"
          strokeWidth="1.66667"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showBadge && <circle cx="17" cy="16" r="3" fill="#FF0000" />}
      </svg>
    </div>
  );
}

export default SimilarTicketIcon;