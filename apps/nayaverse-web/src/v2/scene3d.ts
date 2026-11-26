/**
 * The product screens as objects in space (three.js).
 *
 * The real screens, each a thin white slab with the screenshot on its face,
 * at different depths. They fly in from the back on load, bob gently, lean
 * toward the pointer, tilt as the page scrolls past, and the two main ones
 * lift when pointed at and open their product when pressed. With reduced
 * motion asked for, one still frame is drawn and nothing moves.
 *
 * Loaded only in the browser, after the page is on screen; the prerendered
 * HTML under it is the fallback for no WebGL and for crawlers.
 */
import * as THREE from 'three';

export type SceneScreen = {
  src: string;
  w: number; // pixels, for the aspect ratio
  h: number;
  width: number; // world units
  pos: [number, number, number];
  rot?: [number, number, number];
  href?: string;
  main?: boolean;
  /** The share of the screenshot's height shown, from the top. */
  crop?: number;
};

export type SceneHandle = { dispose: () => void };

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A soft round shadow, drawn once on a canvas. */
function shadowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(22,24,29,0.34)');
  grd.addColorStop(1, 'rgba(22,24,29,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mountScene(host: HTMLElement, screens: SceneScreen[], opts: { still: boolean; onReady: () => void; camZ?: number }): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'v-3d-canvas';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const camZ = opts.camZ ?? 15;
  camera.position.set(0, 0, camZ);

  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-4, 6, 8);
  scene.add(key);

  const world = new THREE.Group();
  scene.add(world);

  const loader = new THREE.TextureLoader();
  const shadow = shadowTexture();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  type Item = { group: THREE.Group; face: THREE.Mesh; base: THREE.Vector3; rot: THREE.Euler; phase: number; s: SceneScreen; lift: number; delay: number };
  const items: Item[] = [];
  let pending = screens.length;

  screens.forEach((s, i) => {
    const width = s.width;
    const crop = s.crop ?? 1;
    const height = (width * s.h * crop) / s.w;
    const group = new THREE.Group();
    const r = Math.min(width, height) * 0.035;

    // the slab: white, a little thick, rounded
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRect(width + 0.12, height + 0.12, r + 0.04), { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 6 }),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 }),
    );
    body.position.z = -0.1;
    group.add(body);

    // the screen itself
    const faceGeo = new THREE.ShapeGeometry(roundedRect(width, height, r), 6);
    // ShapeGeometry has UVs in shape units: map them onto 0..1
    const uv = faceGeo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / width + 0.5, uv.getY(k) / height + 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const face = new THREE.Mesh(faceGeo, mat);
    face.position.z = 0.02;
    group.add(face);
    loader.load(
      s.src,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = maxAniso;
        tex.repeat.set(1, crop);
        tex.offset.set(0, 1 - crop);
        mat.map = tex;
        mat.needsUpdate = true;
        if (--pending === 0) ready();
      },
      undefined,
      () => {
        if (--pending === 0) ready();
      },
    );

    // a soft shadow under it
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.5, height * 0.5), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0, -height / 2 - 0.45, 0.2);
    group.add(sh);

    const base = new THREE.Vector3(...s.pos);
    const rot = new THREE.Euler(...(s.rot ?? [0, 0, 0]));
    group.position.copy(base);
    group.rotation.copy(rot);
    world.add(group);
    items.push({ group, face, base, rot, phase: i * 1.7, s, lift: 0, delay: s.main ? i * 0.12 : 0.25 + i * 0.07 });
  });

  // pointer and scroll
  const pointer = new THREE.Vector2(0, 0);
  const target = new THREE.Vector2(0, 0);
  let scrollP = 0;
  const ray = new THREE.Raycaster();
  let hovered: Item | null = null;
  const mains = items.filter((it) => it.s.href);

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    target.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    if (e.target === canvas) {
      ray.setFromCamera(target, camera);
      const hit = ray.intersectObjects(mains.map((m) => m.face))[0];
      hovered = hit ? mains.find((m) => m.face === hit.object) ?? null : null;
      canvas.style.cursor = hovered ? 'pointer' : '';
    }
  };
  const onLeave = () => {
    target.set(0, 0);
    hovered = null;
    canvas.style.cursor = '';
  };
  const onClick = () => {
    if (hovered?.s.href) window.location.href = hovered.s.href;
  };
  const onScroll = () => {
    const r = host.getBoundingClientRect();
    scrollP = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', onClick);
  window.addEventListener('scroll', onScroll, { passive: true });

  const size = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    // narrow screens see the same scene from further back
    camera.position.z = camZ * Math.max(1, 1.55 / Math.min(1.55, camera.aspect));
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(size);
  ro.observe(host);
  size();

  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = Boolean(e?.isIntersecting);
    if (visible) loop();
  });
  io.observe(host);

  const clock = new THREE.Clock();
  let start = -1;
  let raf = 0;
  let readyDone = false;
  function ready() {
    if (readyDone) return;
    readyDone = true;
    start = clock.getElapsedTime();
    opts.onReady();
    if (opts.still) frame(99);
    else loop();
  }

  const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 4);

  function frame(t: number) {
    const since = start < 0 ? 0 : t - start;
    pointer.lerp(target, opts.still ? 1 : 0.06);
    world.rotation.y = pointer.x * 0.16;
    world.rotation.x = -pointer.y * 0.08 + scrollP * 0.35;
    world.position.y = scrollP * 1.4;
    for (const it of items) {
      const k = opts.still ? 1 : ease((since - it.delay) / 1.3);
      const bob = opts.still ? 0 : Math.sin(t * 0.7 + it.phase) * (it.s.main ? 0.08 : 0.16);
      it.lift += ((hovered === it ? 1 : 0) - it.lift) * 0.12;
      it.group.position.set(it.base.x, it.base.y + bob + it.lift * 0.18, it.base.z - (1 - k) * 14 + it.lift * 0.6);
      it.group.rotation.set(it.rot.x + (1 - k) * 0.5, it.rot.y * (0.4 + 0.6 * k) - it.lift * it.rot.y * 0.6, it.rot.z);
      (it.face.material as THREE.MeshBasicMaterial).opacity = k;
    }
    renderer.render(scene, camera);
  }

  function loop() {
    cancelAnimationFrame(raf);
    if (opts.still || !visible || !readyDone) return;
    raf = requestAnimationFrame(() => {
      frame(clock.getElapsedTime());
      loop();
    });
  }

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.MeshBasicMaterial | undefined;
        mat?.map?.dispose();
        mat?.dispose?.();
      });
      renderer.dispose();
      canvas.remove();
    },
  };
}
