import React from 'react';
import { motion } from 'framer-motion';

/**
 * HolographicMetric
 * 
 * Renders a glowing metric card with:
 * - Holographic shimmer effect
 * - Cyber-glow borders
 * - Rotating orbital rings (optional)
 * - Data pulse animation
 */
export default function HolographicMetric({
  label,
  value,
  suffix = '',
  icon: Icon,
  color = 'cyan',
  trend,
  trendLabel,
  orbital = false,
  children
}) {
  const colorMap = {
    cyan: { glow: 'rgba(0, 232, 255, 0.5)', border: 'rgba(0, 232, 255, 0.4)', text: '#00e8ff' },
    magenta: { glow: 'rgba(255, 46, 196, 0.5)', border: 'rgba(255, 46, 196, 0.4)', text: '#ff2ec4' },
    gold: { glow: 'rgba(249, 214, 92, 0.6)', border: 'rgba(249, 214, 92, 0.4)', text: '#f9d65c' },
    violet: { glow: 'rgba(181, 55, 242, 0.5)', border: 'rgba(181, 55, 242, 0.4)', text: '#b537f2' },
    teal: { glow: 'rgba(0, 255, 217, 0.5)', border: 'rgba(0, 255, 217, 0.4)', text: '#00ffd9' },
  };

  const c = colorMap[color] || colorMap.cyan;

  return (
    <motion.div
      className="relative glass-card rounded-xl p-6 overflow-hidden group"
      style={{
        border: `1.5px solid ${c.border}`,
        boxShadow: `0 0 20px ${c.glow}, inset 0 0 20px rgba(255, 46, 196, 0.05)`,
      }}
      whileHover={{
        boxShadow: `0 0 30px ${c.glow}, inset 0 0 30px rgba(255, 46, 196, 0.1)`,
        y: -4,
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Holographic shimmer */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(135deg, transparent 0%, ${c.glow} 50%, transparent 100%)`,
          transform: 'translateX(-100%)',
        }}
        animate={{ transform: 'translateX(100%)' }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Orbital rings (optional) */}
      {orbital && (
        <>
          <motion.div
            className="absolute inset-2 rounded-full border border-current opacity-20"
            style={{ color: c.text }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-4 rounded-full border border-current opacity-10"
            style={{ color: c.text }}
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          />
        </>
      )}

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-2 font-mono">
            {label}
          </p>
          
          <div className="flex items-baseline gap-2">
            <motion.div
              animate={{ textShadow: [
                `0 0 10px ${c.glow}`,
                `0 0 20px ${c.glow}`,
                `0 0 10px ${c.glow}`,
              ]}}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-3xl font-bold font-orbitron"
              style={{ color: c.text }}
            >
              {value}
            </motion.div>
            {suffix && (
              <span className="text-lg font-mono" style={{ color: c.text }}>
                {suffix}
              </span>
            )}
          </div>

          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-xs font-mono" style={{ color: trend.positive ? '#10b981' : '#ef4444' }}>
                {trend.positive ? '↑' : '↓'} {trendLabel}
              </span>
            </div>
          )}
        </div>

        {Icon && (
          <motion.div
            animate={{ rotate: orbital ? 360 : 0, scale: [1, 1.1, 1] }}
            transition={{
              rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
              scale: { duration: 2, repeat: Infinity },
            }}
            className="shrink-0 ml-4 p-3 rounded-lg"
            style={{
              background: `${c.glow.replace('0.5', '0.15')}`,
              border: `1px solid ${c.border}`,
            }}
          >
            <Icon className="w-6 h-6" style={{ color: c.text }} />
          </motion.div>
        )}
      </div>

      {children && (
        <div className="relative z-10 mt-4 pt-4 border-t" style={{ borderColor: c.border }}>
          {children}
        </div>
      )}
    </motion.div>
  );
}