import { Button, TextField } from '@radix-ui/themes';
import { API } from 'api';
import React, { useState } from 'react';
import Modal from 'react-modal';
import { TeamModalProps, TeamType, UserType } from 'types/common';

interface EditTeamModalProps extends TeamModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  teamBeingEdited: TeamType;
  user: UserType;
  setSelectedTeam: (team: TeamType) => void;
  onTeamChange: () => void;
}

function EditTeamModal({
  isOpen,
  onRequestClose,
  user,
  onTeamChange,
  teamBeingEdited,
  setSelectedTeam,
}: EditTeamModalProps) {
  const [teamName, setTeamName] = useState(teamBeingEdited.name);
  const [teamDescription, setTeamDescription] = useState(
    teamBeingEdited.description,
  );

  const handleSubmit = async () => {
    try {
      const updatedTeam = await API.Teams.UpdateTeam(user, teamBeingEdited.id, {
        name: teamName,
        description: teamDescription,
      });

      setSelectedTeam(updatedTeam);
      onRequestClose();
      onTeamChange();
    } catch (error) {
      console.error(`Error updating team: ${error}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/3 h-auto bg-white p-5 rounded-2xl shadow-lg dark:!bg-navy-800"
      contentLabel="Edit Team"
    >
      <div className="rounded-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white">Edit Team</h2>
          <button
            onClick={onRequestClose}
            className="text-lg font-bold dark:text-white text-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <TextField.Root
          className="w-full mb-4"
          placeholder="Enter new team name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <TextField.Root
          className="w-full mb-4"
          placeholder="Enter new team description"
          value={teamDescription}
          onChange={(e) => setTeamDescription(e.target.value)}
        />
        <div className="flex justify-end mt-4 space-x-2">
          <Button onClick={handleSubmit} color="indigo">
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default EditTeamModal;
