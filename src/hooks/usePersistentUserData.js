import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Custom hook for reading and writing user persistent data
 * Ensures all user preferences are saved to the permanent store
 * Automatically syncs with base44 UserDataStore on every operation
 */
export function usePersistentUserData() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  // Initial load
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await base44.functions.invoke('userDataPersistenceManager', {
        action: 'list_all',
      });

      if (result.data?.data) {
        setUserData(result.data.data);
      }
      setError(null);
    } catch (err) {
      console.error('Error loading user data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateField = useCallback(async (field, value) => {
    try {
      const result = await base44.functions.invoke('userDataPersistenceManager', {
        action: 'update',
        field,
        value,
      });

      if (result.data?.success) {
        // Update local state
        setUserData(prev => ({
          ...prev,
          [field]: value,
          last_modified_at: result.data.timestamp,
        }));

        // Invalidate related queries to trigger UI updates
        queryClient.invalidateQueries();

        return true;
      }
      return false;
    } catch (err) {
      console.error(`Error updating ${field}:`, err);
      setError(err);
      return false;
    }
  }, [queryClient]);

  const readField = useCallback(async (field) => {
    try {
      const result = await base44.functions.invoke('userDataPersistenceManager', {
        action: 'read',
        field,
      });

      return result.data?.value;
    } catch (err) {
      console.error(`Error reading ${field}:`, err);
      return null;
    }
  }, []);

  const resetField = useCallback(async (field) => {
    try {
      const result = await base44.functions.invoke('userDataPersistenceManager', {
        action: 'reset',
        field,
      });

      if (result.data?.success) {
        // Reload data
        await loadUserData();
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Error resetting ${field}:`, err);
      return false;
    }
  }, [loadUserData]);

  const validateIntegrity = useCallback(async () => {
    try {
      const result = await base44.functions.invoke('userDataIntegrityValidator', {
        validate_all: false,
      });

      return result.data;
    } catch (err) {
      console.error('Error validating integrity:', err);
      return null;
    }
  }, []);

  return {
    userData,
    loading,
    error,
    updateField,
    readField,
    resetField,
    validateIntegrity,
    reload: loadUserData,
  };
}