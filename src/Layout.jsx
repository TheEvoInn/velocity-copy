/**
 * Layout.jsx — Thin passthrough wrapper
 *
 * This file exists because pages.config.js references it as the Layout wrapper
 * and Base44's internal routing system may use it. Instead of creating a competing
 * AuthContext (which caused "useAuth must be used inside Layout" errors),
 * this now re-exports useAuth from the REAL provider (@/lib/AuthContext).
 *
 * Any file that imports { useAuth } from '@/Layout' will now get the real
 * AuthContext — the one actually mounted by App.jsx → AuthProvider.
 */
import React from 'react';

// Bridge: re-export useAuth from the real auth provider
export { useAuth } from '@/lib/AuthContext';

// Thin wrapper — if Base44 wraps pages in this Layout, it just passes through.
// No competing AuthContext, no duplicate sidebar, no conflicting state.
export default function Layout({ children }) {
  return <>{children}</>;
}
