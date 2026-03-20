import { useEffect, useRef } from 'react';

/**
 * Animated starfield background using Canvas2D (GPU-accelerated, lightweight).
 * No Three.js needed — smooth 60fps with minimal CPU impact.
 */
export default function StarfieldCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animId;
    let W = window.innerWidth;
    let H = window.innerHeight;

    canvas.width = W;
    canvas.height = H;

    // Star layers for parallax depth
    const layers = [
      { count: 180, speed: 0.008, size: [0.5, 1.2], opacity: [0.3, 0.7] },
      { count: 80,  speed: 0.015, size: [1.0, 2.0], opacity: [0.5, 0.9] },
      { count: 30,  speed: 0.025, size: [1.5, 3.0], opacity: [0.6, 1.0] },
    ];

    const stars = [];

    function randomStar(layer) {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        size: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
        opacity: layer.opacity[0] + Math.random() * (layer.opacity[1] - layer.opacity[0]),
        twinkleSpeed: 0.005 + Math.random() * 0.015,
        twinkleOffset: Math.random() * Math.PI * 2,
        speed: layer.speed * (0.7 + Math.random() * 0.6),
        color: Math.random() > 0.85 ? (Math.random() > 0.5 ? '#a78bfa' : '#67e8f9') : '#ffffff',
      };
    }

    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        stars.push({ ...randomStar(layer), layer });
      }
    });

    // Shooting stars
    const shootingStars = [];
    function spawnShootingStar() {
      shootingStars.push({
        x: Math.random() * W * 0.7,
        y: Math.random() * H * 0.4,
        vx: 4 + Math.random() * 4,
        vy: 2 + Math.random() * 2,
        length: 80 + Math.random() * 120,
        opacity: 1,
        life: 0,
        maxLife: 60 + Math.random() * 40,
      });
    }
    let shootingStarTimer = 0;

    // Nebula blobs
    const nebulas = [
      { x: W * 0.15, y: H * 0.25, r: 300, color: 'rgba(124,58,237,', alpha: 0.06 },
      { x: W * 0.80, y: H * 0.15, r: 250, color: 'rgba(6,182,212,',   alpha: 0.05 },
      { x: W * 0.55, y: H * 0.75, r: 350, color: 'rgba(37,99,235,',   alpha: 0.06 },
      { x: W * 0.90, y: H * 0.65, r: 200, color: 'rgba(168,85,247,',  alpha: 0.05 },
    ];

    let t = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Deep space base
      ctx.fillStyle = '#050714';
      ctx.fillRect(0, 0, W, H);

      // Nebula blobs
      nebulas.forEach((n, i) => {
        const drift = Math.sin(t * 0.0003 + i) * 40;
        const grad = ctx.createRadialGradient(n.x + drift, n.y, 0, n.x + drift, n.y, n.r);
        grad.addColorStop(0, `${n.color}${n.alpha * 1.5})`);
        grad.addColorStop(0.5, `${n.color}${n.alpha})`);
        grad.addColorStop(1, `${n.color}0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      });

      // Stars
      t++;
      stars.forEach(s => {
        const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset);
        const alpha = s.opacity * (0.6 + 0.4 * twinkle);

        // Star glow
        if (s.size > 1.5) {
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 3);
          grad.addColorStop(0, s.color === '#ffffff' ? `rgba(255,255,255,${alpha * 0.4})` : s.color.replace(')', `,${alpha * 0.3})`).replace('#', 'rgba('));
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = s.color === '#ffffff'
          ? `rgba(255,255,255,${alpha})`
          : s.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Slow drift (parallax)
        s.y += s.speed;
        if (s.y > H + 10) { s.y = -10; s.x = Math.random() * W; }
      });

      // Shooting stars
      shootingStarTimer++;
      if (shootingStarTimer > 180 + Math.random() * 200) {
        spawnShootingStar();
        shootingStarTimer = 0;
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.life++;
        const progress = ss.life / ss.maxLife;
        ss.opacity = progress < 0.2 ? progress / 0.2 : progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

        const grad = ctx.createLinearGradient(
          ss.x, ss.y,
          ss.x - ss.vx * (ss.length / 6), ss.y - ss.vy * (ss.length / 6)
        );
        grad.addColorStop(0, `rgba(255,255,255,${ss.opacity})`);
        grad.addColorStop(0.3, `rgba(167,139,250,${ss.opacity * 0.6})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - ss.vx * (ss.length / 6), ss.y - ss.vy * (ss.length / 6));
        ctx.stroke();

        ss.x += ss.vx;
        ss.y += ss.vy;

        if (ss.life >= ss.maxLife || ss.x > W + 100 || ss.y > H + 100) {
          shootingStars.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.85 }}
    />
  );
}