import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from './components/layout/AppLayout';

// Core pages
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';

// Four departments
import Discovery from './pages/Discovery';
import Execution from './pages/Execution';
import Finance from './pages/Finance';
import Control from './pages/Control';

// Supporting pages (accessible via department links)
import Opportunities from './pages/Opportunities';
import Strategies from './pages/Strategies';
import WalletPage from './pages/WalletPage';
import ActivityPage from './pages/ActivityPage';
import AutoPilot from './pages/AutoPilot';
import AutopilotLogs from './pages/AutopilotLogs';
import AccountManager from './pages/AccountManager';
import PrizeDashboard from './pages/PrizeDashboard';
import IdentityManager from './pages/IdentityManager';
import AIIdentityStudio from './pages/AIIdentityStudio';
import SystemDocumentation from './pages/SystemDocumentation';
import SecurityDashboard from './pages/SecurityDashboard';
import SystemAuditDashboard from './pages/SystemAuditDashboard';
import KYCManagement from './pages/KYCManagement';
import DataPersistenceAudit from './pages/DataPersistenceAudit';
import PlatformAuditDashboard from './pages/PlatformAuditDashboard';
import ExchangeConnectivity from './pages/ExchangeConnectivity';
import AdminControlPanel from './pages/AdminControlPanel';
import BackgroundExecutionHub from './pages/BackgroundExecutionHub.jsx';
import EmailOutreachHub from './pages/EmailOutreachHub';
import UserAccessPage from './pages/UserAccessPage';
import TaskQueueApproval from './pages/TaskQueueApproval.jsx';
import FinancialDashboard from './pages/FinancialDashboard';
import TemplatesLibrary from './pages/TemplatesLibrary.jsx';
import DigitalResellers from './pages/DigitalResellers';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500">Initializing Profit Engine...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/Dashboard" replace />} />
      <Route element={<AppLayout />}>
        {/* Command Center */}
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/Chat" element={<Chat />} />

        {/* Four Departments */}
        <Route path="/Discovery" element={<Discovery />} />
        <Route path="/Execution" element={<Execution />} />
        <Route path="/Finance" element={<Finance />} />
        <Route path="/Control" element={<Control />} />

        {/* Supporting Pages */}
        <Route path="/Opportunities" element={<Opportunities />} />
        <Route path="/Strategies" element={<Strategies />} />
        <Route path="/WalletPage" element={<WalletPage />} />
        <Route path="/ActivityPage" element={<ActivityPage />} />
        <Route path="/AutoPilot" element={<AutoPilot />} />
        <Route path="/AutopilotLogs" element={<AutopilotLogs />} />
        <Route path="/IdentityManager" element={<IdentityManager />} />
        <Route path="/AIIdentityStudio" element={<AIIdentityStudio />} />
        <Route path="/AccountManager" element={<AccountManager />} />
        <Route path="/PrizeDashboard" element={<PrizeDashboard />} />
        <Route path="/SystemDocumentation" element={<SystemDocumentation />} />
        <Route path="/SecurityDashboard" element={<SecurityDashboard />} />
        <Route path="/SystemAuditDashboard" element={<SystemAuditDashboard />} />
        <Route path="/KYCManagement" element={<KYCManagement />} />
        <Route path="/DataPersistenceAudit" element={<DataPersistenceAudit />} />
        <Route path="/PlatformAuditDashboard" element={<PlatformAuditDashboard />} />
        <Route path="/ExchangeConnectivity" element={<ExchangeConnectivity />} />
        <Route path="/AdminControlPanel" element={<AdminControlPanel />} />
        <Route path="/BackgroundExecutionHub" element={<BackgroundExecutionHub />} />
        <Route path="/EmailOutreachHub" element={<EmailOutreachHub />} />
        <Route path="/UserAccessPage" element={<UserAccessPage />} />
        <Route path="/TaskQueueApproval" element={<TaskQueueApproval />} />
        <Route path="/FinancialDashboard" element={<FinancialDashboard />} />
        <Route path="/TemplatesLibrary" element={<TemplatesLibrary />} />
        <Route path="/DigitalResellers" element={<DigitalResellers />} />
      </Route>
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
  );
}

export default App;