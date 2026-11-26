/**
 * The product screens as objects in space (three.js).
 *
 * The real screens, each a white rounded card with the screenshot on its
 * face, at different depths. They fly in from the back on load, bob gently,
 * and move by depth: the pointer and the scroll shift near cards a little and
 * far cards more, which is what makes it read as space rather than a tilted
 * picture. Far cards fade toward the page's white. The main cards lift when
 * pointed at and open their product when pressed, and each carries an HTML
 * label that follows it. With reduced motion asked for, one still frame is
 * drawn and nothing moves.
 *
 * The canvas is drawn at its own on-screen size (never stretched), and the
 * camera is placed so the main cards span the page's content width at any
 * window width.
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

/** A soft shadow the shape of a card: only the blur is drawn, not the card. */
const SHADOW_PAD = 0.3; // of the texture, on each side
function shadowTexture(): THREE.Texture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const inset = size * SHADOW_PAD;
  g.shadowColor = 'rgba(22, 24, 29, 0.5)';
  g.shadowBlur = size * 0.16;
  g.shadowOffsetX = size * 2; // the rectangle itself is drawn off the canvas
  g.fillStyle = '#000';
  g.beginPath();
  g.roundRect(inset - size * 2, inset, size - inset * 2, size - inset * 2, 14);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const FOV = 30;

export function mountScene(
  host: HTMLElement,
  screens: SceneScreen[],
  opts: { still: boolean; onReady: () => void; /** world units the page's content width should show */ fit?: number },
): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'v-3d-canvas';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0xffffff, 10, 30);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const fit = opts.fit ?? 15.2;

  scene.add(new THREE.AmbientLight(0xffffff, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-4, 6, 8);
  scene.add(key);

  const world = new THREE.Group();
  scene.add(world);

  const loader = new THREE.TextureLoader();
  const shadow = shadowTexture();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  type Item = { group: THREE.Group; face: THREE.Mesh; shade: THREE.Mesh; height: number; base: THREE.Vector3; rot: THREE.Euler; phase: number; s: SceneScreen; lift: number; delay: number; label?: HTMLElement };
  const items: Item[] = [];
  const labels = Array.from(host.querySelectorAll<HTMLElement>('[data-label]'));
  let pending = screens.length;

  screens.forEach((s, i) => {
    const crop = s.crop ?? 1;
    const width = s.width;
    const height = (width * s.h * crop) / s.w;
    const group = new THREE.Group();
    const r = Math.min(width, height) * 0.045;
    const edge = s.main ? 0.07 : 0.05;

    // the card: white, a little thick, rounded; its rim is the screen's border
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRect(width + edge * 2, height + edge * 2, r + edge), { depth: 0.06, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 10 }),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 }),
    );
    body.position.z = -0.08;
    group.add(body);

    // the screen itself
    const faceGeo = new THREE.ShapeGeometry(roundedRect(width, height, r), 10);
    // ShapeGeometry has UVs in shape units: map them onto 0..1
    const uv = faceGeo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / width + 0.5, uv.getY(k) / height + 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const face = new THREE.Mesh(faceGeo, mat);
    face.position.z = 0.012;
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

    // its shadow: behind and a little below, soft
    const k = 1 / (1 - SHADOW_PAD * 2);
    const shade = new THREE.Mesh(
      new THREE.PlaneGeometry((width + edge * 2) * k, (height + edge * 2) * k),
      new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, opacity: 0 }),
    );
    shade.position.set(0, -height * 0.09 - 0.12, -0.5);
    shade.renderOrder = -1;
    group.add(shade);

    const base = new THREE.Vector3(...s.pos);
    const rot = new THREE.Euler(...(s.rot ?? [0, 0, 0]));
    group.position.copy(base);
    group.rotation.copy(rot);
    world.add(group);
    items.push({ group, face, shade, height, base, rot, phase: i * 1.7, s, lift: 0, delay: s.main ? i * 0.14 : 0.3 + i * 0.08, label: s.main ? labels[items.filter((x) => x.s.main).length] : undefined });
  });

  // pointer and scroll
  const pointer = new THREE.Vector2(0, 0);
  const target = new THREE.Vector2(0, 0);
  let scrollP = 0;
  const ray = new THREE.Raycaster();
  let hovered: Item | null = null;
  const mains = items.filter((it) => it.s.href);

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    target.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    target.x = Math.max(-1.2, Math.min(1.2, target.x));
    target.y = Math.max(-1.6, Math.min(1.6, target.y));
    if (e.target === canvas) {
      ray.setFromCamera(new THREE.Vector2(Math.max(-1, Math.min(1, target.x)), Math.max(-1, Math.min(1, target.y))), camera);
      const hit = ray.intersectObjects(mains.map((m) => m.face))[0];
      hovered = hit ? mains.find((m) => m.face === hit.object) ?? null : null;
      canvas.style.cursor = hovered ? 'pointer' : '';
    } else if (hovered) {
      hovered = null;
      canvas.style.cursor = '';
    }
  };
  const onLeave = () => {
    hovered = null;
    canvas.style.cursor = '';
  };
  const onClick = () => {
    if (hovered?.s.href) window.location.href = hovered.s.href;
  };
  const onScroll = () => {
    const r = host.getBoundingClientRect();
    scrollP = Math.min(1.2, Math.max(0, (window.innerHeight * 0.45 - r.top) / Math.max(1, r.height)));
    if (opts.still) frame(99);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', onClick);
  window.addEventListener('scroll', onScroll, { passive: true });

  let cw = 1;
  let ch = 1;
  const size = () => {
    // the canvas's own size on screen: it is wider than its host
    cw = Math.max(1, canvas.clientWidth);
    ch = Math.max(1, canvas.clientHeight);
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    // the page's content width shows `fit` world units, whatever the window is
    const contentPx = Math.min(1240, cw - 48);
    const visibleH = ((fit * cw) / contentPx) / camera.aspect;
    camera.position.set(0, 0, visibleH / 2 / Math.tan((FOV * Math.PI) / 360));
    camera.updateProjectionMatrix();
    fog.near = camera.position.z + 1.5;
    fog.far = camera.position.z + 16;
    if (opts.still && readyDone) frame(99);
  };
  const ro = new ResizeObserver(size);
  ro.observe(canvas);

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
    size();
    onScroll();
    start = clock.getElapsedTime();
    opts.onReady();
    if (opts.still) frame(99);
    else loop();
  }

  const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 4);
  const at = new THREE.Vector3();

  function frame(t: number) {
    const since = start < 0 ? 0 : t - start;
    pointer.lerp(target, opts.still ? 1 : 0.07);
    world.rotation.y = pointer.x * 0.09;
    world.rotation.x = -pointer.y * 0.04 + scrollP * 0.16;
    for (const it of items) {
      const k = opts.still ? 1 : ease((since - it.delay) / 1.4);
      const depth = -it.base.z; // 0 for the main cards, more for the ones behind
      const bob = opts.still ? 0 : Math.sin(t * 0.7 + it.phase) * (it.s.main ? 0.05 : 0.11);
      it.lift += ((hovered === it ? 1 : 0) - it.lift) * 0.12;
      it.group.position.set(
        // parallax: what is further away moves further, against the pointer
        it.base.x - pointer.x * (0.12 + depth * 0.16),
        it.base.y + bob + it.lift * 0.14 + pointer.y * depth * 0.07 + scrollP * (0.22 + depth * 0.12),
        it.base.z - (1 - k) * 16 + it.lift * 0.7,
      );
      it.group.rotation.set(it.rot.x + (1 - k) * 0.45, it.rot.y * (0.35 + 0.65 * k) * (1 - it.lift * 0.7), it.rot.z);
      (it.face.material as THREE.MeshBasicMaterial).opacity = k;
      (it.shade.material as THREE.MeshBasicMaterial).opacity = k * (it.s.main ? 0.55 + it.lift * 0.25 : 0.34);
      if (it.label) {
        at.set(0, -it.height / 2 - 0.12, 0.05);
        it.group.localToWorld(at).project(camera);
        const x = ((at.x + 1) / 2) * cw;
        const y = ((1 - at.y) / 2) * ch;
        it.label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, 0)`;
        it.label.style.opacity = String(k);
      }
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
