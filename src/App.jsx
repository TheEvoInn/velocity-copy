import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';

// Page imports
import Dashboard from './pages/Dashboard';
import StarshipBridge from './pages/StarshipBridge';
import Control from './pages/Control';
import UnifiedAutopilot from './pages/UnifiedAutopilot';
import Discovery from './pages/Discovery';
import WorkDiscovery from './pages/WorkDiscovery';
import ProactiveScout from './pages/ProactiveScout';
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
import UserAccessPage from './pages/UserAccessPage';
import WorkflowBuilder from './pages/WorkflowBuilder';
import BankSettings from './pages/BankSettings';
import AutomationManager from './pages/AutomationManager';
import APIManagement from './pages/APIManagement';
import APIDiscoveryDashboard from './pages/APIDiscoveryDashboard';
import APIDetailPage from './pages/APIDetailPage';
import ComplianceDashboard from './pages/ComplianceDashboard';
import OptimizationDashboard from './pages/OptimizationDashboard';
import PendingInterventions from './pages/PendingInterventions';
import Onboarding from './pages/Onboarding';
import AccountCreationDashboard from './pages/AccountCreationDashboard';
import VeloIdentityHub from './pages/VeloIdentityHub';
import VeloAutopilotControl from './pages/VeloAutopilotControl';
import VeloFinanceCommand from './pages/VeloFinanceCommand';
import VeloExecutionEngine from './pages/VeloExecutionEngine';
import StrategySetupWizard from './pages/StrategySetupWizard';


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
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/StarshipBridge" element={<StarshipBridge />} />
        <Route path="/Control" element={<Control />} />
        <Route path="/AutoPilot" element={<UnifiedAutopilot />} />
        <Route path="/Execution" element={<UnifiedAutopilot />} />
        <Route path="/Discovery" element={<Discovery />} />
        <Route path="/ProactiveScout" element={<ProactiveScout />} />
        <Route path="/WorkDiscovery" element={<WorkDiscovery />} />
        <Route path="/Finance" element={<WalletDashboard />} />
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
        <Route path="/UserAccessPage" element={<UserAccessPage />} />
        <Route path="/WorkflowBuilder" element={<WorkflowBuilder />} />
        <Route path="/BankSettings" element={<BankSettings />} />
        <Route path="/AutomationManager" element={<AutomationManager />} />
        <Route path="/APIManagement" element={<APIManagement />} />
        <Route path="/APIDiscoveryDashboard" element={<APIDiscoveryDashboard />} />
        <Route path="/APIDetailPage" element={<APIDetailPage />} />
        <Route path="/ComplianceDashboard" element={<ComplianceDashboard />} />
        <Route path="/OptimizationDashboard" element={<OptimizationDashboard />} />
        <Route path="/PendingInterventions" element={<PendingInterventions />} />
        <Route path="/Onboarding" element={<Onboarding />} />
        <Route path="/AccountCreationDashboard" element={<AccountCreationDashboard />} />
        <Route path="/VeloIdentityHub" element={<VeloIdentityHub />} />
        <Route path="/VeloAutopilotControl" element={<VeloAutopilotControl />} />
        <Route path="/VeloFinanceCommand" element={<VeloFinanceCommand />} />
        <Route path="/VeloExecutionEngine" element={<VeloExecutionEngine />} />
        <Route path="/StrategySetupWizard" element={<StrategySetupWizard />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClientInstance}>
        <AuthProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App