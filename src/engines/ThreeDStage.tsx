import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ThreeDModelPreset } from '../shared/types';
import type { ActiveEffectInstance } from '../store/useLiveStore';

interface Props {
  activeEffects: ActiveEffectInstance[];
  performanceMode: boolean;
}

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  });
}

/**
 * Builds composite 3-12 part procedural Three.js gift models with studio PBR contrast.
 * Zero external 404 assets — 100% procedural geometry + studio PMREM lighting.
 */
function buildProceduralGiftModel(
  preset: ThreeDModelPreset,
  primaryHex: string,
  secondaryHex: string,
  performanceMode: boolean
): THREE.Group {
  const root = new THREE.Group();
  const c1 = new THREE.Color(primaryHex || '#7C3AED');
  const c2 = new THREE.Color(secondaryHex || '#FFD700');

  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd700,
    metalness: 0.94,
    roughness: 0.16,
    clearcoat: 0.85,
  });

  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: c1,
    metalness: 0.72,
    roughness: 0.22,
    emissive: c1,
    emissiveIntensity: 0.32,
    clearcoat: 0.9,
  });

  const secondaryMat = new THREE.MeshPhysicalMaterial({
    color: c2,
    metalness: 0.45,
    roughness: 0.35,
    emissive: c2,
    emissiveIntensity: 0.45,
  });

  const seg = performanceMode ? 16 : 32;

  switch (preset) {
    case 'lion': {
      // Royal 3D Lion Crest: sculpted mane crown + faceted head + glowing eyes + royal crown + fire halo
      const maneGroup = new THREE.Group();
      const spikeCount = 12;
      const spikeGeo = new THREE.ConeGeometry(0.42, 1.35, 6);
      for (let i = 0; i < spikeCount; i++) {
        const ang = (i / spikeCount) * Math.PI * 2;
        const spike = new THREE.Mesh(spikeGeo, i % 2 === 0 ? goldMat : secondaryMat);
        spike.position.set(Math.cos(ang) * 1.35, Math.sin(ang) * 1.35, -0.15);
        spike.rotation.z = ang - Math.PI / 2;
        maneGroup.add(spike);
      }
      root.add(maneGroup);

      // Primary sculpted lion head
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(1.08, 1), goldMat);
      head.scale.set(1.0, 1.08, 0.85);
      root.add(head);

      // Snout ridge
      const snout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.42, 0.55, 6),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.45 })
      );
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, -0.18, 0.78);
      root.add(snout);

      // Glowing eyes
      const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x00d4ff,
        emissiveIntensity: 2.2,
      });
      const eyeGeo = new THREE.OctahedronGeometry(0.16, 0);
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.38, 0.25, 0.86);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.38, 0.25, 0.86);
      root.add(leftEye, rightEye);

      // Crown atop head
      const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 12, seg), goldMat);
      crownRing.rotation.x = Math.PI / 2;
      crownRing.position.set(0, 1.15, 0);
      root.add(crownRing);

      // Outer fire energy halo
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(2.15, 0.06, 12, seg * 2),
        new THREE.MeshStandardMaterial({
          color: 0xff6b00,
          emissive: 0xff5500,
          emissiveIntensity: 1.5,
          metalness: 0.2,
          roughness: 0.3,
        })
      );
      halo.name = 'orbitRing';
      root.add(halo);
      break;
    }

    case 'universe': {
      // Cosmic Orrery: radiant core star + 3 tilted orbital rings + Saturn planet + star cluster
      const starCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, seg, seg),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffd700,
          emissiveIntensity: 1.6,
          roughness: 0.1,
        })
      );
      root.add(starCore);

      const ringRadii = [1.55, 2.05, 2.55];
      const ringColors = [0x7c3aed, 0x00d4ff, 0xffd700];
      ringRadii.forEach((r, idx) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.045, 12, seg * 2),
          new THREE.MeshStandardMaterial({
            color: ringColors[idx],
            emissive: ringColors[idx],
            emissiveIntensity: 1.1,
            metalness: 0.7,
            roughness: 0.2,
          })
        );
        ring.rotation.set(0.5 + idx * 0.55, idx * 0.7, idx * 0.3);
        ring.name = `orbitRing_${idx}`;
        // Orbiting planet on each ring
        const planet = new THREE.Mesh(
          new THREE.SphereGeometry(0.22 - idx * 0.03, 18, 18),
          idx === 0 ? primaryMat : idx === 1 ? secondaryMat : goldMat
        );
        planet.position.set(r, 0, 0);
        ring.add(planet);
        root.add(ring);
      });

      // Star cloud
      const starCount = performanceMode ? 240 : 650;
      const positions = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);
      const palette = [new THREE.Color('#FFD700'), new THREE.Color('#00D4FF'), new THREE.Color('#A855F7')];
      for (let i = 0; i < starCount; i++) {
        const rad = 1.1 + Math.random() * 2.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta) * 0.65;
        positions[i * 3 + 2] = rad * Math.cos(phi);
        const col = palette[i % palette.length];
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const stars = new THREE.Points(
        pGeo,
        new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.92 })
      );
      stars.name = 'starCloud';
      root.add(stars);
      break;
    }

    case 'galaxy': {
      // Spiral 3D Galaxy Vortex
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, seg, seg),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0x7c3aed,
          emissiveIntensity: 1.8,
          roughness: 0.15,
        })
      );
      root.add(core);

      const disk = new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.07, 12, seg * 2),
        new THREE.MeshStandardMaterial({
          color: 0x00d4ff,
          emissive: 0x00d4ff,
          emissiveIntensity: 1.3,
        })
      );
      disk.rotation.x = Math.PI * 0.38;
      disk.name = 'orbitRing';
      root.add(disk);

      const count = performanceMode ? 350 : 900;
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const innerC = new THREE.Color('#FFD700');
      const midC = new THREE.Color('#7C3AED');
      const outerC = new THREE.Color('#00D4FF');
      const tmp = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const arm = i % 3;
        const r = 0.4 + Math.pow(Math.random(), 0.8) * 2.6;
        const spin = r * 2.2 + (arm * Math.PI * 2) / 3;
        const spread = (Math.random() - 0.5) * 0.45;
        pos[i * 3] = Math.cos(spin) * r + spread;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 0.45;
        pos[i * 3 + 2] = Math.sin(spin) * r + spread;
        tmp.copy(r < 1.3 ? innerC : midC).lerp(outerC, Math.min(1, r / 2.8));
        col[i * 3] = tmp.r;
        col[i * 3 + 1] = tmp.g;
        col[i * 3 + 2] = tmp.b;
      }
      const gGeo = new THREE.BufferGeometry();
      gGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const spiral = new THREE.Points(
        gGeo,
        new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.95 })
      );
      spiral.rotation.x = 0.45;
      spiral.name = 'starCloud';
      root.add(spiral);
      break;
    }

    case 'tiktok_logo': {
      // 3D Extruded Music Note Prism with chromatic Cyan + Magenta ghost offset layers
      const noteShape = new THREE.Shape();
      noteShape.moveTo(0.15, -1.1);
      noteShape.absarc(-0.35, -1.1, 0.55, 0, Math.PI * 2, false);
      const stemGeo = new THREE.BoxGeometry(0.32, 2.2, 0.28);
      const flagGeo = new THREE.TorusGeometry(0.65, 0.16, 12, 24, Math.PI * 0.85);
      const bulbGeo = new THREE.TorusGeometry(0.46, 0.17, 12, 24);

      const makeLayer = (hex: number, dx: number, dy: number, dz: number) => {
        const g = new THREE.Group();
        const m = new THREE.MeshPhysicalMaterial({
          color: hex,
          emissive: hex,
          emissiveIntensity: hex === 0xffffff ? 0.25 : 0.75,
          metalness: 0.6,
          roughness: 0.18,
          clearcoat: 1,
        });
        const stem = new THREE.Mesh(stemGeo, m);
        stem.position.set(0.25, 0.1, 0);
        const bulb = new THREE.Mesh(bulbGeo, m);
        bulb.position.set(-0.22, -0.85, 0);
        const flag = new THREE.Mesh(flagGeo, m);
        flag.position.set(0.92, 0.72, 0);
        flag.rotation.z = Math.PI * 0.65;
        g.add(stem, bulb, flag);
        g.position.set(dx, dy, dz);
        return g;
      };

      root.add(makeLayer(0x00d4ff, -0.14, 0.08, -0.14));
      root.add(makeLayer(0xff0050, 0.14, -0.08, -0.14));
      root.add(makeLayer(0xffffff, 0, 0, 0.06));

      const neonRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.95, 0.05, 12, seg * 2),
        new THREE.MeshStandardMaterial({ color: 0x00d4ff, emissive: 0x00d4ff, emissiveIntensity: 1.4 })
      );
      neonRing.name = 'orbitRing';
      root.add(neonRing);
      break;
    }

    case 'rose': {
      // Multi-layered 3D Crystal Rose Bloom + emerald stem & twin leaves
      const petalMat = new THREE.MeshPhysicalMaterial({
        color: 0xff2e63,
        emissive: 0x9d174d,
        emissiveIntensity: 0.35,
        metalness: 0.25,
        roughness: 0.2,
        clearcoat: 1.0,
      });
      const petalGeo = new THREE.SphereGeometry(0.46, 16, 12, 0, Math.PI * 1.2, 0, Math.PI * 0.75);
      for (let tier = 0; tier < 3; tier++) {
        const count = 5 + tier * 2;
        const radius = 0.24 + tier * 0.24;
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + tier * 0.4;
          const petal = new THREE.Mesh(petalGeo, petalMat);
          petal.position.set(Math.cos(ang) * radius, 0.55 - tier * 0.12, Math.sin(ang) * radius);
          petal.rotation.set(0.35 + tier * 0.25, -ang, 0);
          petal.scale.set(0.85 + tier * 0.2, 1.05, 0.45);
          root.add(petal);
        }
      }
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.3, roughness: 0.45 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 12), stemMat);
      stem.position.set(0, -0.55, 0);
      root.add(stem);

      const leafGeo = new THREE.ConeGeometry(0.28, 0.72, 5);
      const leafL = new THREE.Mesh(leafGeo, stemMat);
      leafL.position.set(-0.34, -0.6, 0);
      leafL.rotation.z = 1.05;
      const leafR = new THREE.Mesh(leafGeo, stemMat);
      leafR.position.set(0.34, -0.85, 0);
      leafR.rotation.z = -1.05;
      root.add(leafL, leafR);
      break;
    }

    case 'heart_crystal': {
      // 3D Extruded Beveled Ruby Heart Crystal + orbiting golden halo
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.95);
      shape.bezierCurveTo(1.2, -0.1, 1.35, 1.0, 0.55, 1.15);
      shape.bezierCurveTo(0.18, 1.22, 0, 0.9, 0, 0.7);
      shape.bezierCurveTo(0, 0.9, -0.18, 1.22, -0.55, 1.15);
      shape.bezierCurveTo(-1.35, 1.0, -1.2, -0.1, 0, -0.95);
      const heartGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.48,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.16,
        bevelThickness: 0.18,
      });
      heartGeo.center();
      const heart = new THREE.Mesh(heartGeo, primaryMat);
      root.add(heart);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.045, 12, seg * 2), goldMat);
      ring.rotation.x = Math.PI * 0.35;
      ring.name = 'orbitRing';
      root.add(ring);
      break;
    }

    case 'crown': {
      // Royal 3D Gold Crown with 6 spires and glowing gems
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.98, 0.65, 24, 1, true), goldMat);
      band.material.side = THREE.DoubleSide;
      root.add(band);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.1, 12, seg), goldMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = -0.32;
      root.add(rim);

      const spireGeo = new THREE.ConeGeometry(0.24, 0.95, 5);
      const gemGeo = new THREE.OctahedronGeometry(0.16, 0);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const spire = new THREE.Mesh(spireGeo, goldMat);
        spire.position.set(Math.cos(ang) * 1.08, 0.68, Math.sin(ang) * 1.08);
        root.add(spire);

        const gem = new THREE.Mesh(gemGeo, i % 2 === 0 ? primaryMat : secondaryMat);
        gem.position.set(Math.cos(ang) * 1.08, 1.2, Math.sin(ang) * 1.08);
        root.add(gem);
      }
      break;
    }

    case 'diamond':
    default: {
      // Faceted Brilliant-Cut 3D Diamond with orbiting energy rings
      const crownGeo = new THREE.CylinderGeometry(0.75, 1.25, 0.55, 8);
      const pavilionGeo = new THREE.ConeGeometry(1.25, 1.45, 8);
      const crystalMat = new THREE.MeshPhysicalMaterial({
        color: c1,
        emissive: c1,
        emissiveIntensity: 0.45,
        metalness: 0.35,
        roughness: 0.08,
        clearcoat: 1.0,
      });
      const top = new THREE.Mesh(crownGeo, crystalMat);
      top.position.y = 0.28;
      const bottom = new THREE.Mesh(pavilionGeo, crystalMat);
      bottom.rotation.x = Math.PI;
      bottom.position.y = -0.72;
      root.add(top, bottom);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.05, 12, seg * 2), goldMat);
      ring.rotation.set(0.65, 0.4, 0);
      ring.name = 'orbitRing';
      root.add(ring);
      break;
    }
  }

  return root;
}

export function ThreeDStage({ activeEffects, performanceMode }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const active3D = activeEffects.find(
    (item) =>
      item.config.use3D ||
      item.config.primaryEffect === '3d_gift' ||
      item.config.primaryEffect === 'legendary'
  );
  const active3DRef = useRef<ActiveEffectInstance | undefined>(active3D);
  active3DRef.current = active3D;

  const engineRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    modelGroup: THREE.Group | null;
    currentInstanceId: string | null;
    frameId: number;
    running: boolean;
    clock: THREE.Clock;
    startRenderLoop: () => void;
  } | null>(null);

  // Initialize Three.js WebGLRenderer once in dedicated ref container
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
    camera.position.set(0, 0.35, 7.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));

    // Mandatory Studio PMREM Environment for gleaming gold & crystal PBR
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // Warm Key + Cool Hemisphere Fill + Rim Light
    const hemi = new THREE.HemisphereLight(0x88ccff, 0x1a1033, 1.1);
    const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
    key.position.set(4, 6, 5);
    const rim = new THREE.DirectionalLight(0x7c3aed, 1.8);
    rim.position.set(-5, 2, -4);
    scene.add(hemi, key, rim);

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const handleContextLost = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const state = {
      renderer,
      scene,
      camera,
      modelGroup: null as THREE.Group | null,
      currentInstanceId: null as string | null,
      frameId: 0,
      running: false,
      clock: new THREE.Clock(),
      startRenderLoop: () => {},
    };

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        state.frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          state.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          state.frameId = window.setTimeout(cb, 80);
        }
      };
      state.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      const active = active3DRef.current;
      if (!active || !state.modelGroup) {
        state.running = false;
        renderer.clear();
        return;
      }

      const delta = Math.min(0.05, state.clock.getDelta());
      const now = Date.now();
      const totalDur = Math.max(800, active.expiresAt - active.startedAt);
      const elapsed = Math.max(0, now - active.startedAt);
      const t = Math.min(1, elapsed / totalDur);

      // Smooth spring entrance (0 -> 0.18), heroic float (0.18 -> 0.82), radiant exit (0.82 -> 1.0)
      const baseScale = active.config.scale * 0.92;
      let targetScale = baseScale;
      if (t < 0.18) {
        const p = t / 0.18;
        targetScale = baseScale * (1 - Math.pow(1 - p, 3)) * 1.08;
      } else if (t > 0.84) {
        const p = (t - 0.84) / 0.16;
        targetScale = baseScale * Math.max(0.01, 1 - p * p);
      }

      const currS = state.modelGroup.scale.x;
      const nextS = THREE.MathUtils.damp(currS, targetScale, 8, delta);
      state.modelGroup.scale.setScalar(nextS);

      state.modelGroup.rotation.y += delta * (active.config.priority >= 4 ? 1.15 : 1.55);
      state.modelGroup.position.y = Math.sin(elapsed * 0.0032) * 0.22;

      // Animate sub-rings & star clouds independently
      state.modelGroup.children.forEach((child, idx) => {
        if (child.name.startsWith('orbitRing')) {
          child.rotation.z += delta * (1.2 + idx * 0.4);
          child.rotation.x += delta * 0.45;
        } else if (child.name === 'starCloud') {
          child.rotation.y -= delta * 0.65;
        }
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        state.frameId = requestAnimationFrame(tick);
      }
    };

    state.startRenderLoop = () => {
      if (state.running) return;
      state.running = true;
      state.clock.getDelta();
      tick();
    };

    engineRef.current = state;

    return () => {
      cancelAnimationFrame(state.frameId);
      clearTimeout(state.frameId);
      state.running = false;
      ro.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      if (state.modelGroup) {
        scene.remove(state.modelGroup);
        disposeObject3D(state.modelGroup);
      }
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      engineRef.current = null;
    };
  }, []);

  // Swap 3D model only when active 3D gift changes; dispose cleanly when idle
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (!active3D) {
      if (engine.modelGroup) {
        engine.scene.remove(engine.modelGroup);
        disposeObject3D(engine.modelGroup);
        engine.modelGroup = null;
        engine.currentInstanceId = null;
        engine.renderer.clear();
      }
      return;
    }

    if (engine.currentInstanceId === active3D.instanceId) return;

    if (engine.modelGroup) {
      engine.scene.remove(engine.modelGroup);
      disposeObject3D(engine.modelGroup);
    }

    const preset: ThreeDModelPreset = active3D.config.model3D || 'crown';
    const model = buildProceduralGiftModel(
      preset,
      active3D.config.primaryColor,
      active3D.config.secondaryColor,
      performanceMode
    );
    model.scale.setScalar(0.05);
    engine.scene.add(model);
    engine.modelGroup = model;
    engine.currentInstanceId = active3D.instanceId;
    engine.startRenderLoop();
  }, [active3D, performanceMode]);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 14 }}
    />
  );
}
