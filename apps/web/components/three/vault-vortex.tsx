"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero scene — "the vault".
 *
 *  • A 3-arm particle spiral flows inward (secrets being pulled in).
 *  • Plaintext .env keys orbit inward and flip to ciphertext as they
 *    cross the encryption ring.
 *  • A faceted core with a fresnel rim is the vault; orbit rings carry
 *    small "machine" nodes — every device that can restore it.
 *
 * Vanilla three.js (no react-three-fiber) so it is independent of the
 * React version Next's app router bundles.
 */

const PLAIN_KEYS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "API_KEY",
  "REDIS_URL",
  "SMTP_PASSWORD",
  "S3_BUCKET",
  "SENTRY_DSN",
  "NEXT_PUBLIC_URL",
  "STRIPE_SECRET",
  "OAUTH_CLIENT_ID",
];

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const randomCipher = (n: number) => Array.from({ length: n }, () => B64[(Math.random() * 64) | 0]).join("") + "=";

const GALAXY_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uRadius;
  attribute float aRadius;
  attribute float aAngle;
  attribute float aSize;
  attribute vec3 aOffset;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float inner = 0.45;
    // Inward flow — radius shrinks over time and wraps back to the rim.
    float span = uRadius - inner;
    float r = inner + mod(aRadius - inner - uTime * 0.16, span);
    // Arm curl + differential rotation (inner particles orbit faster).
    float ang = aAngle + r * 0.95 + uTime * 0.55 / (r * 0.55 + 0.35);

    vec3 pos = vec3(cos(ang) * r, 0.0, sin(ang) * r);
    pos += aOffset * vec3(0.16 * r, 0.18 + 0.55 / (r + 0.6), 0.16 * r);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aSize * uPixelRatio / -mv.z;

    float t = clamp((r - inner) / span, 0.0, 1.0);
    vec3 core  = vec3(1.0, 1.0, 0.94);
    vec3 volt  = vec3(0.78, 1.0, 0.29);
    vec3 iris  = vec3(0.55, 0.49, 1.0);
    vec3 dust  = vec3(0.62, 0.62, 0.72);
    vec3 c = mix(core, volt, smoothstep(0.0, 0.18, t));
    c = mix(c, iris, smoothstep(0.22, 0.6, t));
    c = mix(c, dust, smoothstep(0.65, 1.0, t));
    vColor = c;
    // Fade in at the rim, fade out as it is swallowed by the core.
    vAlpha = smoothstep(0.0, 0.12, 1.0 - t) * smoothstep(0.0, 0.08, t);
  }
`;

const GALAXY_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(1.0 - smoothstep(0.0, 0.5, d), 2.2);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

const FRESNEL_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRESNEL_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.0);
    float pulse = 0.85 + 0.15 * sin(uTime * 2.0);
    vec3 base = vec3(0.03, 0.03, 0.05);
    vec3 rim = mix(vec3(0.78, 1.0, 0.29), vec3(0.55, 0.49, 1.0), vNormal.y * 0.5 + 0.5);
    gl_FragColor = vec4(base + rim * f * 1.6 * pulse, 1.0);
  }
`;

function radialTexture(inner: string, outer = "rgba(0,0,0,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function labelTexture(text: string, cipher: boolean) {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const font = `600 40px ui-monospace, SFMono-Regular, Menlo, monospace`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 56;
  const h = 72;
  c.width = w;
  c.height = h;
  g.font = font;
  g.textBaseline = "middle";
  // pill
  const r = h / 2;
  g.beginPath();
  g.moveTo(r, 2);
  g.arcTo(w - 2, 2, w - 2, h - 2, r - 2);
  g.arcTo(w - 2, h - 2, 2, h - 2, r - 2);
  g.arcTo(2, h - 2, 2, 2, r - 2);
  g.arcTo(2, 2, w - 2, 2, r - 2);
  g.closePath();
  g.fillStyle = cipher ? "rgba(198,255,74,0.08)" : "rgba(255,255,255,0.06)";
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = cipher ? "rgba(198,255,74,0.55)" : "rgba(255,255,255,0.28)";
  g.stroke();
  g.fillStyle = cipher ? "#c6ff4a" : "#f4f4f6";
  g.fillText(text, 28, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

export function VaultVortex({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      host.dataset.fallback = "true"; // CSS fallback shows a static gradient
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = host.clientWidth < 768;
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(small ? 60 : 45, host.clientWidth / host.clientHeight, 0.1, 100);
    const camBase = new THREE.Vector3(0, small ? 6.6 : 4.2, small ? 12 : 9.8);
    const lookAt = new THREE.Vector3(0, small ? 4.4 : 3.0, 0);
    camera.position.copy(camBase);
    camera.lookAt(lookAt);

    const world = new THREE.Group();
    world.rotation.z = -0.08;
    scene.add(world);

    /* ── Galaxy ─────────────────────────────────────────── */
    const COUNT = small ? 7000 : 16000;
    const RADIUS = 7.5;
    const ARMS = 3;
    const aRadius = new Float32Array(COUNT);
    const aAngle = new Float32Array(COUNT);
    const aSize = new Float32Array(COUNT);
    const aOffset = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      aRadius[i] = 0.45 + Math.pow(Math.random(), 1.35) * (RADIUS - 0.45);
      aAngle[i] = ((i % ARMS) / ARMS) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      aSize[i] = 0.4 + Math.pow(Math.random(), 4) * 2.6;
      for (let k = 0; k < 3; k++) {
        aOffset[i * 3 + k] = Math.pow(Math.random(), 2.4) * (Math.random() < 0.5 ? 1 : -1);
      }
    }
    const galaxyGeo = track(new THREE.BufferGeometry());
    galaxyGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    galaxyGeo.setAttribute("aRadius", new THREE.BufferAttribute(aRadius, 1));
    galaxyGeo.setAttribute("aAngle", new THREE.BufferAttribute(aAngle, 1));
    galaxyGeo.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
    galaxyGeo.setAttribute("aOffset", new THREE.BufferAttribute(aOffset, 3));
    galaxyGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), RADIUS * 1.5);
    const galaxyMat = track(
      new THREE.ShaderMaterial({
        vertexShader: GALAXY_VERT,
        fragmentShader: GALAXY_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: small ? 34 : 42 },
          uPixelRatio: { value: renderer.getPixelRatio() },
          uRadius: { value: RADIUS },
        },
      }),
    );
    world.add(new THREE.Points(galaxyGeo, galaxyMat));

    /* ── Vault core ─────────────────────────────────────── */
    const core = new THREE.Group();
    core.position.y = 0.15;
    world.add(core);

    const solidGeo = track(new THREE.IcosahedronGeometry(0.62, 0));
    const solidMat = track(
      new THREE.ShaderMaterial({ vertexShader: FRESNEL_VERT, fragmentShader: FRESNEL_FRAG, uniforms: { uTime: { value: 0 } } }),
    );
    const solid = new THREE.Mesh(solidGeo, solidMat);
    core.add(solid);

    const shellGeo = track(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.0, 1)));
    const shellMat = track(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    const shell = new THREE.LineSegments(shellGeo, shellMat);
    core.add(shell);

    const glowTex = track(radialTexture("rgba(198,255,74,0.55)"));
    const glowMat = track(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(4.2);
    core.add(glow);

    const haloTex = track(radialTexture("rgba(139,124,255,0.35)"));
    const haloMat = track(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(11);
    core.add(halo);

    /* ── Orbit rings + machine nodes ────────────────────── */
    const ENCRYPT_RING = 2.0;
    const rings: { mesh: THREE.Mesh; speed: number; node: THREE.Group; radius: number; phase: number }[] = [];
    const nodeTex = track(radialTexture("rgba(255,255,255,0.9)"));
    const ringDefs = [
      { radius: ENCRYPT_RING, tilt: [Math.PI / 2, 0, 0], speed: 0.5, color: 0xc6ff4a, opacity: 0.55 },
      { radius: 2.9, tilt: [Math.PI / 2 + 0.35, 0.25, 0], speed: -0.32, color: 0xffffff, opacity: 0.18 },
      { radius: 3.9, tilt: [Math.PI / 2 - 0.22, -0.3, 0], speed: 0.22, color: 0x8b7cff, opacity: 0.25 },
    ] as const;
    for (const d of ringDefs) {
      const geo = track(new THREE.TorusGeometry(d.radius, 0.006, 6, 240));
      const mat = track(new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: d.opacity }));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(d.tilt[0], d.tilt[1], d.tilt[2]);
      world.add(mesh);
      const node = new THREE.Group();
      const dotMat = track(new THREE.SpriteMaterial({ map: nodeTex, color: d.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      const dot = new THREE.Sprite(dotMat);
      dot.scale.setScalar(0.32);
      node.add(dot);
      mesh.add(node);
      rings.push({ mesh, speed: d.speed, node, radius: d.radius, phase: Math.random() * Math.PI * 2 });
    }

    /* ── Plaintext → ciphertext labels ──────────────────── */
    type Label = {
      sprite: THREE.Sprite;
      plain: { tex: THREE.CanvasTexture; aspect: number };
      cipher: { tex: THREE.CanvasTexture; aspect: number };
      r: number;
      a: number;
      y: number;
      encrypted: boolean;
    };
    const labels: Label[] = [];
    const LABEL_OUT = 6.4;
    const LABEL_IN = 1.15;
    const labelCount = small ? 5 : PLAIN_KEYS.length;
    for (let i = 0; i < labelCount; i++) {
      const plain = labelTexture(PLAIN_KEYS[i]!, false);
      const cipher = labelTexture(randomCipher(10), true);
      track(plain.tex);
      track(cipher.tex);
      const mat = track(new THREE.SpriteMaterial({ map: plain.tex, transparent: true, depthWrite: false }));
      const sprite = new THREE.Sprite(mat);
      world.add(sprite);
      labels.push({
        sprite,
        plain,
        cipher,
        r: LABEL_IN + ((i + 0.5) / labelCount) * (LABEL_OUT - LABEL_IN),
        a: (i / labelCount) * Math.PI * 2 * 2.3,
        y: (Math.random() - 0.5) * 0.6,
        encrypted: false,
      });
    }

    /* ── Interaction ────────────────────────────────────── */
    const pointer = new THREE.Vector2();
    const pointerSmooth = new THREE.Vector2();
    const onPointer = (e: PointerEvent) => {
      pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let scrollP = 0;
    const onScroll = () => {
      scrollP = Math.min(1, Math.max(0, window.scrollY / Math.max(1, host.clientHeight)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (reduced) render(0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
    });
    io.observe(host);

    /* ── Frame ──────────────────────────────────────────── */
    const clock = new THREE.Clock();
    let elapsed = 0;

    function render(dt: number) {
      elapsed += dt;
      const t = elapsed;
      galaxyMat.uniforms.uTime!.value = t;
      solidMat.uniforms.uTime!.value = t;

      solid.rotation.set(t * 0.35, t * 0.5, 0);
      shell.rotation.set(-t * 0.12, -t * 0.18, t * 0.05);
      const s = 1 + Math.sin(t * 2) * 0.04;
      glow.scale.setScalar(4.2 * s);

      for (const ring of rings) {
        const a = ring.phase + t * ring.speed;
        ring.node.position.set(Math.cos(a) * ring.radius, Math.sin(a) * ring.radius, 0);
      }

      for (const l of labels) {
        l.r -= dt * 0.32;
        l.a += dt * (0.42 / (l.r * 0.45 + 0.3));
        if (l.r < LABEL_IN) {
          l.r = LABEL_OUT;
          l.encrypted = false;
          l.sprite.material.map = l.plain.tex;
          l.sprite.material.needsUpdate = true;
        }
        if (!l.encrypted && l.r < ENCRYPT_RING + 0.15) {
          l.encrypted = true;
          l.sprite.material.map = l.cipher.tex;
          l.sprite.material.needsUpdate = true;
        }
        const tex = l.encrypted ? l.cipher : l.plain;
        const h = 0.17 + (l.r / LABEL_OUT) * 0.05;
        l.sprite.scale.set(h * tex.aspect, h, 1);
        l.sprite.position.set(Math.cos(l.a) * l.r, l.y + 0.25, Math.sin(l.a) * l.r);
        const fadeIn = Math.min(1, (LABEL_OUT - l.r) / 0.8);
        const fadeOut = Math.min(1, (l.r - LABEL_IN) / 0.5);
        l.sprite.material.opacity = Math.max(0, Math.min(fadeIn, fadeOut)) * 0.95;
      }

      // Camera: pointer parallax + scroll dolly.
      pointerSmooth.lerp(pointer, 0.05);
      camera.position.set(
        camBase.x + pointerSmooth.x * 1.1,
        camBase.y - pointerSmooth.y * 0.6 - scrollP * 2.2,
        camBase.z - scrollP * 3.2,
      );
      camera.lookAt(lookAt.x, lookAt.y - scrollP * 1.6, lookAt.z);
      world.rotation.y = t * 0.04 + pointerSmooth.x * 0.15;

      renderer.render(scene, camera);
    }

    let raf = 0;
    if (reduced) {
      render(6); // a settled, static frame
    } else {
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        if (!visible || document.hidden) return;
        render(dt);
      };
      loop();
    }
    requestAnimationFrame(() => host.setAttribute("data-ready", "true"));

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`absolute inset-0 opacity-0 transition-opacity duration-[1600ms] data-[ready=true]:opacity-100 data-[fallback=true]:opacity-100 data-[fallback=true]:bg-[radial-gradient(ellipse_at_50%_70%,rgba(198,255,74,0.15),transparent_60%)] ${className}`}
    />
  );
}
