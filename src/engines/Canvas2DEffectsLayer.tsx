import { useEffect, useRef } from 'react';
import type { VisualEffectType } from '../shared/types';
import type { ActiveEffectInstance } from '../store/useLiveStore';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  kind: 'spark' | 'confetti' | 'coin' | 'ember' | 'heart' | 'petal' | 'star';
  rotation: number;
  vRot: number;
  flip: number;
  vFlip: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  lineWidth: number;
  speed: number;
}

interface LightningBolt {
  points: Array<{ x: number; y: number }>;
  branches: Array<Array<{ x: number; y: number }>>;
  color: string;
  life: number;
  maxLife: number;
}

interface BeamBurst {
  x: number;
  y: number;
  color: string;
  secondaryColor: string;
  angleOffset: number;
  life: number;
  maxLife: number;
  rayCount: number;
  cinematic: boolean;
}

interface Props {
  activeEffects: ActiveEffectInstance[];
  performanceMode: boolean;
}

function getAnchor(pos: string, w: number, h: number): { x: number; y: number } {
  switch (pos) {
    case 'top':
      return { x: w * 0.5, y: h * 0.22 };
    case 'bottom':
      return { x: w * 0.5, y: h * 0.78 };
    case 'top-left':
      return { x: w * 0.25, y: h * 0.25 };
    case 'top-right':
      return { x: w * 0.75, y: h * 0.25 };
    case 'bottom-left':
      return { x: w * 0.25, y: h * 0.75 };
    case 'bottom-right':
      return { x: w * 0.75, y: h * 0.75 };
    default:
      return { x: w * 0.5, y: h * 0.48 };
  }
}

function buildLightningPoints(x1: number, y1: number, x2: number, y2: number, jitter: number) {
  const pts: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
  const steps = 11;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    pts.push({
      x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter,
      y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter * 0.65,
    });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}

export function Canvas2DEffectsLayer({ activeEffects, performanceMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const wavesRef = useRef<Shockwave[]>([]);
  const boltsRef = useRef<LightningBolt[]>([]);
  const beamsRef = useRef<BeamBurst[]>([]);
  const spawnedIdsRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const startLoop = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        runningRef.current = false;
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        runningRef.current = false;
        return;
      }

      const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
      lastTime = now;

      const dpr = Math.min(window.devicePixelRatio || 1, performanceMode ? 1 : 1.75);
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      ctx.clearRect(0, 0, w, h);

      // 1. Beams / Golden Light / Cinematic Background Sweeps
      const beams = beamsRef.current;
      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.life += dt;
        b.angleOffset += dt * (b.cinematic ? 0.25 : 0.65);
        if (b.life >= b.maxLife) {
          beams.splice(i, 1);
          continue;
        }
        if (b.life < 0) continue;
        const progress = Math.max(0, Math.min(1, b.life / b.maxLife));
        const fade = Math.max(0, progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        if (b.cinematic) {
          // Dramatic volumetric cinema shafts from top edges
          const outerR = Math.max(20, Math.max(w, h) * 0.72);
          const grad = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, outerR);
          grad.addColorStop(0, `${b.color}44`);
          grad.addColorStop(0.45, `${b.secondaryColor}22`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = fade * 0.85;
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }

        ctx.translate(b.x, b.y);
        ctx.rotate(b.angleOffset);
        const rayLen = Math.max(20, Math.max(w, h) * 0.75);
        for (let r = 0; r < b.rayCount; r++) {
          const angle = (r / b.rayCount) * Math.PI * 2;
          ctx.save();
          ctx.rotate(angle);
          const g = ctx.createLinearGradient(0, 0, rayLen, 0);
          g.addColorStop(0, `${b.color}`);
          g.addColorStop(0.35, `${b.secondaryColor}66`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.globalAlpha = fade * (b.cinematic ? 0.22 : 0.36);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(rayLen, -rayLen * 0.065);
          ctx.lineTo(rayLen, rayLen * 0.065);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Core bloom flash
        const coreR = Math.max(4, (1 - progress * 0.4) * Math.min(w, h) * 0.24);
        const coreGrad = ctx.createRadialGradient(0, 0, Math.min(2, coreR * 0.2), 0, 0, coreR);
        coreGrad.addColorStop(0, '#FFFFFF');
        coreGrad.addColorStop(0.35, b.color);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = fade * 0.7;
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Shockwaves & Neon Rings
      const waves = wavesRef.current;
      for (let i = waves.length - 1; i >= 0; i--) {
        const sw = waves[i];
        sw.radius = Math.max(0.5, sw.radius + sw.speed * dt);
        const p = sw.maxRadius > 0 ? sw.radius / sw.maxRadius : 1;
        if (p >= 1) {
          waves.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = Math.max(0, (1 - p) * sw.alpha);
        ctx.lineWidth = Math.max(1, sw.lineWidth * (1 - p * 0.65));
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = performanceMode ? 0 : 18;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, Math.max(0.5, sw.radius), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Branching Lightning Bolts
      const bolts = boltsRef.current;
      for (let i = bolts.length - 1; i >= 0; i--) {
        const bolt = bolts[i];
        bolt.life += dt;
        if (bolt.life >= bolt.maxLife) {
          bolts.splice(i, 1);
          continue;
        }
        if (bolt.life < 0) continue;
        const a = Math.max(0, 1 - bolt.life / bolt.maxLife);
        const drawPath = (pts: Array<{ x: number; y: number }>, width: number, alpha: number) => {
          ctx.beginPath();
          pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
          ctx.strokeStyle = bolt.color;
          ctx.globalAlpha = alpha * 0.55;
          ctx.lineWidth = width * 3.2;
          ctx.stroke();
          ctx.strokeStyle = '#FFFFFF';
          ctx.globalAlpha = alpha;
          ctx.lineWidth = width;
          ctx.stroke();
        };
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawPath(bolt.points, 2.8, a);
        for (const br of bolt.branches) drawPath(br, 1.4, a * 0.8);
        ctx.restore();
      }

      // 4. Particles (Sparks, Coins, Confetti, Embers, Hearts, Petals, Stars)
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        if (p.life < 0) continue;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.vRot * dt;
        p.flip += p.vFlip * dt;

        const ratio = Math.max(0, Math.min(1, p.life / p.maxLife));
        const alpha = (ratio < 0.1 ? ratio / 0.1 : 1 - (ratio - 0.1) / 0.9) * p.alpha;
        if (alpha <= 0.01) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;

        if (p.kind === 'coin') {
          const sx = Math.max(0.18, Math.abs(Math.cos(p.flip)));
          ctx.scale(sx, 1);
          const g = ctx.createRadialGradient(-p.size * 0.25, -p.size * 0.25, 1, 0, 0, p.size);
          g.addColorStop(0, '#FFF7CC');
          g.addColorStop(0.45, '#FFD700');
          g.addColorStop(1, '#B45309');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FEF08A';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.fillStyle = '#92400E';
          ctx.font = `700 ${Math.round(p.size * 0.95)}px Outfit, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', 0, 1);
        } else if (p.kind === 'confetti') {
          const sx = Math.cos(p.flip);
          ctx.scale(1, Math.max(0.25, Math.abs(sx)));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size * 0.8, -p.size * 0.4, p.size * 1.6, p.size * 0.8);
        } else if (p.kind === 'heart') {
          const s = p.size * 0.6;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, s * 0.4);
          ctx.bezierCurveTo(s * 1.2, -s * 0.7, s * 1.8, s * 0.8, 0, s * 1.9);
          ctx.bezierCurveTo(-s * 1.8, s * 0.8, -s * 1.2, -s * 0.7, 0, s * 0.4);
          ctx.fill();
        } else if (p.kind === 'petal') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.9, p.size * 0.48, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'ember') {
          ctx.globalCompositeOperation = 'lighter';
          const eg = ctx.createRadialGradient(0, 0, 0.5, 0, 0, p.size * 2.1);
          eg.addColorStop(0, '#FFF7ED');
          eg.addColorStop(0.35, p.color);
          eg.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = eg;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 2.1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      ctx.restore();

      // Auto-pause loop when idle (0% CPU!)
      if (
        particles.length > 0 ||
        waves.length > 0 ||
        bolts.length > 0 ||
        beams.length > 0
      ) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        runningRef.current = false;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(frame);
  };

  // Spawn physics systems whenever a new active effect arrives
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width);
    const h = Math.max(240, rect.height);
    const density = performanceMode ? 0.45 : 1;

    const triggerVisual = (
      effectType: VisualEffectType,
      anchor: { x: number; y: number },
      c1: string,
      c2: string,
      scale: number,
      giftName: string
    ) => {
      const particles = particlesRef.current;
      const waves = wavesRef.current;
      const bolts = boltsRef.current;
      const beams = beamsRef.current;

      const isHeartGift = /heart|love|قلب/i.test(giftName);
      const isRoseGift = /rose|ورد/i.test(giftName);

      switch (effectType) {
        case 'particle_explosion': {
          const count = Math.round(75 * density * scale);
          for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = (110 + Math.random() * 440) * scale;
            particles.push({
              x: anchor.x,
              y: anchor.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - (isHeartGift ? 80 : 0),
              size: (isHeartGift || isRoseGift ? 7 : 3) + Math.random() * 5,
              color: i % 2 === 0 ? c1 : c2,
              alpha: 1,
              life: 0,
              maxLife: 1.3 + Math.random() * 1.1,
              gravity: isRoseGift ? 75 : isHeartGift ? -45 : 180,
              drag: 0.96,
              kind: isHeartGift ? 'heart' : isRoseGift ? 'petal' : 'spark',
              rotation: Math.random() * Math.PI * 2,
              vRot: (Math.random() - 0.5) * 6,
              flip: 0,
              vFlip: 4,
            });
          }
          break;
        }

        case 'golden_light': {
          beams.push({
            x: anchor.x,
            y: anchor.y,
            color: '#FFD700',
            secondaryColor: c1 || '#FFA500',
            angleOffset: 0,
            life: 0,
            maxLife: 2.8,
            rayCount: performanceMode ? 8 : 14,
            cinematic: false,
          });
          waves.push({
            x: anchor.x,
            y: anchor.y,
            radius: 16,
            maxRadius: Math.min(w, h) * 0.62 * scale,
            color: '#FFD700',
            alpha: 0.95,
            lineWidth: 6,
            speed: 440,
          });
          const count = Math.round(65 * density);
          for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 80 + Math.random() * 340;
            particles.push({
              x: anchor.x,
              y: anchor.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - 60,
              size: 2.5 + Math.random() * 4.5,
              color: i % 3 === 0 ? '#FFFFFF' : '#FFD700',
              alpha: 1,
              life: 0,
              maxLife: 1.6 + Math.random() * 1.2,
              gravity: -35,
              drag: 0.97,
              kind: 'ember',
              rotation: 0,
              vRot: 0,
              flip: 0,
              vFlip: 0,
            });
          }
          break;
        }

        case 'lightning': {
          const boltCount = performanceMode ? 3 : 6;
          for (let b = 0; b < boltCount; b++) {
            const sx = w * (0.15 + Math.random() * 0.7);
            const points = buildLightningPoints(sx, 0, anchor.x + (Math.random() - 0.5) * 160, anchor.y + 40, 85);
            const mid = points[Math.floor(points.length * 0.45)];
            const branches = [
              buildLightningPoints(mid.x, mid.y, mid.x + (Math.random() - 0.5) * 200, mid.y + 130, 45),
            ];
            bolts.push({
              points,
              branches,
              color: b % 2 === 0 ? '#00D4FF' : c1 || '#7C3AED',
              life: -b * 0.14,
              maxLife: 0.55,
            });
          }
          waves.push({
            x: anchor.x,
            y: anchor.y,
            radius: 12,
            maxRadius: 340 * scale,
            color: '#00D4FF',
            alpha: 0.9,
            lineWidth: 4,
            speed: 580,
          });
          break;
        }

        case 'fire': {
          const count = Math.round(90 * density);
          for (let i = 0; i < count; i++) {
            particles.push({
              x: anchor.x + (Math.random() - 0.5) * w * 0.55,
              y: h * 0.92 + Math.random() * 40,
              vx: (Math.random() - 0.5) * 120,
              vy: -(220 + Math.random() * 420),
              size: 5 + Math.random() * 11,
              color: i % 3 === 0 ? '#FFD700' : i % 2 === 0 ? '#FF5500' : '#EF4444',
              alpha: 0.95,
              life: 0,
              maxLife: 1.5 + Math.random() * 1.3,
              gravity: -65,
              drag: 0.985,
              kind: 'ember',
              rotation: 0,
              vRot: 0,
              flip: 0,
              vFlip: 0,
            });
          }
          break;
        }

        case 'neon_glow': {
          const colors = [c1 || '#00D4FF', c2 || '#FF0050', '#7C3AED'];
          colors.forEach((col, idx) => {
            waves.push({
              x: anchor.x,
              y: anchor.y,
              radius: 20 + idx * 24,
              maxRadius: Math.min(w, h) * (0.48 + idx * 0.08) * scale,
              color: col,
              alpha: 0.95,
              lineWidth: 5 - idx,
              speed: 320 + idx * 70,
            });
          });
          break;
        }

        case 'energy_waves': {
          for (let k = 0; k < 4; k++) {
            waves.push({
              x: anchor.x,
              y: anchor.y,
              radius: 8 + k * 28,
              maxRadius: Math.max(w, h) * 0.58 * scale,
              color: k % 2 === 0 ? c1 : c2,
              alpha: 0.9,
              lineWidth: 7 - k * 1.2,
              speed: 380 + k * 55,
            });
          }
          break;
        }

        case 'cinematic_bg': {
          beams.push({
            x: anchor.x,
            y: h * 0.15,
            color: c1 || '#7C3AED',
            secondaryColor: c2 || '#00D4FF',
            angleOffset: 0.3,
            life: 0,
            maxLife: 3.6,
            rayCount: performanceMode ? 6 : 10,
            cinematic: true,
          });
          break;
        }

        case 'flying_coins': {
          const count = Math.round(52 * density);
          for (let i = 0; i < count; i++) {
            const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.45;
            const spd = 340 + Math.random() * 440;
            particles.push({
              x: anchor.x + (Math.random() - 0.5) * 120,
              y: h * 0.85,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              size: 11 + Math.random() * 8,
              color: '#FFD700',
              alpha: 1,
              life: 0,
              maxLife: 2.1 + Math.random() * 1.1,
              gravity: 640,
              drag: 0.992,
              kind: 'coin',
              rotation: (Math.random() - 0.5) * 0.4,
              vRot: (Math.random() - 0.5) * 2.2,
              flip: Math.random() * Math.PI,
              vFlip: 7 + Math.random() * 7,
            });
          }
          break;
        }

        case 'confetti': {
          const palette = ['#7C3AED', '#00D4FF', '#FFD700', '#EC4899', '#10B981', '#F97316'];
          const count = Math.round(95 * density);
          for (let i = 0; i < count; i++) {
            const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
            const spd = 220 + Math.random() * 480;
            particles.push({
              x: anchor.x,
              y: anchor.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - 120,
              size: 6 + Math.random() * 7,
              color: palette[i % palette.length],
              alpha: 1,
              life: 0,
              maxLife: 2.2 + Math.random() * 1.4,
              gravity: 280,
              drag: 0.975,
              kind: 'confetti',
              rotation: Math.random() * Math.PI * 2,
              vRot: (Math.random() - 0.5) * 9,
              flip: Math.random() * Math.PI,
              vFlip: 8 + Math.random() * 6,
            });
          }
          break;
        }

        case 'fireworks': {
          const bursts = performanceMode ? 2 : 4;
          const colors = ['#FFD700', '#00D4FF', '#FF4D8D', '#A855F7'];
          for (let b = 0; b < bursts; b++) {
            const bx = w * (0.2 + Math.random() * 0.6);
            const by = h * (0.2 + Math.random() * 0.35);
            const col = colors[b % colors.length];
            const sparks = Math.round(44 * density);
            for (let s = 0; s < sparks; s++) {
              const ang = (s / sparks) * Math.PI * 2 + Math.random() * 0.1;
              const spd = 120 + Math.random() * 240;
              particles.push({
                x: bx,
                y: by,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                size: 2.5 + Math.random() * 3,
                color: s % 3 === 0 ? '#FFFFFF' : col,
                alpha: 1,
                life: -b * 0.25,
                maxLife: 1.4 + Math.random() * 0.6,
                gravity: 135,
                drag: 0.955,
                kind: 'spark',
                rotation: 0,
                vRot: 0,
                flip: 0,
                vFlip: 0,
              });
            }
          }
          break;
        }

        case 'legendary': {
          triggerVisual('golden_light', anchor, c1, c2, scale, giftName);
          triggerVisual('fire', anchor, c1, c2, scale, giftName);
          triggerVisual('fireworks', anchor, c1, c2, scale, giftName);
          triggerVisual('energy_waves', anchor, c1, c2, scale, giftName);
          break;
        }

        default:
          break;
      }
    };

    let spawnedAny = false;
    for (const item of activeEffects) {
      if (spawnedIdsRef.current.has(item.instanceId)) continue;
      spawnedIdsRef.current.add(item.instanceId);
      if (spawnedIdsRef.current.size > 200) {
        const first = spawnedIdsRef.current.values().next().value;
        if (first) spawnedIdsRef.current.delete(first);
      }

      const anchor = getAnchor(item.config.position, w, h);
      const effectsToRun: VisualEffectType[] = [
        item.config.primaryEffect,
        ...item.config.secondaryEffects,
      ];
      const uniqueEffects = Array.from(new Set(effectsToRun));
      for (const ef of uniqueEffects) {
        triggerVisual(
          ef,
          anchor,
          item.config.primaryColor,
          item.config.secondaryColor,
          item.config.scale,
          item.event.giftName || item.config.giftName
        );
      }
      spawnedAny = true;
    }

    if (spawnedAny) {
      startLoop();
    }
  }, [activeEffects, performanceMode]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 12 }}
    />
  );
}
