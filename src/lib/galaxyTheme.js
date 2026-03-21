/**
 * GALAXY THEME TOKENS
 * Unified design system for all pages
 */

export const galaxyColors = {
  // Deep space
  background: '#050714',
  card: '#0f1535',
  dark: '#0a0e21',
  
  // Nebula
  violet: '#7c3aed',
  purple: '#9333ea',
  blue: '#2563eb',
  cyan: '#06b6d4',
  
  // Stars
  amber: '#f59e0b',
  emerald: '#10b981',
  pink: '#ec4899',
  
  // Department colors
  discovery: '#f59e0b',   // amber
  execution: '#3b82f6',   // blue
  finance: '#10b981',     // emerald
  control: '#a855f7',     // purple
  vipz: '#ec4899',        // pink
  ned: '#06b6d4',         // cyan
  resellers: '#f97316',   // orange
  crypto: '#06b6d4',      // cyan
};

export const glassStyles = {
  card: {
    background: 'rgba(15, 21, 53, 0.7)',
    border: '1px solid rgba(124, 58, 237, 0.2)',
    backdropFilter: 'blur(20px)',
  },
  cardBright: {
    background: 'rgba(15, 21, 53, 0.85)',
    border: '1px solid rgba(124, 58, 237, 0.35)',
    backdropFilter: 'blur(24px)',
  },
  nav: {
    background: 'rgba(5, 7, 20, 0.9)',
    border: '1px solid rgba(124, 58, 237, 0.2)',
    backdropFilter: 'blur(32px)',
  },
};

export const glowEffects = {
  violet: '0 0 20px rgba(124,58,237,0.4), 0 0 40px rgba(124,58,237,0.15)',
  cyan: '0 0 20px rgba(6,182,212,0.4), 0 0 40px rgba(6,182,212,0.15)',
  emerald: '0 0 20px rgba(16,185,129,0.4), 0 0 40px rgba(16,185,129,0.15)',
  amber: '0 0 20px rgba(245,158,11,0.4), 0 0 40px rgba(245,158,11,0.15)',
  blue: '0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(59,130,246,0.15)',
};

export const deptStyles = {
  discovery: { color: galaxyColors.discovery, glow: glowEffects.amber, icon: '🔍' },
  execution: { color: galaxyColors.execution, glow: glowEffects.blue, icon: '⚡' },
  finance: { color: galaxyColors.finance, glow: glowEffects.emerald, icon: '💰' },
  control: { color: galaxyColors.control, glow: glowEffects.violet, icon: '⚙️' },
  vipz: { color: galaxyColors.vipz, glow: glowEffects.pink, icon: '🎯' },
  ned: { color: galaxyColors.ned, glow: glowEffects.cyan, icon: '🤖' },
};

export function getDeptStyle(dept) {
  return deptStyles[dept] || deptStyles.discovery;
}