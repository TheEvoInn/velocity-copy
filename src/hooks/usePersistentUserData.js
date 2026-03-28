export function usePersistentUserData() {
  return {
    userData: null,
    loading: false,
    error: null,
    updateField: async () => {},
    readField: () => null,
    resetField: async () => {},
    validateIntegrity: async () => ({ valid: true }),
    reload: async () => {},
  };
}
