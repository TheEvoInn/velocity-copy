import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Page imports
import Dashboard from './pages/Dashboard';
import StarshipBridge from './pages/StarshipBridge';
import Control from './pages/Control';
import AutoPilot from './pages/AutoPilot';
import AutoPilotEngine from './pages/AutoPilotEngine';
import Discovery from './pages/Discovery';
import WorkDiscovery from './pages/WorkDiscovery';
import Execution from './pages/Execution';
import Finance from './pages/Finance';
import WalletDashboard from './pages/WalletDashboard';
import CryptoAutomation from './pages/CryptoAutomation';
import DigitalResellers from './pages/DigitalResellers';
import NED from './pages/NED';
import VIPZ from './pages/VIPZ';
import IdentityManager from './pages/IdentityManager';
import Chat from './pages/Chat';
import SystemAuditDashboard from './pages/SystemAuditDashboard';
import AdminPanel from './pages/AdminPanel';
import AutopilotLogs from './pages/AutopilotLogs';
import AIIdentityStudio from './pages/AIIdentityStudio';
import TemplatesLibrary from './pages/TemplatesLibrary';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/Dashboard" element={<Dashboard />} />
      <Route path="/StarshipBridge" element={<StarshipBridge />} />
      <Route path="/Control" element={<Control />} />
      <Route path="/AutoPilot" element={<AutoPilot />} />
      <Route path="/AutoPilotEngine" element={<AutoPilotEngine />} />
      <Route path="/Discovery" element={<Discovery />} />
      <Route path="/WorkDiscovery" element={<WorkDiscovery />} />
      <Route path="/Execution" element={<Execution />} />
      <Route path="/Finance" element={<Finance />} />
      <Route path="/WalletDashboard" element={<WalletDashboard />} />
      <Route path="/CryptoAutomation" element={<CryptoAutomation />} />
      <Route path="/DigitalResellers" element={<DigitalResellers />} />
      <Route path="/NED" element={<NED />} />
      <Route path="/VIPZ" element={<VIPZ />} />
      <Route path="/IdentityManager" element={<IdentityManager />} />
      <Route path="/Chat" element={<Chat />} />
      <Route path="/SystemAuditDashboard" element={<SystemAuditDashboard />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/AdminPanel" element={<AdminPanel />} />
      <Route path="/AutopilotLogs" element={<AutopilotLogs />} />
      <Route path="/AIIdentityStudio" element={<AIIdentityStudio />} />
      <Route path="/TemplatesLibrary" element={<TemplatesLibrary />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App