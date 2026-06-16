// hooks/useUsers.ts
import { useState, useEffect, useCallback } from 'react';
import { useGlobalContext } from 'contexts/store';
import { User } from 'api/user';

type RowObj = {
  name: string[];
  email: string;
  date: string;
  teams: string[];
  platform: {
    id: string;
    profile_type: string;
    profile_username: string;
  }[];
  id: string;
};

const useUsers = () => {
  const { user, selectedTeam } = useGlobalContext();
  const [users, setUsers] = useState<RowObj[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlatformInfo = async (userId: string) => {
    try {
      return await User.GetUserProfile(userId, user);
    } catch (e) {
      console.error(`Error fetching platform data for user ${userId}:`, e);
      return [];
    }
  };

  const transformUserData = useCallback((apiData, platformData) => apiData.map((u) => ({
    name: [u.name, u.profile_pic],
    email: u.email,
    date: new Date(u.created_at).toLocaleDateString('en-US'),
    teams: u.teams,
    platform: platformData[u.id] || [],
    id: u.id,
  })), []);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      if (user?.org_id && selectedTeam?.id) {
        const data = await User.GetUsers(user.org_id, selectedTeam.id, user);

        const platformPromises = data.map((u) => fetchPlatformInfo(u.id));
        const platformResults = await Promise.all(platformPromises);

        const platformMap = data.reduce((acc, u, index) => {
          acc[u.id] = platformResults[index];
          return acc;
        }, {});

        const transformedData = transformUserData(data, platformMap);
        setUsers(transformedData);
      }
    } catch (e) {
      console.error(`Error fetching users: ${e.message}`);
      setError(`Error fetching users: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedTeam, transformUserData]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users, isLoading, error, refreshUsers: fetchUsers,
  };
};

export default useUsers;
