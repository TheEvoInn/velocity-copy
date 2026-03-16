import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import Strategies from './pages/Strategies';
import WalletPage from './pages/WalletPage';
import ActivityPage from './pages/ActivityPage';
import Chat from './pages/Chat';
import AutoPilot from './pages/AutoPilot';
import GoalCenter from './pages/GoalCenter';
import AccountManager from './pages/AccountManager';
import AIWorkLogPage from './pages/AIWorkLogPage';
import WithdrawalEngine from './pages/WithdrawalEngine';
import IdentityManager from './pages/IdentityManager';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import NegotiationCenter from './pages/NegotiationCenter';
import PrizeDashboard from './pages/PrizeDashboard';
import PrizePayoutsTracker from './pages/PrizePayoutsTracker';
import IdentityManagerExpanded from './pages/IdentityManagerExpanded';
import AgentWorkerCenter from './pages/AgentWorkerCenter';
import SystemDocumentation from './pages/SystemDocumentation';
import IntegrationGuide from './pages/IntegrationGuide';
import SecurityDashboard from './pages/SecurityDashboard';
import CredentialSystemGuide from './pages/CredentialSystemGuide';
import SystemAuditDashboard from './pages/SystemAuditDashboard';
import AuditSummaryReport from './pages/AuditSummaryReport';

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
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/Dashboard" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/Opportunities" element={<Opportunities />} />
        <Route path="/Strategies" element={<Strategies />} />
        <Route path="/WalletPage" element={<WalletPage />} />
        <Route path="/ActivityPage" element={<ActivityPage />} />
        <Route path="/Chat" element={<Chat />} />
        <Route path="/AutoPilot" element={<AutoPilot />} />
        <Route path="/GoalCenter" element={<GoalCenter />} />
        <Route path="/AccountManager" element={<AccountManager />} />
        <Route path="/AIWorkLogPage" element={<AIWorkLogPage />} />
        <Route path="/WithdrawalEngine" element={<WithdrawalEngine />} />
        <Route path="/IdentityManager" element={<IdentityManager />} />
        <Route path="/AnalyticsDashboard" element={<AnalyticsDashboard />} />
        <Route path="/NegotiationCenter" element={<NegotiationCenter />} />
        <Route path="/PrizeDashboard" element={<PrizeDashboard />} />
        <Route path="/PrizePayoutsTracker" element={<PrizePayoutsTracker />} />
        <Route path="/IdentityManagerExpanded" element={<IdentityManagerExpanded />} />
        <Route path="/AgentWorkerCenter" element={<AgentWorkerCenter />} />
        <Route path="/SystemDocumentation" element={<SystemDocumentation />} />
        <Route path="/IntegrationGuide" element={<IntegrationGuide />} />
        <Route path="/SecurityDashboard" element={<SecurityDashboard />} />
        <Route path="/CredentialSystemGuide" element={<CredentialSystemGuide />} />
        <Route path="/SystemAuditDashboard" element={<SystemAuditDashboard />} />
        <Route path="/AuditSummaryReport" element={<AuditSummaryReport />} />
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
  )
}

export default App