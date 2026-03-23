import { QueryClient } from '@tanstack/react-query';

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
			retry: (failureCount, error) => {
				if (error?.status === 401 || error?.status === 403) return false;
				if (!isOnline()) return failureCount < 3;
				return failureCount < 2;
			},
			refetchOnWindowFocus: false,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
		},
		mutations: {
			retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
			retry: (failureCount, error) => {
				if (error?.status === 401 || error?.status === 403) return false;
				if (!isOnline()) return failureCount < 3;
				return failureCount < 1;
			},
		},
	},
});

// Network state listener
if (typeof window !== 'undefined') {
	window.addEventListener('online', () => {
		queryClientInstance.refetchQueries();
	});
	window.addEventListener('offline', () => {
		console.warn('[Network] Offline detected');
	});
}