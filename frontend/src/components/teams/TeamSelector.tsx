// components/TeamSelector.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AiOutlineEdit } from 'react-icons/ai';
import Spinner from 'components/spinner/spinner';
import { useGlobalContext } from 'contexts/store';
import { API } from 'api';
import TeamListModal from 'components/Modals/TeamListModal';
import EditTeamModal from 'components/Modals/EditTeamModal';
import AddTeamModal from 'components/Modals/AddTeamModal';
import { TeamType } from 'types/common';

interface TeamSelectorProps {
  isSideNavigator?: boolean;
}

function TeamSelector({ isSideNavigator = false }: TeamSelectorProps) {
  const { user, selectedTeam, setSelectedTeam } = useGlobalContext();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState<boolean>(false);
  const [filteredTeams, setFilteredTeams] = useState<TeamType[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [teamBeingEdited, setTeamBeingEdited] = useState<TeamType | null>(null);

  // Fetch teams data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (user) {
        const result = await API.Teams.GetAllTeams(user);
        if (Array.isArray(result) && result.length > 0) {
          setFilteredTeams(result);
          if (!selectedTeam) {
            setSelectedTeam(result[0]);
          }
        } else {
          setFilteredTeams([]);
        }
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      // Handle error (e.g., show error message to user)
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedTeam, setSelectedTeam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle team editing
  const handleEditClick = (team: TeamType) => {
    setTeamBeingEdited(team);
    setShowEditModal(true);
  };

  // Handle team deletion
  const handleDelete = async (teamId: string) => {
    setIsDeleting(true);
    setIsModalOpen(false);

    try {
      const response = await API.Teams.DeleteTeam(user, teamId);
      if (response.success) {
        setFilteredTeams((prevTeams) => prevTeams.filter((team) => team.id !== teamId));
        setSelectedTeam(null);
      } else {
        console.error(response.message || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      // Handle error (e.g., show error message to user)
    } finally {
      setIsDeleting(false);
    }
  };

  // Render loading spinner if data is being fetched or a team is being deleted
  if (isLoading || isDeleting) {
    return isSideNavigator ? <Spinner /> : null;
  }

  return (
    <div>
      <div className="p-6 flex items-center">
        <div className="font-poppins text-lg font-bold text-navy-700 dark:text-white mr-4">
          {selectedTeam ? selectedTeam.name : 'Please Select a Team'}
        </div>
        <AiOutlineEdit
          onClick={() => setIsModalOpen(true)}
          size={30}
          className="cursor-pointer mr-2 text-gray-700 dark:text-white"
        />
      </div>

      {/* Team List Modal */}
      <TeamListModal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        teams={filteredTeams}
        setSelectedTeam={setSelectedTeam}
        onEditClick={handleEditClick}
        onDelete={handleDelete}
        user={user}
        onAddTeam={() => {
          setIsModalOpen(false);
          setShowAddTeamModal(true);
        }}
      />

      {/* Add Team Modal */}
      <AddTeamModal
        isOpen={showAddTeamModal}
        onRequestClose={() => setShowAddTeamModal(false)}
        user={user}
        onTeamAdd={fetchData}
        setSelectedTeam={setSelectedTeam}
        setShowAddTeamModal={setShowAddTeamModal}
      />

      {/* Edit Team Modal */}
      {teamBeingEdited && (
        <EditTeamModal
          isOpen={showEditModal}
          onRequestClose={() => setShowEditModal(false)}
          user={user}
          onTeamChange={fetchData}
          teamBeingEdited={teamBeingEdited}
          setSelectedTeam={setSelectedTeam}
        />
      )}
    </div>
  );
}

export default TeamSelector;
