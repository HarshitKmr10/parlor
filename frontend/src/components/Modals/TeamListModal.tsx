import InputField from 'components/fields/InputField';
import Image from 'next/image';
import React from 'react';
import { AiOutlineDelete, AiOutlineEdit } from 'react-icons/ai';
import { IoAddOutline } from 'react-icons/io5';
import Modal from 'react-modal';
import { TeamModalProps, TeamType, UserType } from 'types/common';

interface TeamListModalProps extends TeamModalProps {
  teams: TeamType[];
  setSelectedTeam: (team: TeamType) => void;
  onEditClick: (team: TeamType) => void;
  onDelete: (teamId: string) => void;
  user: UserType;
  onAddTeam: () => void;
}

function TeamListModal({
  isOpen,
  onRequestClose,
  teams,
  setSelectedTeam,
  onEditClick,
  onDelete,
  onAddTeam,
  user,
}: TeamListModalProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  // Null check for teams
  const filteredTeams = Array.isArray(teams)
    ? teams.filter(
        (team) =>
          (team?.name?.toLowerCase()?.includes(searchTerm) ?? false) ||
          (team?.description?.toLowerCase()?.includes(searchTerm) ?? false)
      )
    : [];

  return (
    <Modal
      isOpen={!!isOpen}
      onRequestClose={onRequestClose}
      className="relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/3 bg-white p-5 rounded-2xl shadow-lg dark:!bg-navy-800 overflow-y-auto border-none"
      contentLabel="Team Selection"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold dark:text-white">Teams</h2>
        <button
          onClick={onRequestClose}
          className="text-lg font-bold"
          aria-label="Close"
        >
          {/* Replace with close icon component if you have one */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <InputField
        id="searchTeams"
        label=""
        name="searchTeams"
        placeholder="Search Teams..."
        extra="mb-4"
        onChange={handleSearchChange}
      />

      <div className="overflow-y-auto max-h-96">
        <div className="space-y-4">
          {user && user?.role === 'Admin' && (
            <button
              className="p-2 dark:bg-navy-700 dark:hover:bg-navy-900 bg-gray-50 rounded-2xl flex cursor-pointer dark:text-white font-medium w-full"
              onClick={onAddTeam}
              tabIndex={0}
            >
              <IoAddOutline size={24} className="mr-2 dark:text-white" />
              Add
            </button>
          )}
          {filteredTeams?.length === 0 && (
            <div className="text-gray-500 text-center py-4">No teams found.</div>
          )}
          {filteredTeams?.map((team) => (
            <div
              key={team?.id ?? Math.random()}
              className="flex items-center justify-between p-3 rounded-2xl cursor-pointer dark:bg-navy-700 bg-gray-50 dark:text-white hover:dark:bg-navy-800 hover:bg-gray-100"
            >
              <button
                className="flex items-center w-full text-left"
                onClick={() => {
                  if (team) {
                    setSelectedTeam(team);
                  }
                  onRequestClose?.();
                }}
                tabIndex={0}
              >
                {team?.logo ? (
                  <Image
                    src={team.logo}
                    alt="Logo"
                    className="h-16 w-16 mr-4 rounded-2xl"
                  />
                ) : (
                  <div className="h-16 w-16 mr-4 rounded-2xl bg-gray-200 flex items-center justify-center" />
                )}
                <div>
                  <h3 className="text-lg font-bold">{team?.name ?? 'Unnamed Team'}</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {team?.description ?? 'No description'}
                  </p>
                </div>
              </button>
              <button
                className="dark:text-white text-gray-700 dark:hover:bg-navy-900 hover:bg-gray-300 mr-2 cursor-pointer rounded-2xl p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  if (team) onEditClick(team);
                }}
                aria-label="Edit team"
              >
                <AiOutlineEdit size={28} />
              </button>
              <button
                className="text-red-500 hover:bg-red-300 cursor-pointer rounded-2xl p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  if (team?.id) onDelete(team.id);
                }}
                aria-label="Delete team"
              >
                <AiOutlineDelete size={28} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default TeamListModal;
