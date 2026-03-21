import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import PlatformLayout from '@/components/layout/PlatformLayout';
const { Pages, Layout, mainPage } = pagesConfig;
const MainPage = Pages[mainPage] ?? null;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Dashboard/Landing Page - No layout wrapper */}
      <Route path="/" element={MainPage ? <MainPage /> : <PageNotFound />} />
      
      {/* Starship Bridge - Full immersive (no nav) */}
      <Route path="/StarshipBridge" element={Pages.StarshipBridge ? <Pages.StarshipBridge /> : <PageNotFound />} />
      
      {/* All other pages - With platform layout and navigation */}
      <Route element={<PlatformLayout />}>
        {Object.entries(Pages)
          .filter(([path]) => !['Dashboard', 'StarshipBridge'].includes(path))
          .map(([path, Page]) => (
            <Route key={path} path={`/${path}`} element={Page ? <Page /> : <PageNotFound />} />
          ))}
        {/* Nested 404 for module paths */}
        <Route path="*" element={<PageNotFound />} />
      </Route>
      
      {/* Root catch-all 404 */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App