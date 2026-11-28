/**
 * Growth's PVC card in three.js: a white plastic card, its counter face (a
 * review on Google) in front and its table face (menu and order) behind,
 * with real QR codes on both. Drag sideways to turn it (a vertical swipe
 * still scrolls the page), tap or press "Turn it over" to flip it. Left
 * alone it sways a little; for anyone whose device asks for less motion it
 * stays still and moves only when moved. It draws only while on screen.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface CardHandle {
  flip: () => void;
  dispose: () => void;
}

// 85.6 × 54 mm, with the thickness of a PVC card drawn a little fuller so its edge reads
const W = 3.37;
const H = 2.125;
const R = 0.14;
const DEPTH = 0.045;
const BEVEL = 0.006;

function cardShape() {
  const s = new THREE.Shape();
  const x = -W / 2;
  const y = -H / 2;
  s.moveTo(x + R, y);
  s.lineTo(x + W - R, y);
  s.quadraticCurveTo(x + W, y, x + W, y + R);
  s.lineTo(x + W, y + H - R);
  s.quadraticCurveTo(x + W, y + H, x + W - R, y + H);
  s.lineTo(x + R, y + H);
  s.quadraticCurveTo(x, y + H, x, y + H - R);
  s.lineTo(x, y + R);
  s.quadraticCurveTo(x, y, x + R, y);
  return s;
}

/** A face the size of the card, its texture spread over the whole of it. */
function faceGeometry(shape: THREE.Shape) {
  const g = new THREE.ShapeGeometry(shape, 12);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + H / 2) / H);
  uv.needsUpdate = true;
  return g;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grd.addColorStop(0, 'rgba(22,24,29,0.55)');
  grd.addColorStop(0.55, 'rgba(22,24,29,0.16)');
  grd.addColorStop(1, 'rgba(22,24,29,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function mountCard(
  host: HTMLElement,
  faces: { front: HTMLCanvasElement; back: HTMLCanvasElement },
  opts: { still: boolean; onReady: () => void; onSide?: (front: boolean) => void },
): CardHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // no tone curve: the print keeps its own whites and blacks, as on paper
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'v-pvc-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-3, 4, 6);
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dadc, 0.85));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // the card
  const shape = cardShape();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 2, curveSegments: 12 });
  bodyGeo.translate(0, 0, -DEPTH / 2);
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.45, envMapIntensity: 0.8 });
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  };
  const frontTex = tex(faces.front);
  const backTex = tex(faces.back);
  const faceGeo = faceGeometry(shape);
  // A matte print, as on a real card: no sheen to lift its blacks to grey.
  // Most of its light is its own, so face on it shows the colours exactly as
  // drawn (measured off a render: the room's lights alone give it about 2.4
  // times its colour, so they get a sixth of that); the rest comes from the
  // lights, so it shades as it turns. The QR codes stay black at any angle.
  const printMat = (map: THREE.Texture) =>
    new THREE.MeshLambertMaterial({ map, color: new THREE.Color(0.16, 0.16, 0.16), emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.62 });
  const frontMat = printMat(frontTex);
  const backMat = printMat(backTex);
  const card = new THREE.Group();
  card.add(new THREE.Mesh(bodyGeo, bodyMat));
  const front = new THREE.Mesh(faceGeo, frontMat);
  front.position.z = DEPTH / 2 + BEVEL + 0.0006;
  card.add(front);
  const back = new THREE.Mesh(faceGeo, backMat);
  back.rotation.y = Math.PI;
  back.position.z = -(DEPTH / 2 + BEVEL + 0.0006);
  card.add(back);
  scene.add(card);

  // a soft shadow on the ground below it
  const shadowTex = shadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.25, 1.1), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -H / 2 - 0.42;
  scene.add(shadow);

  // where it is, and where it is going
  let rotY = opts.still ? 0 : -0.95;
  let targetY = 0;
  let rotX = 0;
  let targetX = 0;
  let hoverX = 0;
  let hoverY = 0;
  let lastTouch = performance.now();
  let lastFront = true;
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let startTarget = 0;
  let lastDx = 0;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  let settled = false;

  const fit = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const v = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
    const zw = (W * 1.16) / 2 / Math.tan(hfov / 2);
    const zh = (H * 1.8) / 2 / Math.tan(v / 2);
    camera.position.set(0, 0.35, Math.max(zw, zh));
    camera.lookAt(0, -0.05, 0);
    camera.updateProjectionMatrix();
    wake();
  };

  const flip = () => {
    targetY = Math.round(targetY / Math.PI) * Math.PI + Math.PI;
    lastTouch = performance.now();
    wake();
  };

  const onDown = (e: PointerEvent) => {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startTarget = targetY;
    lastDx = 0;
    lastTouch = performance.now();
    wake();
  };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (dragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dy) > Math.abs(dx) + 4 && e.pointerType !== 'mouse') {
        // a vertical swipe on a phone: the page scrolls, the card stays
        dragging = false;
        return;
      }
      if (Math.abs(dx) > 6) moved = true;
      if (moved && !canvas.hasPointerCapture(e.pointerId)) canvas.setPointerCapture(e.pointerId);
      lastDx = dx - (targetY - startTarget) / 0.011;
      targetY = startTarget + dx * 0.011;
      targetX = THREE.MathUtils.clamp(dy * 0.003, -0.3, 0.3);
      lastTouch = performance.now();
      wake();
    } else if (e.pointerType === 'mouse') {
      hoverY = ((e.clientX - r.left) / r.width - 0.5) * 0.28;
      hoverX = ((e.clientY - r.top) / r.height - 0.5) * 0.18;
      wake();
    }
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    targetX = 0;
    if (!moved) return flip();
    // it comes to rest on a face, carried on by a flick
    const bias = THREE.MathUtils.clamp(lastDx * 0.02, -0.6, 0.6);
    targetY = Math.round((targetY + bias) / Math.PI) * Math.PI;
    lastTouch = performance.now();
    wake();
  };
  const onLeave = () => {
    hoverX = hoverY = 0;
    wake();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = 1 - Math.exp(-dt * 7);
    const idle = !opts.still && !dragging && now - lastTouch > 2600;
    const t = now / 1000;
    const swayY = idle ? Math.sin(t * 0.55) * 0.22 : 0;
    const swayX = idle ? Math.sin(t * 0.8) * 0.05 : 0;
    rotY += (targetY + swayY + hoverY - rotY) * k;
    rotX += (targetX + swayX + hoverX - rotX) * k;
    card.rotation.set(rotX, rotY, 0);
    card.position.y = opts.still ? 0 : Math.sin(t * 1.1) * 0.05;
    const facing = Math.abs(Math.cos(rotY));
    shadow.scale.set(0.5 + 0.5 * facing, 1, 1);
    shadowMat.opacity = 0.55 + 0.3 * facing;
    renderer.render(scene, camera);
    const isFront = Math.cos(targetY) > 0;
    if (isFront !== lastFront) {
      lastFront = isFront;
      opts.onSide?.(isFront);
    }
    if (!settled) {
      settled = true;
      opts.onReady();
    }
    const resting = Math.abs(targetY + swayY + hoverY - rotY) < 0.0005 && Math.abs(targetX + swayX + hoverX - rotX) < 0.0005;
    if (visible && (!resting || idle || !opts.still)) raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (!raf && visible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting && document.visibilityState === 'visible';
    if (visible) wake();
  });
  io.observe(host);
  const onVis = () => {
    visible = document.visibilityState === 'visible' && host.getBoundingClientRect().bottom > 0;
    if (visible) wake();
  };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();

  return {
    flip,
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      [bodyGeo, faceGeo, shadow.geometry].forEach((g) => g.dispose());
      [bodyMat, frontMat, backMat, shadowMat].forEach((m) => m.dispose());
      [frontTex, backTex, shadowTex, env].forEach((x) => x.dispose());
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
