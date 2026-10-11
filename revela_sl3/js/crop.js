// Recorte y enderezado. El recorte vive en el "espacio enderezado": primero se
// gira la foto `angle` grados alrededor de su centro y luego se recorta.

export const ASPECTS = {
  free: { label: 'Libre', ratio: null },
  original: { label: 'Original (3:2 SL3)', ratio: 'orig' },
  '1:1': { label: '1:1 (Instagram)', ratio: 1 },
  '4:5': { label: '4:5 (retrato redes)', ratio: 4 / 5 },
  '5:4': { label: '5:4', ratio: 5 / 4 },
  '16:9': { label: '16:9', ratio: 16 / 9 },
  '9:16': { label: '9:16 (historias)', ratio: 9 / 16 },
};

export function aspectRatio(key, W, H) {
  const a = ASPECTS[key];
  if (!a || a.ratio === null) return null;
  return a.ratio === 'orig' ? W / H : a.ratio;
}

/** ¿El punto (u,v) del espacio enderezado cae dentro de la foto original? */
export function inside(u, v, W, H, angleDeg) {
  const t = (angleDeg * Math.PI) / 180;
  const dx = u * W - W / 2;
  const dy = v * H - H / 2;
  const sx = Math.cos(t) * dx + Math.sin(t) * dy + W / 2;
  const sy = -Math.sin(t) * dx + Math.cos(t) * dy + H / 2;
  const eps = 0.5;
  return sx >= -eps && sy >= -eps && sx <= W + eps && sy <= H + eps;
}

function cornersInside(c, W, H) {
  return [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]]
    .every(([u, v]) => inside(u, v, W, H, c.angle));
}

/** Encoge el recorte (desde su centro) hasta que no muestre esquinas vacías. */
export function fitCrop(crop, W, H) {
  const c = { ...crop };
  c.w = Math.min(1, Math.max(0.02, c.w));
  c.h = Math.min(1, Math.max(0.02, c.h));
  c.x = Math.min(1 - c.w, Math.max(0, c.x));
  c.y = Math.min(1 - c.h, Math.max(0, c.y));
  if (cornersInside(c, W, H)) return c;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const s = (lo + hi) / 2;
    const t = { ...c, w: c.w * s, h: c.h * s, x: cx - (c.w * s) / 2, y: cy - (c.h * s) / 2 };
    if (cornersInside(t, W, H)) lo = s; else hi = s;
  }
  // Si aun centrado no cabe, recentrar en la foto.
  let out = { ...c, w: c.w * lo, h: c.h * lo, x: cx - (c.w * lo) / 2, y: cy - (c.h * lo) / 2 };
  if (lo < 0.05) out = fitCrop({ ...c, x: 0.5 - c.w / 2, y: 0.5 - c.h / 2 }, W, H);
  return out;
}

/** Ajusta el recorte a una proporción (en píxeles) conservando el centro. */
export function withAspect(crop, ratio, W, H) {
  if (!ratio) return crop;
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  let wPx = crop.w * W;
  let hPx = crop.h * H;
  if (wPx / hPx > ratio) wPx = hPx * ratio; else hPx = wPx / ratio;
  const w = wPx / W;
  const h = hPx / H;
  return fitCrop({ ...crop, w, h, x: cx - w / 2, y: cy - h / 2 }, W, H);
}

/** Recorte más grande posible con la proporción dada para un ángulo. */
export function maxCrop(angle, ratio, W, H) {
  let c = { x: 0, y: 0, w: 1, h: 1, angle };
  if (ratio) c = withAspect(c, ratio, W, H);
  return fitCrop(c, W, H);
}

/** Controlador del rectángulo de recorte sobre el lienzo. */
export class CropOverlay {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    this.box = document.createElement('div');
    this.box.className = 'crop-box';
    this.box.innerHTML = '<div class="thirds"></div>' +
      ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<i data-h="${h}"></i>`).join('');
    root.appendChild(this.box);
    this.crop = null;
    this.size = [1, 1];
    this.ratio = null;
    this.box.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e));
    window.addEventListener('pointerup', () => this._up());
  }

  show(crop, W, H, ratio) {
    this.crop = { ...crop };
    this.size = [W, H];
    this.ratio = ratio;
    this.root.hidden = false;
    this._layout();
  }

  hide() { this.root.hidden = true; }

  _layout() {
    const c = this.crop;
    Object.assign(this.box.style, {
      left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`,
    });
  }

  _down(e) {
    e.preventDefault();
    const r = this.root.getBoundingClientRect();
    this.drag = { h: e.target.dataset.h || 'move', x: e.clientX, y: e.clientY, start: { ...this.crop }, r };
  }

  _move(e) {
    const d = this.drag;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.r.width;
    const dy = (e.clientY - d.y) / d.r.height;
    const s = d.start;
    let c = { ...s };
    if (d.h === 'move') {
      c.x = Math.min(1 - s.w, Math.max(0, s.x + dx));
      c.y = Math.min(1 - s.h, Math.max(0, s.y + dy));
    } else {
      let x0 = s.x; let y0 = s.y; let x1 = s.x + s.w; let y1 = s.y + s.h;
      if (d.h.includes('w')) x0 = Math.min(x1 - 0.03, s.x + dx);
      if (d.h.includes('e')) x1 = Math.max(x0 + 0.03, s.x + s.w + dx);
      if (d.h.includes('n')) y0 = Math.min(y1 - 0.03, s.y + dy);
      if (d.h.includes('s')) y1 = Math.max(y0 + 0.03, s.y + s.h + dy);
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(1, x1); y1 = Math.min(1, y1);
      c = { ...s, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      if (this.ratio) {
        const [W, H] = this.size;
        const want = this.ratio;
        // Mantiene la proporción ajustando el lado "secundario" del arrastre.
        if (d.h === 'n' || d.h === 's') {
          const w = (c.h * H * want) / W;
          c.x = s.x + s.w / 2 - w / 2; c.w = w;
        } else {
          const h = (c.w * W) / want / H;
          if (d.h.includes('n')) c.y = y1 - h;
          else if (!d.h.includes('s')) c.y = s.y + s.h / 2 - h / 2;
          c.h = h;
        }
      }
    }
    this.crop = c;
    this._layout();
    this.onChange(c, false);
  }

  _up() {
    if (!this.drag) return;
    this.drag = null;
    const [W, H] = this.size;
    this.crop = fitCrop(this.crop, W, H);
    this._layout();
    this.onChange(this.crop, true);
  }
}
