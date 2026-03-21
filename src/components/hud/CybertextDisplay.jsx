import React from 'react';
import { motion } from 'framer-motion';

/**
 * CybertextDisplay
 * 
 * High-impact text rendering with:
 * - Cyber-glow effects
 * - Holographic shimmer
 * - Impact animations
 */
export default function CybertextDisplay({
  text,
  variant = 'h1', // h1, h2, h3, subtitle, label
  glow = 'cyan',
  animate = true,
  className = '',
}) {
  const glowMap = {
    cyan: { color: '#00e8ff', shadow: '0 0 20px rgba(0, 232, 255, 0.8)' },
    magenta: { color: '#ff2ec4', shadow: '0 0 20px rgba(255, 46, 196, 0.8)' },
    gold: { color: '#f9d65c', shadow: '0 0 20px rgba(249, 214, 92, 0.8)' },
    violet: { color: '#b537f2', shadow: '0 0 20px rgba(181, 55, 242, 0.8)' },
  };

  const g = glowMap[glow] || glowMap.cyan;

  const variants = {
    h1: 'text-4xl md:text-5xl font-orbitron font-bold tracking-wider',
    h2: 'text-2xl md:text-3xl font-orbitron font-bold tracking-wide',
    h3: 'text-xl md:text-2xl font-orbitron font-semibold tracking-wide',
    subtitle: 'text-lg md:text-xl font-inter font-light tracking-normal',
    label: 'text-sm uppercase font-mono tracking-widest',
  };

  const Comp = variant.startsWith('h') ? variant : 'div';

  return (
    <motion.div
      className={`${variants[variant]} ${className}`}
      style={{ color: g.color }}
      animate={animate ? {
        textShadow: [
          g.shadow,
          `0 0 30px ${g.color}80`,
          g.shadow,
        ],
      } : {}}
      transition={animate ? { duration: 2, repeat: Infinity } : {}}
    >
      {text}
    </motion.div>
  );
}