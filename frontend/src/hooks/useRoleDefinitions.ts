import { useState, useEffect, useCallback } from 'react';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { MultiSelectOption } from 'components/common/MultiSelectDropdown/MultiSelectDropdown';

export interface RoleDefinition extends MultiSelectOption {
  description?: string;
  is_global?: boolean;
}

interface UseRoleDefinitionsReturn {
  roles: RoleDefinition[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useRoleDefinitions(): UseRoleDefinitionsReturn {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await serviceDeskInstance.get('/service_desk/role_definitions');
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching role definitions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch roles'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { roles, isLoading, error, refetch: fetchRoles };
}
