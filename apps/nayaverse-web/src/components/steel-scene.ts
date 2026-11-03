import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector3, WebGLRenderer } from 'three';

/**
 * The coach's cladding, lit.
 *
 * The CSS ground already draws the ribs as a flat pattern; this draws the
 * same steel as a surface. Vertical ribs every 7px (the CSS period, so the
 * two agree where one hands over to the other), a riveted panel seam every
 * 420px that travels with the page as cladding passes a person walking
 * beside a coach, and one warm lamp raking across it from wherever the
 * pointer is. Contrast stays low: this is the material between panels,
 * not a pattern competing with them.
 *
 * Everything is computed in the fragment shader from the pixel position --
 * no textures, nothing to download but the renderer. Colours are worked in
 * sRGB to match the stylesheet's hex values exactly, so the canvas can fade
 * over the CSS ground without a visible step.
 *
 * It draws only when something changed: the lamp easing toward the pointer,
 * a scroll, a resize. A still page costs nothing.
 */

const VERTEX = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;      // viewport, CSS px
  uniform float uDpr;
  uniform float uScroll;  // page scroll, CSS px
  uniform vec3 uLamp;     // lamp: x, y from the viewport's top-left in CSS px, height
  uniform vec3 uDeep;     // --steel-deep
  uniform vec3 uRivet;    // --steel-rivet
  uniform vec3 uWarm;     // the lamp's colour

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 p = gl_FragCoord.xy / uDpr;
    p.y = uRes.y - p.y;
    vec2 w = vec2(p.x, p.y + uScroll);

    // Rib profile: a rounded ridge every 7px. Its slope tilts the normal.
    float rib = fract(w.x / 7.0);
    float slopeX = sin(rib * 6.2831853) * 0.42;

    // A seam every 420px: a shallow groove, with rivets every 42px on it.
    float sy = mod(w.y, 420.0) - 210.0;
    float slopeY = -sy * exp(-sy * sy / 6.0) * 0.18;
    vec2 rv = vec2(mod(w.x, 42.0) - 21.0, sy + 9.0);
    float r = length(rv);
    float rivet = smoothstep(3.2, 2.2, r);
    vec2 rn = rivet * rv / max(r, 0.001) * 0.6;

    vec3 n = normalize(vec3(-slopeX + rn.x, -slopeY + rn.y, 1.0));

    vec3 toLamp = uLamp - vec3(p, 0.0);
    vec3 L = normalize(toLamp);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float dist = length(toLamp.xy);
    float fall = 1.0 / (1.0 + dist * dist / (uLamp.z * uLamp.z * 5.0));

    float diffuse = max(dot(n, L), 0.0);
    float spec = pow(max(dot(n, H), 0.0), 36.0);

    vec3 col = mix(uDeep, uRivet * 0.55, rivet * 0.5);
    col += uDeep * 0.55 * diffuse * fall;
    col += uWarm * (spec * 0.11 + diffuse * 0.03) * fall;

    // A grain of noise, so the falloff never bands on an 8-bit screen.
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function cssColour(name: string, fallback: string): Vector3 {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const hex = raw.replace('#', '');
  const v = parseInt(hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex, 16);
  return new Vector3(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

export interface SteelScene {
  dispose(): void;
}

export function createSteelScene(host: HTMLElement, options: { follow: boolean; onReady: () => void }): SteelScene {
  const renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
  const dpr = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const lamp = cssColour('--lamp', '#eba63f');
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uRes: { value: [1, 1] },
      uDpr: { value: dpr },
      uScroll: { value: 0 },
      uLamp: { value: new Vector3() },
      uDeep: { value: cssColour('--steel-deep', '#0d1115') },
      uRivet: { value: cssColour('--steel-rivet', '#55626c') },
      // The lamp's amber, lifted toward white: a bulb behind glass.
      uWarm: { value: lamp.clone().lerp(new Vector3(1, 1, 1), 0.45) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const size = { w: 1, h: 1 };
  // Where the lamp rests when nobody is pointing: high over the top centre,
  // the CSS ground's warm wash, made a real light.
  const rest = () => ({ x: size.w * 0.5, y: -size.h * 0.15, z: Math.max(size.w, size.h) * 0.55 });
  const at = { ...rest() };
  let target = { ...at };
  let frame = 0;

  const draw = () => {
    const u = material.uniforms;
    (u.uRes as { value: number[] }).value = [size.w, size.h];
    (u.uScroll as { value: number }).value = window.scrollY;
    (u.uLamp as { value: Vector3 }).value.set(at.x, at.y, at.z);
    renderer.render(scene, camera);
    publish();
  };

  // Ease the lamp toward its target, drawing each step, and stop once it
  // has arrived.
  const step = () => {
    frame = 0;
    const k = 0.12;
    at.x += (target.x - at.x) * k;
    at.y += (target.y - at.y) * k;
    at.z += (target.z - at.z) * k;
    draw();
    if (Math.abs(target.x - at.x) + Math.abs(target.y - at.y) + Math.abs(target.z - at.z) > 0.5) {
      frame = requestAnimationFrame(step);
    }
  };
  const kick = () => {
    if (!frame) frame = requestAnimationFrame(step);
  };

  const resize = () => {
    size.w = window.innerWidth;
    size.h = window.innerHeight;
    renderer.setSize(size.w, size.h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    if (!options.follow) Object.assign(at, rest());
    target = options.follow ? target : rest();
    draw();
  };

  // The boards pick up the same lamp, through two custom properties set
  // on the boards themselves: set on the root, every frame of the lamp's
  // ease would restyle the whole document.
  const root = document.documentElement;
  const boards = Array.from(document.querySelectorAll<HTMLElement>('.board'));
  const publish = () => {
    for (const b of boards) {
      b.style.setProperty('--lamp-x', `${at.x.toFixed(0)}px`);
      b.style.setProperty('--lamp-y', `${at.y.toFixed(0)}px`);
    }
  };

  const onPointer = (e: PointerEvent) => {
    // Low over the surface, so it rakes across the ribs rather than
    // shining straight down on them.
    target = { x: e.clientX, y: e.clientY, z: Math.max(size.w, size.h) * 0.2 };
    kick();
  };
  const onLeave = () => {
    target = rest();
    kick();
  };
  let scrolling = 0;
  const onScroll = () => {
    if (!scrolling) {
      scrolling = requestAnimationFrame(() => {
        scrolling = 0;
        draw();
      });
    }
  };

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', onScroll, { passive: true });
  if (options.follow) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }
  root.classList.add('lamp-on');
  resize();
  options.onReady();

  return {
    dispose() {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrolling);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      root.classList.remove('lamp-on');
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
