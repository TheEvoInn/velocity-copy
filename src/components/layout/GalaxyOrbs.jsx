/**
 * Decorative floating nebula orbs and geometric cosmic elements.
 * Pure CSS animations — zero JS overhead.
 */
export default function GalaxyOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Nebula orb 1 — violet, top-left */}
      <div
        className="absolute rounded-full nebula-drift"
        style={{
          width: 600, height: 600,
          top: '-200px', left: '-150px',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, rgba(99,102,241,0.06) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Nebula orb 2 — cyan, top-right */}
      <div
        className="absolute rounded-full nebula-drift-slow"
        style={{
          width: 500, height: 500,
          top: '-100px', right: '-100px',
          background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, rgba(37,99,235,0.05) 40%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      {/* Nebula orb 3 — purple, center-left */}
      <div
        className="absolute rounded-full nebula-drift"
        style={{
          width: 400, height: 400,
          top: '40%', left: '-80px',
          background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animationDelay: '-10s',
        }}
      />
      {/* Nebula orb 4 — blue, bottom-right */}
      <div
        className="absolute rounded-full nebula-drift-slow"
        style={{
          width: 700, height: 700,
          bottom: '-200px', right: '-150px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.09) 0%, rgba(124,58,237,0.05) 40%, transparent 70%)',
          filter: 'blur(70px)',
          animationDelay: '-20s',
        }}
      />

      {/* Floating geometric rings */}
      <div
        className="absolute border rounded-full float-anim-slow"
        style={{
          width: 300, height: 300,
          top: '15%', right: '8%',
          borderColor: 'rgba(124,58,237,0.08)',
          animationDelay: '-3s',
        }}
      />
      <div
        className="absolute border rounded-full float-anim"
        style={{
          width: 180, height: 180,
          top: '18%', right: '11%',
          borderColor: 'rgba(6,182,212,0.12)',
          animationDelay: '-1.5s',
        }}
      />

      {/* Corner accent dots */}
      <div className="absolute top-32 right-1/4 w-1 h-1 rounded-full bg-violet-400 star-twinkle" style={{ animationDelay: '0.5s' }} />
      <div className="absolute top-48 right-1/3 w-0.5 h-0.5 rounded-full bg-cyan-400 star-twinkle-fast" style={{ animationDelay: '1.2s' }} />
      <div className="absolute top-24 left-1/3 w-1.5 h-1.5 rounded-full bg-purple-400 star-twinkle-slow" />
      <div className="absolute bottom-40 left-1/4 w-1 h-1 rounded-full bg-blue-400 star-twinkle" style={{ animationDelay: '2s' }} />
    </div>
  );
}