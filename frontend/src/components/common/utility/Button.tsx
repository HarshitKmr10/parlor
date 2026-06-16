import React, { PropsWithChildren } from 'react';

type Props = {
  onClick: () => void;
  disabled?: boolean;
};

function Primary({ onClick, disabled, children }: PropsWithChildren<Props>) {
  return (
    <button
      className="disconnect px-8 py-2 border-[currentColor] outline-none flex rounded-2xl items-center gap-2 font-semibold bg-indigo-500 text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none hover:bg-indigo-400"
      disabled={disabled}
      onClick={onClick}
    >
      {/* <StopIcon /> */}
      {children}
    </button>
  );
}

function Secondary({ onClick, children, disabled }: PropsWithChildren<Props>) {
  return (
    <button
      className="create_ticket px-4 py-2 border-2 border-[currentColor] outline-none flex rounded-2xl items-center gap-2 font-semibold disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none hover:bg-textColor-light/10 dark:hover:bg-textColor-dark/10"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const param = { Primary, Secondary };
export default param;
