'use client';

import { PropsWithChildren, createContext, useContext, useState, useEffect } from 'react';
import { StoreApi, createStore, useStore } from 'zustand';
import { useParams } from 'next/navigation';
import { IncidentSession, useIncidentSessionsData } from 'hooks/AppsInfra/useIncidentChat';
import { AgenticApp, getAgenticApps } from 'api/appsInfra';

type AppsInfraStore = {
  incidentSessions: IncidentSession[];
  incidentSessionLoading: boolean;
  setIncidentSessionLoading: (incidentSessionLoading: boolean) => void;

  loading: boolean;
  error: string | null;
  setIncidentSessions: (incidentSessions: IncidentSession[]) => void;
  apps: AgenticApp[];
  appsLoading: boolean; // New loading state for apps
  fetchApps: () => Promise<void>;
  refetch: () => Promise<void>;
};

const AppsInfraContext = createContext<StoreApi<AppsInfraStore> | undefined>(
  undefined,
);

export const AppsInfraProvider = ({ children }: PropsWithChildren) => {
  const { incidentId } = useParams();
  const {
    data: incidentSessions,
    loading: incidentSessionLoading,
    refetch,
  } = useIncidentSessionsData(incidentId as string);

  const [store] = useState(() =>
    createStore<AppsInfraStore>((set) => ({
      incidentSessions: [],
      incidentSessionLoading: true,
      setIncidentSessionLoading: (incidentSessionLoading) => set({ incidentSessionLoading }),
      apps: [],
      appsLoading: false, // Initialize apps loading state
      loading: false,
      error: null,
      setIncidentSessions: (incidentSessions) => {
        set({ incidentSessions: incidentSessions });
      },

      fetchApps: async () => {
        try {
          set({ appsLoading: true, error: null }); // Set loading to true and clear any previous errors
          const apps = await getAgenticApps();
          set({ apps, appsLoading: false }); // Set apps and loading to false
        } catch (err: any) {
          console.error('Failed to fetch agentic apps', err);
          set({ 
            error: err.message || 'Could not load apps',
            appsLoading: false // Set loading to false on error
          });
        }
      },
      refetch: async () => {
        const promise = refetch(); // This is likely a function returning a promise
        await promise;
        return promise;
      },
    })),
  );

  useEffect(() => {
    store.getState().setIncidentSessions(incidentSessions);
  }, [incidentSessions]);
  
  useEffect(() => {
    store.getState().setIncidentSessionLoading(incidentSessionLoading);
  }, [incidentSessionLoading]);

  // Fetch apps on mount
  useEffect(() => {
    store.getState().fetchApps();
  }, []);

  return (
    <AppsInfraContext.Provider value={store}>{children}</AppsInfraContext.Provider>
  );
};

export function useAppsInfraStore<T>(selector: (state: AppsInfraStore) => T) {
  const context = useContext(AppsInfraContext);
  if (!context) {
    throw new Error('AppsInfraProvider is missing');
  }
  return useStore(context, selector);
}
