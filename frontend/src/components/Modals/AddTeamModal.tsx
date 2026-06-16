import React, { useState, useCallback, ChangeEvent } from 'react';
import Modal from 'react-modal';
import { useDropzone } from 'react-dropzone';
import { IoCloseOutline } from 'react-icons/io5';
import { TeamModalProps, TeamType, UserType } from 'types/common';
import { Button } from '@radix-ui/themes';
import TextField from 'components/fields/TextField';
import InputField from 'components/fields/InputField';

interface AddTeamModalProps extends TeamModalProps {
  onTeamAdd: () => void;
  user: UserType;
  setShowAddTeamModal: (showAddTeamModal: boolean) => void;
  setSelectedTeam: (team: TeamType) => void;
}

function AddTeamModal({
  isOpen,
  onRequestClose,
  user,
  onTeamAdd,
  setSelectedTeam,
  setShowAddTeamModal,
}: AddTeamModalProps) {
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [teamLogo, setTeamLogo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setTeamLogo(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.png'],
    },
    maxFiles: 1,
  });

  const handleTeamUpload = async (
    name: string,
    description: string,
    file: File | null,
  ) => {
    setIsUploading(true);
    const formData = new FormData();

    if (!file) {
      const defaultLogoUrl = '/img/teams/teamLogo.png';
      const defaultLogoResponse = await fetch(defaultLogoUrl);
      const defaultLogoBlob = await defaultLogoResponse.blob();
      formData.append('logo', defaultLogoBlob, 'defaultTeamLogo.png');
    } else {
      formData.append('logo', file, file.name);
    }

    try {
      const createTeamUrl = `${
        process.env.NEXT_PUBLIC_FRONTEND_IP
      }/service_desk/create_team?name=${encodeURIComponent(
        name,
      )}&description=${encodeURIComponent(description)}&org_id=${user?.org_id}`;
      const response = await fetch(createTeamUrl, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${user?.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          `HTTP error! status: ${response.status}, ${errorData.detail}`,
        );
      }
      const result = await response.json();

      const {
        id,
        name: teamName,
        description: teamDescription,
        logo,
      } = result[0];

      setSelectedTeam({
        id,
        name: teamName,
        description: teamDescription,
        logo,
      });
      onTeamAdd();
    } catch (error) {
      console.error(`Error uploading team: ${error}`);
    } finally {
      setIsUploading(false);
      setShowAddTeamModal(false); // Close modal after upload
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/3 bg-white p-5 rounded-2xl shadow-lg dark:!bg-navy-800 overflow-y-auto border-none"
      contentLabel="Add New Team"
    >
      <button
        onClick={onRequestClose}
        className="absolute top-0 right-0 p-2"
        aria-label="Close"
      >
        <IoCloseOutline size={24} className="dark:text-white text-gray-700" />
      </button>
      <h2 className="text-lg font-bold dark:text-white">Add New Team</h2>
      <div className="mt-4">
        <InputField
          id="newTeamName"
          label="Team Name"
          name="newTeamName"
          value={newTeamName}
          placeholder="Enter team name"
          onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTeamName(e.target.value)}
        />
        <TextField
          id="newTeamDescription"
          label="Team Description"
          value={newTeamDescription}
          placeholder="Enter team description"
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewTeamDescription(e.target.value)}
          rows={3}
        />
        <div
          {...getRootProps()}
          className="flex items-center justify-center border-2 border-dashed border-gray-300 text-gray-400 outline-none transition-all ease-in-out cursor-pointer p-5 mb-5 h-38 rounded-2xl dark:bg-navy-700 mt-5"
        >
          <input {...getInputProps()} />
          <p>
            Drag &apos;n&apos; drop a logo file here, or click to select a file
          </p>
        </div>
        {teamLogo && (
          <p className="mb-4">
            Logo selected:
            {teamLogo.name}
          </p>
        )}
        <Button
          onClick={() => handleTeamUpload(newTeamName, newTeamDescription, teamLogo)}
          disabled={isUploading}
          color="indigo"
        >
          {isUploading ? 'Uploading...' : 'Add Team'}
        </Button>
      </div>
    </Modal>
  );
}

export default AddTeamModal;
