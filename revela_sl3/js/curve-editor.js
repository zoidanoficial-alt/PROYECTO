// Editor interactivo de la curva de tonos (clic = punto nuevo, arrastrar =
// mover, doble clic = borrar).

import { curveLut } from './curve.js';

const COLORS = { master: '#e8e8e8', r: '#ff6b6b', g: '#5fd47a', b: '#6aa8ff' };

export class CurveEditor {
  constructor(canvas, onChange) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange;
    this.channel = 'master';
    this.curve = null;
    this.drag = -1;
    this.hist = null;
    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerup', (e) => this._up(e));
    canvas.addEventListener('pointercancel', (e) => this._up(e));
    canvas.addEventListener('dblclick', (e) => this._dbl(e));
  }

  set(curve, hist) {
    this.curve = curve;
    if (hist) this.hist = hist;
    this.draw();
  }

  _pos(e) {
    const r = this.c.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)),
    ];
  }

  _hit(x, y) {
    const pts = this.curve[this.channel];
    let best = -1;
    let bd = 0.05;
    pts.forEach(([px, py], i) => {
      const d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  _down(e) {
    if (!this.curve) return;
    const [x, y] = this._pos(e);
    let i = this._hit(x, y);
    const pts = this.curve[this.channel];
    if (i < 0) {
      pts.push([x, y]);
      pts.sort((a, b) => a[0] - b[0]);
      i = pts.findIndex((p) => p[0] === x && p[1] === y);
    }
    this.drag = i;
    this.c.setPointerCapture(e.pointerId);
    this.onChange(false);
    this.draw();
  }

  _move(e) {
    if (this.drag < 0) return;
    const pts = this.curve[this.channel];
    let [x, y] = this._pos(e);
    const i = this.drag;
    const lo = i > 0 ? pts[i - 1][0] + 0.01 : 0;
    const hi = i < pts.length - 1 ? pts[i + 1][0] - 0.01 : 1;
    if (i === 0) x = Math.min(x, hi);
    else if (i === pts.length - 1) x = Math.max(x, lo);
    else x = Math.min(hi, Math.max(lo, x));
    pts[i] = [x, y];
    this.onChange(false);
    this.draw();
  }

  _up() {
    if (this.drag < 0) return;
    this.drag = -1;
    this.onChange(true);
  }

  _dbl(e) {
    const [x, y] = this._pos(e);
    const pts = this.curve[this.channel];
    const i = this._hit(x, y);
    if (i > 0 && i < pts.length - 1) {
      pts.splice(i, 1);
      this.onChange(true);
      this.draw();
    }
  }

  draw() {
    const { ctx, c } = this;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1b1c1f';
    ctx.fillRect(0, 0, w, h);
    if (this.hist) {
      const hh = this.hist[this.channel === 'master' ? 'l' : this.channel];
      let max = 1;
      for (let i = 2; i < 254; i++) max = Math.max(max, hh[i]);
      ctx.fillStyle = '#2c2e33';
      for (let i = 0; i < 256; i++) {
        const v = Math.min(1, hh[i] / max) * h * 0.9;
        ctx.fillRect((i / 256) * w, h - v, w / 256 + 0.5, v);
      }
    }
    ctx.strokeStyle = '#33353a';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.strokeStyle = '#3d4046'; ctx.stroke();
    if (!this.curve) return;
    const pts = this.curve[this.channel];
    const lut = curveLut(pts, w);
    ctx.beginPath();
    for (let i = 0; i < w; i++) {
      const y = h - lut[i] * h;
      if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
    }
    ctx.strokeStyle = COLORS[this.channel];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS[this.channel];
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(x * w, h - y * h, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
