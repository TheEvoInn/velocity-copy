/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */

import Dashboard from './pages/Dashboard';
import StarshipBridge from './pages/StarshipBridge';
import Control from './pages/Control';
import VeloAutopilotControl from './pages/VeloAutopilotControl';
import UnifiedAutopilot from './pages/UnifiedAutopilot';
import Discovery from './pages/Discovery';
import WorkDiscovery from './pages/WorkDiscovery';
import VeloExecutionEngine from './pages/VeloExecutionEngine';
import Finance from './pages/Finance';
import WalletDashboard from './pages/WalletDashboard';
import CryptoAutomation from './pages/CryptoAutomation';
import DigitalResellers from './pages/DigitalResellers';
import NED from './pages/NED';
import VIPZ from './pages/VIPZ';
import IdentityManager from './pages/IdentityManager';
import AdminPanel from './pages/AdminPanel';
import Chat from './pages/Chat';
import SystemAuditDashboard from './pages/SystemAuditDashboard';
import VeloIdentityHub from './pages/VeloIdentityHub';
import VeloFinanceCommand from './pages/VeloFinanceCommand';
import PendingInterventions from './pages/PendingInterventions';
import Onboarding from './pages/Onboarding';
import __Layout from './Layout.jsx';

export const PAGES = {
    "Dashboard": Dashboard,
    "StarshipBridge": StarshipBridge,
    "Control": Control,
    "AutoPilot": VeloAutopilotControl,
    "AutoPilotEngine": UnifiedAutopilot,
    "Discovery": Discovery,
    "WorkDiscovery": WorkDiscovery,
    "Execution": VeloExecutionEngine,
    "Finance": Finance,
    "WalletDashboard": WalletDashboard,
    "CryptoAutomation": CryptoAutomation,
    "DigitalResellers": DigitalResellers,
    "NED": NED,
    "VIPZ": VIPZ,
    "IdentityManager": IdentityManager,
    "AdminControlPanel": AdminPanel,
    "Chat": Chat,
    "SystemAuditDashboard": SystemAuditDashboard,
    "VeloAutopilotControl": VeloAutopilotControl,
    "VeloIdentityHub": VeloIdentityHub,
    "VeloFinanceCommand": VeloFinanceCommand,
    "VeloExecutionEngine": VeloExecutionEngine,
    "PendingInterventions": PendingInterventions,
    "Onboarding": Onboarding,
    "AdminPanel": AdminPanel,
    "UnifiedAutopilot": UnifiedAutopilot,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
}


