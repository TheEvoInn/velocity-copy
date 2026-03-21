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
import AutoPilot from './pages/AutoPilot';
import Discovery from './pages/Discovery';
import Execution from './pages/Execution.jsx';
import Finance from './pages/Finance';
import Control from './pages/Control';
import IdentityManager from './pages/IdentityManager';
import KYCManagement from './pages/KYCManagement';
import Chat from './pages/Chat';
import ActivityPage from './pages/ActivityPage';
import AdminControlPanel from './pages/AdminControlPanel';
import CryptoAutomation from './pages/CryptoAutomation';
import WebhookEngine from './pages/WebhookEngine';
import AppLayout from './components/layout/AppLayout.jsx';

const PAGES = {
	Dashboard,
	AutoPilot,
	Discovery,
	Execution,
	Finance,
	Control,
	IdentityManager,
	KYCManagement,
	Chat,
	ActivityPage,
	AdminControlPanel,
	CryptoAutomation,
	WebhookEngine
};

export const pagesConfig = {
	mainPage: 'Dashboard',
	Pages: PAGES,
	Layout: AppLayout
};