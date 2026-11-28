/**
 * The two faces of the PVC card, drawn on canvases for the 3D card's
 * textures: the counter card (review us on Google) in saffron and chilli,
 * the table card (menu and order) in peacock teal with a faint jali. Both
 * carry real QR codes (qrdata.ts) that open the Growth page, always dark on
 * a white tile so they scan. The restaurant is the demo one the films use.
 */
import { reviewQR, tableQR } from './qrdata';

export interface FaceWords {
  frontLine: string;
  frontCall: string;
  backTable: string;
  backCall: string;
  backLine: string;
}

const BUSINESS = 'Spice Route';
const POWERED = 'Nayaversse Growth';
const LANGS = 'English · हिंदी · मराठी';

// A card is 85.6 × 54 mm.
export const FACE_W = 1280;
export const FACE_H = Math.round((FACE_W * 54) / 85.6);

const HEAD = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", "IBM Plex Sans Devanagari", system-ui, sans-serif';
const TEXT = '"Inter Variable", Inter, "IBM Plex Sans Devanagari", system-ui, sans-serif';
const INK = '#16181d';

/** The print colours, shared with the flat cards in site.css. */
export const PRINT = {
  saffron: '#f7932f',
  orange: '#e9581f',
  chilli: '#c42f1a',
  chilliText: '#b02a17',
  turmeric: '#ffd34d',
  teal: '#0f6a73',
  tealDeep: '#073b43',
  tealText: '#c4e6e6',
  tealSoft: '#8fc9cb',
  saffronSoft: '#ffb46e',
};

async function fontsReady(sample: string) {
  try {
    await Promise.all([
      document.fonts.load(`800 56px ${HEAD}`, sample),
      document.fonts.load(`700 40px ${HEAD}`, sample),
      document.fonts.load(`600 32px ${TEXT}`, sample),
      document.fonts.load(`500 28px ${TEXT}`, sample),
    ]);
  } catch {
    /* the system face draws instead */
  }
}

/** A face canvas `k` times the drawing size; drawing stays in FACE_W units. */
function canvas(k: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.round(FACE_W * k);
  c.height = Math.round(FACE_H * k);
  const g = c.getContext('2d')!;
  g.scale(k, k);
  return [c, g];
}

/** Lines of text no wider than max. */
function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A QR code on a white tile, with its four-module quiet zone. */
function qr(g: CanvasRenderingContext2D, rows: string[], x: number, y: number, size: number) {
  g.fillStyle = '#ffffff';
  roundRect(g, x, y, size, size, size * 0.06);
  g.fill();
  const n = rows.length + 8;
  const cell = size / n;
  g.fillStyle = INK;
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (row[c] !== '1') {
        c++;
        continue;
      }
      let run = 1;
      while (row[c + run] === '1') run++;
      // a hair of overlap so no seams show between modules
      g.fillRect(x + (c + 4) * cell, y + (r + 4) * cell, run * cell + 0.6, cell + 0.6);
      c += run;
    }
  });
}

function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.46;
    g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  g.closePath();
  g.fill();
}

/** A jali: overlapping circles on a triangular grid, the lattice of a stone screen. */
function jali(g: CanvasRenderingContext2D, r: number, color: string) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 2;
  const dy = (r * Math.sqrt(3)) / 2;
  for (let j = -1; j * dy < FACE_H + r; j++) {
    for (let i = -1; i * r < FACE_W + r; i++) {
      g.beginPath();
      g.arc(i * r + (j % 2 ? r / 2 : 0), j * dy, r, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.restore();
}

/** A small arrow pointing right, toward the code. */
function arrow(g: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 4.5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.moveTo(x + w - 11, y - 10);
  g.lineTo(x + w, y);
  g.lineTo(x + w - 11, y + 10);
  g.stroke();
  g.restore();
}

/**
 * Both faces, `width` pixels wide: about the size the card shows at on this
 * screen, so text and the codes stay sharp instead of being shrunk to grey.
 */
export async function drawFaces(w: FaceWords, width = FACE_W): Promise<{ front: HTMLCanvasElement; back: HTMLCanvasElement }> {
  const k = width / FACE_W;
  await fontsReady(`${w.frontLine} ${w.frontCall} ${w.backTable} ${w.backCall} ${LANGS}`);
  const pad = 84;
  const qrSize = 470;
  const qrX = FACE_W - pad - qrSize;
  const qrY = (FACE_H - qrSize) / 2;
  const textW = qrX - pad - 48;

  // the counter card: saffron into chilli
  const [front, gf] = canvas(k);
  {
    const g = gf;
    const bg = g.createLinearGradient(0, 0, FACE_W, FACE_H);
    bg.addColorStop(0, PRINT.saffron);
    bg.addColorStop(0.55, PRINT.orange);
    bg.addColorStop(1, PRINT.chilli);
    g.fillStyle = bg;
    g.fillRect(0, 0, FACE_W, FACE_H);
    // a soft sheen where the light falls on the print
    const sheen = g.createRadialGradient(FACE_W * 0.18, FACE_H * 0.08, 0, FACE_W * 0.18, FACE_H * 0.08, FACE_W * 0.7);
    sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, FACE_W, FACE_H);

    g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffffff';
    g.font = `800 50px ${HEAD}`;
    g.fillText(BUSINESS, pad, pad + 40);
    g.fillStyle = PRINT.turmeric;
    g.fillRect(pad, pad + 66, 64, 6);

    g.fillStyle = '#ffffff';
    g.font = `800 66px ${HEAD}`;
    let y = pad + 190;
    for (const line of wrap(g, w.frontLine, textW).slice(0, 2)) {
      g.fillText(line, pad, y);
      y += 78;
    }
    g.fillStyle = PRINT.turmeric;
    for (let i = 0; i < 5; i++) star(g, pad + 30 + i * 70, y + 4, 30);

    // the call, on a white button that points at the code
    const padX = 30;
    const padY = 18;
    const lh = 44;
    const arrowW = 30;
    g.font = `700 33px ${TEXT}`;
    const lines = wrap(g, w.frontCall, textW - padX * 2 - arrowW - 16).slice(0, 2);
    const lineW = Math.max(...lines.map((l) => g.measureText(l).width));
    const pillW = Math.min(textW, lineW + padX * 2 + arrowW + 16);
    const pillH = padY * 2 + lh * lines.length;
    const top = y + 74;
    g.fillStyle = '#ffffff';
    roundRect(g, pad, top, pillW, pillH, Math.min(pillH / 2, 40));
    g.fill();
    g.fillStyle = PRINT.chilliText;
    g.textBaseline = 'middle';
    lines.forEach((line, i) => g.fillText(line, pad + padX, top + padY + lh / 2 + i * lh + 1));
    arrow(g, pad + pillW - padX - arrowW, top + pillH / 2, arrowW, PRINT.chilliText);
    g.textBaseline = 'alphabetic';

    g.fillStyle = 'rgba(255,255,255,0.78)';
    g.font = `500 26px ${TEXT}`;
    g.fillText(POWERED, pad, FACE_H - pad + 8);
    qr(g, reviewQR.rows, qrX, qrY, qrSize);
  }

  // the table card: peacock teal, a faint jali, the code in a saffron frame
  const [back, gb] = canvas(k);
  {
    const g = gb;
    const bg = g.createLinearGradient(0, 0, FACE_W * 0.7, FACE_H * 1.1);
    bg.addColorStop(0, PRINT.teal);
    bg.addColorStop(1, PRINT.tealDeep);
    g.fillStyle = bg;
    g.fillRect(0, 0, FACE_W, FACE_H);
    jali(g, 72, 'rgba(255,255,255,0.055)');

    g.fillStyle = PRINT.saffronSoft;
    g.font = `700 34px ${HEAD}`;
    g.fillText(BUSINESS, pad, pad + 30);
    g.fillStyle = '#ffffff';
    g.font = `800 120px ${HEAD}`;
    g.fillText(w.backTable, pad, pad + 190);
    g.font = `700 50px ${HEAD}`;
    let y = pad + 280;
    for (const line of wrap(g, w.backCall, textW).slice(0, 2)) {
      g.fillText(line, pad, y);
      y += 60;
    }
    g.fillStyle = PRINT.tealText;
    g.font = `500 32px ${TEXT}`;
    y += 6;
    for (const line of wrap(g, w.backLine, textW).slice(0, 2)) {
      g.fillText(line, pad, y);
      y += 42;
    }
    g.fillStyle = PRINT.saffron;
    g.fillRect(pad, FACE_H - pad - 44, 64, 6);
    g.fillStyle = PRINT.tealSoft;
    g.font = `500 28px ${TEXT}`;
    g.fillText(LANGS, pad, FACE_H - pad + 8);

    const frame = 14;
    g.fillStyle = PRINT.saffron;
    roundRect(g, qrX - frame, qrY - frame, qrSize + frame * 2, qrSize + frame * 2, qrSize * 0.06 + frame);
    g.fill();
    qr(g, tableQR.rows, qrX, qrY, qrSize);
  }
  return { front, back };
}

/** An SVG path for a QR code, runs of dark modules merged, quiet zone included. */
export function qrPath(rows: string[]): { d: string; size: number } {
  const size = rows.length + 8;
  let d = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '1') {
        x++;
        continue;
      }
      let run = 1;
      while (row[x + run] === '1') run++;
      d += `M${x + 4} ${y + 4}h${run}v1h-${run}z`;
      x += run;
    }
  });
  return { d, size };
}

export { BUSINESS, LANGS, POWERED };
