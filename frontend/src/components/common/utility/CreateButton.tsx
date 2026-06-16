import AddDocument from 'components/icons/AddDocument';
import React from 'react';

type Props = {
  onClick: () => void
};

function CreateButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="text-base border-2 text-textColor-light dark:text-textColor-dark border-textColor-light dark:border-textColor-dark font-semibold px-4 py-[.05rem] rounded-full flex justify-center items-center gap-2"
    >
      <AddDocument />
      <p>Create</p>
    </button>
  );
}

export default CreateButton;
