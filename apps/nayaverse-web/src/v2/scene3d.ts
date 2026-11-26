/**
 * The product screens as objects in space (three.js).
 *
 * The real screens, each a white rounded card with the screenshot on its
 * face. Every screen starts in a place: one at the front of its group (a
 * product), the others further back. The places are fixed; the cards move
 * between them:
 *
 *   - The places of a group form a ring, in the order its screens are
 *     listed. On a turn every card moves round to the next place: one
 *     arrives at the front, the one in front goes to the last place, and the
 *     rest move up behind it, like a wheel.
 *   - Press a card at the back and the wheel turns until that card is in
 *     front.
 *   - Left alone, the groups take turns turning by themselves every few
 *     seconds, so every screen comes forward in time.
 *   - Press the card in front and it opens its product (where it has a page).
 *
 * They fly in from the back on load, bob gently, and move by depth with the
 * pointer and the scroll. Far cards fade toward the page's white. Each
 * group's label follows whichever card is in front. With reduced motion
 * asked for, nothing moves by itself and a pressed card changes places at
 * once.
 *
 * The canvas is drawn at its own on-screen size (never stretched), and the
 * camera is placed so the front cards span the page's content width at any
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
  width: number; // world units, in the place it starts in
  pos: [number, number, number];
  rot?: [number, number, number];
  href?: string;
  /** Starts at the front of its group. */
  main?: boolean;
  /** The share of the screenshot's height shown, from the top. */
  crop?: number;
  /** Which product's screens it changes places with. */
  group?: number;
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
/** Every card is modelled at this width and scaled to the place it is in. */
const UNIT = 7;
/** How long a change of places takes, and how long the stage rests between them. */
const SWAP = 1.25;
const REST = 3.4;

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

  // the places: fixed. Cards move between the places of their own group.
  type Slot = { pos: THREE.Vector3; rot: THREE.Euler; scale: number; main: boolean; group: number; href?: string };
  const slots: Slot[] = screens.map((s) => ({
    pos: new THREE.Vector3(...s.pos),
    rot: new THREE.Euler(...(s.rot ?? [0, 0, 0])),
    scale: s.width / UNIT,
    main: Boolean(s.main),
    group: s.group ?? 0,
    href: s.href,
  }));

  const loader = new THREE.TextureLoader();
  const shadow = shadowTexture();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  type Pose = { pos: THREE.Vector3; rx: number; ry: number; rz: number; scale: number; front: number };
  type Item = {
    group: THREE.Group;
    face: THREE.Mesh;
    shade: THREE.Mesh;
    height: number; // at UNIT width
    slot: number;
    cur: Pose;
    from: Pose;
    t0: number; // when its change of places began; -1 when it is at rest
    dir: number; // 1 coming forward, -1 going back
    phase: number;
    lift: number;
    delay: number;
  };
  const items: Item[] = [];
  const poseOf = (s: Slot): Pose => ({ pos: s.pos.clone(), rx: s.rot.x, ry: s.rot.y, rz: s.rot.z, scale: s.scale, front: s.main ? 1 : 0 });
  let pending = screens.length;

  screens.forEach((s, i) => {
    const crop = s.crop ?? 1;
    const width = UNIT;
    const height = (width * s.h * crop) / s.w;
    const group = new THREE.Group();
    const r = Math.min(width, height) * 0.045;
    const edge = 0.075;

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

    world.add(group);
    const slot = slots[i]!;
    items.push({ group, face, shade, height, slot: i, cur: poseOf(slot), from: poseOf(slot), t0: -1, dir: 1, phase: i * 1.7, lift: 0, delay: slot.main ? i * 0.14 : 0.3 + i * 0.08 });
  });

  // each group's ring of places: the front one first, then the others in the
  // order they were listed, which is the way round the wheel
  const groups = [...new Set(slots.map((s) => s.group))].sort((a, b) => a - b);
  const rings = new Map<number, number[]>(
    groups.map((g) => {
      const mine = slots.map((_, i) => i).filter((i) => slots[i]!.group === g);
      return [g, [...mine.filter((i) => slots[i]!.main), ...mine.filter((i) => !slots[i]!.main)]];
    }),
  );
  const labels = Array.from(host.querySelectorAll<HTMLElement>('[data-label]'));
  const frontOf = (g: number) => items.find((it) => slots[it.slot]!.group === g && slots[it.slot]!.main);

  // pointer and scroll
  const pointer = new THREE.Vector2(0, 0);
  const target = new THREE.Vector2(0, 0);
  let scrollP = 0;
  const ray = new THREE.Raycaster();
  let hovered: Item | null = null;
  const clock = new THREE.Clock();
  let nextTurn = Infinity; // when the stage next changes places by itself
  let turn = 0;

  const moving = () => items.some((it) => it.t0 >= 0);

  /** Turns a group's wheel by `steps` places: every card moves round, and
   *  the card that was `steps` places behind the front arrives in front. */
  function turnWheel(g: number, steps: number, now: number) {
    const ring = rings.get(g)!;
    const n = ring.length;
    if (n < 2 || steps % n === 0 || moving()) return false;
    for (const x of items) {
      const from = ring.indexOf(x.slot);
      if (from < 0) continue;
      const to = (((from - steps) % n) + n) % n;
      x.from = { ...x.cur, pos: x.cur.pos.clone() };
      x.slot = ring[to]!;
      x.dir = to === 0 ? 1 : from === 0 ? -1 : 0;
      x.t0 = opts.still ? -1 : now;
      if (opts.still) x.cur = poseOf(slots[x.slot]!);
    }
    return true;
  }
  /** Brings a card at the back to the front by turning its wheel that far. */
  function bring(it: Item, now: number) {
    const place = slots[it.slot]!;
    if (place.main) return false;
    return turnWheel(place.group, rings.get(place.group)!.indexOf(it.slot), now);
  }

  // where the pointer is over the canvas, if it is; the card under it is
  // found again every frame, because the cards move under a pointer at rest
  let over: THREE.Vector2 | null = null;
  const under = (p: THREE.Vector2) => {
    ray.setFromCamera(p, camera);
    const hit = ray.intersectObjects(items.map((m) => m.face))[0];
    return hit ? items.find((m) => m.face === hit.object) ?? null : null;
  };
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return under(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
  };
  const pressable = (it: Item | null) => Boolean(it && (!slots[it.slot]!.main || slots[it.slot]!.href));

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    target.set(Math.max(-1.2, Math.min(1.2, ((e.clientX - r.left) / r.width) * 2 - 1)), Math.max(-1.6, Math.min(1.6, -(((e.clientY - r.top) / r.height) * 2 - 1))));
    over = e.target === canvas ? new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)) : null;
    hovered = over ? under(over) : null;
    canvas.style.cursor = pressable(hovered) ? 'pointer' : '';
  };
  const onLeave = () => {
    over = null;
    hovered = null;
    canvas.style.cursor = '';
  };
  const onClick = (e: PointerEvent) => {
    const it = pick(e);
    if (!it) return;
    const place = slots[it.slot]!;
    if (place.main) {
      if (place.href) window.location.href = place.href;
      return;
    }
    const now = clock.getElapsedTime();
    if (bring(it, now)) {
      // the wheel goes on turning by itself after the usual rest
      nextTurn = now + SWAP + REST;
      if (opts.still) frame(99);
    }
  };
  const onScroll = () => {
    const r = host.getBoundingClientRect();
    scrollP = Math.min(1.2, Math.max(0, (window.innerHeight * 0.45 - r.top) / Math.max(1, r.height)));
    if (opts.still) frame(99);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', onClick as EventListener);
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

  let start = -1;
  let raf = 0;
  let readyDone = false;
  function ready() {
    if (readyDone) return;
    readyDone = true;
    size();
    onScroll();
    start = clock.getElapsedTime();
    nextTurn = start + 3.4;
    opts.onReady();
    if (opts.still) frame(99);
    else loop();
  }

  const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 4);
  const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const at = new THREE.Vector3();

  function frame(t: number) {
    const since = start < 0 ? 0 : t - start;
    pointer.lerp(target, opts.still ? 1 : 0.07);
    world.rotation.y = pointer.x * 0.09;
    world.rotation.x = -pointer.y * 0.04 + scrollP * 0.16;

    if (over && !opts.still) {
      hovered = under(over);
      canvas.style.cursor = pressable(hovered) ? 'pointer' : '';
    }
    // The stage's own turn: the next card of the next group comes forward.
    // It keeps turning with the pointer resting on it; it waits only while
    // the pointer is on a card at the back, which the reader may be about to
    // press.
    const aiming = Boolean(hovered && !slots[hovered.slot]!.main);
    if (!opts.still && t > nextTurn && !moving() && !aiming && document.visibilityState === 'visible') {
      for (let n = 0; n < groups.length; n++) {
        if (turnWheel(groups[(turn + n) % groups.length]!, 1, t)) {
          turn = (turn + n + 1) % groups.length;
          break;
        }
      }
      nextTurn = t + SWAP + REST;
    }

    for (const it of items) {
      const place = slots[it.slot]!;
      // where it is: at rest in its place, or on the way to it
      if (it.t0 >= 0) {
        const p = Math.min(1, (t - it.t0) / SWAP);
        const e = inOut(p);
        const arc = Math.sin(Math.PI * p);
        it.cur.pos.lerpVectors(it.from.pos, place.pos, e);
        // the one coming forward swings out toward the reader and over; the
        // one leaving the front sinks away behind it; the rest glide round
        // to the next place with a small lift
        it.cur.pos.z += arc * (it.dir > 0 ? 2.6 : it.dir < 0 ? -1.6 : 0.6);
        it.cur.pos.y += arc * (it.dir > 0 ? 0.35 : it.dir < 0 ? -0.25 : 0.18);
        it.cur.rx = mix(it.from.rx, place.rot.x, e) - arc * 0.1 * it.dir;
        it.cur.ry = mix(it.from.ry, place.rot.y, e) + arc * (it.dir === 0 ? 0.18 : 0.5 * it.dir) * (place.pos.x < it.from.pos.x ? 1 : -1);
        it.cur.rz = mix(it.from.rz, place.rot.z, e);
        it.cur.scale = mix(it.from.scale, place.scale, e);
        it.cur.front = mix(it.from.front, place.main ? 1 : 0, e);
        if (p >= 1) {
          it.t0 = -1;
          it.cur = poseOf(place);
        }
      }
      const c = it.cur;
      const k = opts.still ? 1 : ease((since - it.delay) / 1.4);
      const depth = -c.pos.z; // 0 at the front, more for the ones behind
      const bob = opts.still ? 0 : Math.sin(t * 0.7 + it.phase) * mix(0.11, 0.05, c.front);
      it.lift += ((hovered === it && pressable(it) ? 1 : 0) - it.lift) * 0.12;
      it.group.position.set(
        // parallax: what is further away moves further, against the pointer
        c.pos.x - pointer.x * (0.12 + Math.max(0, depth) * 0.16),
        c.pos.y + bob + it.lift * 0.14 + pointer.y * Math.max(0, depth) * 0.07 + scrollP * (0.22 + Math.max(0, depth) * 0.12),
        c.pos.z - (1 - k) * 16 + it.lift * mix(1.1, 0.7, c.front),
      );
      it.group.rotation.set(c.rx + (1 - k) * 0.45, c.ry * (0.35 + 0.65 * k) * (1 - it.lift * 0.7), c.rz);
      it.group.scale.setScalar(c.scale * (1 + it.lift * mix(0.06, 0, c.front)));
      (it.face.material as THREE.MeshBasicMaterial).opacity = k;
      (it.shade.material as THREE.MeshBasicMaterial).opacity = k * (mix(0.34, 0.55, c.front) + it.lift * 0.25);
    }

    // each group's label follows whichever card is in front
    groups.forEach((g, i) => {
      const label = labels[i];
      const it = frontOf(g);
      if (!label || !it) return;
      const k = opts.still ? 1 : ease((since - it.delay) / 1.4);
      at.set(0, -it.height / 2 - 0.18, 0.05);
      it.group.localToWorld(at).project(camera);
      label.style.transform = `translate3d(${(((at.x + 1) / 2) * cw).toFixed(1)}px, ${(((1 - at.y) / 2) * ch).toFixed(1)}px, 0) translate(-50%, 0)`;
      // it steps aside while the cards change places, and returns with the new one
      label.style.opacity = String(it.t0 >= 0 ? Math.max(0, (t - it.t0) / SWAP - 0.7) / 0.3 : k);
    });
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
      canvas.removeEventListener('click', onClick as EventListener);
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
