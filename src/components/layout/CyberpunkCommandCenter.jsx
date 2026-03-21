import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CyberpunkCommandCenter
 * 
 * Immersive 3D Galaxy-Cyberpunk wrapper that:
 * - Renders a parallax starfield with dynamic nebula
 * - Applies global glassmorphic styling
 * - Creates a "command center" cockpit feel
 * - Manages page transitions with warp effects
 */
export default function CyberpunkCommandCenter({ children }) {
  const [stars, setStars] = useState([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Generate parallax stars
  useEffect(() => {
    const generatedStars = Array.from({ length: 150 }, () => ({
      id: Math.random(),
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.7 + 0.3,
      depth: Math.random() * 3 + 1, // parallax depth
      duration: Math.random() * 30 + 40,
      delay: Math.random() * 10,
    }));
    setStars(generatedStars);
  }, []);

  // Monitor route changes for transition effects
  useEffect(() => {
    const handleNavigation = () => {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 600);
      return () => clearTimeout(timer);
    };

    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-black">
      {/* Deep Space Background */}
      <div className="fixed inset-0 galaxy-bg pointer-events-none z-0" />

      {/* Parallax Starfield with Cosmic Depth */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        {stars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute rounded-full"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: ['#dde6f2', '#00e8ff', '#ff2ec4', '#f9d65c'][Math.floor(Math.random() * 4)],
              opacity: star.opacity,
              boxShadow: `0 0 ${star.size * 2}px currentColor`,
            }}
            animate={{
              y: [0, -20 * star.depth, 0],
              x: [0, 10 * star.depth, 0],
              opacity: [star.opacity, star.opacity * 0.5, star.opacity],
            }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Cosmic Nebula Layers */}
      <div className="fixed inset-0 pointer-events-none z-[2]">
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 120% 80% at 15% 20%, rgba(58,26,95,0.2) 0%, transparent 50%)',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
          }}
          transition={{ duration: 45, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 90% 60% at 85% 30%, rgba(0,232,255,0.1) 0%, transparent 50%)',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '-100% 100%', '0% 0%'],
          }}
          transition={{ duration: 60, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content Wrapper with Warp Transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key="content"
          className="relative z-10 w-full min-h-screen"
          initial={isTransitioning ? { opacity: 0, filter: 'blur(20px)', scale: 1.1 } : { opacity: 1 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          exit={isTransitioning ? { opacity: 0, filter: 'blur(20px)', scale: 0.9 } : {}}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Scanlines Overlay (subtle CRT effect) */}
      <div
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,232,255,0.02) 0px, rgba(0,232,255,0.02) 1px, transparent 1px, transparent 2px)',
        }}
      />

      {/* Holographic Grid Lines (optional accent) */}
      <div className="fixed inset-0 pointer-events-none z-[1]" style={{
        backgroundImage: `
          linear-gradient(90deg, rgba(0,232,255,0.03) 1px, transparent 1px),
          linear-gradient(0deg, rgba(0,232,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px',
      }} />
    </div>
  );
}