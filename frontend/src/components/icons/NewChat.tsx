import React from 'react';
import clsx from 'clsx';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

function NewChat({ className, ...props }: Props) {
  return (
    <div
      className={clsx(
        className,
        'shrink-0  flex items-center justify-center rounded-sm'
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
          d="M5.83325 14.1773L9.51075 14.1648L17.5374 6.21484C17.8524 5.89984 18.0258 5.4815 18.0258 5.0365C18.0258 4.5915 17.8524 4.17317 17.5374 3.85817L16.2158 2.5365C15.5858 1.9065 14.4866 1.90984 13.8616 2.534L5.83325 10.4857V14.1773ZM15.0374 3.71484L16.3616 5.034L15.0308 6.35234L13.7091 5.0315L15.0374 3.71484ZM7.49992 11.1807L12.5249 6.20317L13.8466 7.52484L8.82242 12.5007L7.49992 12.5048V11.1807Z"
          fill="#5B5BD6"
        />
        <path
          d="M4.16667 17.5H15.8333C16.7525 17.5 17.5 16.7525 17.5 15.8333V8.61L15.8333 10.2767V15.8333H6.79833C6.77667 15.8333 6.75417 15.8417 6.7325 15.8417C6.705 15.8417 6.6775 15.8342 6.64917 15.8333H4.16667V4.16667H9.8725L11.5392 2.5H4.16667C3.2475 2.5 2.5 3.2475 2.5 4.16667V15.8333C2.5 16.7525 3.2475 17.5 4.16667 17.5Z"
          fill="#5B5BD6"
        />
      </svg>
    </div>
  );
}

export default NewChat;