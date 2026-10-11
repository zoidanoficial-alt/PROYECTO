// Motor de revelado en GPU (WebGL2). Todo el procesamiento ocurre en el
// equipo del usuario; las fotos nunca salen del navegador.

import { VERT, BLUR, DOWN, MAIN, FINAL } from './shaders.js';
import { packCurves, isIdentity } from './curve.js';
import { wbMultipliers } from './analysis.js';
import { HSL_RANGES } from './params.js';

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u: uniforms };
}

export class Engine {
  constructor(canvas, { preserve = true } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      preserveDrawingBuffer: preserve, antialias: false, premultipliedAlpha: false, alpha: false,
    });
    if (!gl) throw new Error('Tu navegador no soporta WebGL2. Usa Chrome, Edge, Firefox o Safari recientes.');
    this.gl = gl;
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.progs = {
      blur: program(gl, BLUR),
      down: program(gl, DOWN),
      main: program(gl, MAIN),
      final: program(gl, FINAL),
    };
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.curveTex = this._tex(256, 1, null);
    this.curveKey = '';
    this.src = null;
  }

  _tex(w, h, data) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return t;
  }

  _target(w, h) {
    const gl = this.gl;
    const tex = this._tex(w, h, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  _free(t) {
    if (!t) return;
    this.gl.deleteTexture(t.tex);
    this.gl.deleteFramebuffer(t.fb);
  }

  _draw(prog, target, setup) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : this.canvas.width, target ? target.h : this.canvas.height);
    setup(prog.u);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  _bind(unit, tex, loc) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  /**
   * @param source ImageBitmap/canvas ya orientado.
   * @param fullWidth ancho de la foto original (para escalar radios en píxeles).
   */
  setSource(source, fullWidth) {
    const gl = this.gl;
    if (this.src) {
      gl.deleteTexture(this.src.tex);
      [this.blurA, this.blurS, this.downT, this.blurL1, this.blurL, this.readT].forEach((t) => this._free(t));
      if (this.outs) { this.outs.forEach((t) => this._free(t)); this.outs.clear(); }
      this.readT = null;
    }
    const w = source.width;
    const h = source.height;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const tex = this._tex(w, h, null);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.src = { tex, w, h, scale: w / (fullWidth || w) };
    this.blurA = this._target(w, h);
    this.blurS = this._target(w, h);
    const lw = Math.max(8, Math.round(w / 8));
    const lh = Math.max(8, Math.round(h / 8));
    this.downT = this._target(lw, lh);
    this.blurL1 = this._target(lw, lh);
    this.blurL = this._target(lw, lh);
    this.blurSigma = -1;
    this._largeBlur();
  }

  _largeBlur() {
    const { w, h, tex } = this.src;
    const gl = this.gl;
    this._draw(this.progs.down, this.downT, (u) => {
      this._bind(0, tex, u.uTex);
      gl.uniform2f(u.uTexel, 1 / w, 1 / h);
      gl.uniform1f(u.uStep, w / this.downT.w / 4);
    });
    const sigma = 4.0;
    this._draw(this.progs.blur, this.blurL1, (u) => {
      this._bind(0, this.downT.tex, u.uTex);
      gl.uniform2f(u.uDir, 1 / this.downT.w, 0);
      gl.uniform1f(u.uSigma, sigma);
    });
    this._draw(this.progs.blur, this.blurL, (u) => {
      this._bind(0, this.blurL1.tex, u.uTex);
      gl.uniform2f(u.uDir, 0, 1 / this.downT.h);
      gl.uniform1f(u.uSigma, sigma);
    });
  }

  _smallBlur(radius) {
    const sigma = Math.max(0.5, radius * this.src.scale);
    if (Math.abs(sigma - this.blurSigma) < 1e-3) return;
    this.blurSigma = sigma;
    const gl = this.gl;
    const { w, h, tex } = this.src;
    this._draw(this.progs.blur, this.blurA, (u) => {
      this._bind(0, tex, u.uTex);
      gl.uniform2f(u.uDir, 1 / w, 0);
      gl.uniform1f(u.uSigma, sigma);
    });
    this._draw(this.progs.blur, this.blurS, (u) => {
      this._bind(0, this.blurA.tex, u.uTex);
      gl.uniform2f(u.uDir, 0, 1 / h);
      gl.uniform1f(u.uSigma, sigma);
    });
  }

  _curves(curve) {
    const key = JSON.stringify(curve);
    if (key === this.curveKey) return;
    this.curveKey = key;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, packCurves(curve));
  }

  /** Tamaño de salida (en píxeles de la textura cargada) para un recorte dado. */
  outputSize(params, scale = 1) {
    const { w, h } = this.src;
    return {
      width: Math.max(1, Math.round(params.crop.w * w * scale)),
      height: Math.max(1, Math.round(params.crop.h * h * scale)),
    };
  }

  /**
   * Revela con `params`. Si `opts.target` es 'canvas' dibuja en el lienzo;
   * si es 'pixels' devuelve un Uint8Array RGBA (filas de abajo hacia arriba).
   */
  render(params, opts = {}) {
    if (!this.src) return null;
    const gl = this.gl;
    const width = opts.width || this.canvas.width;
    const height = opts.height || this.canvas.height;
    const crop = opts.noCrop ? { x: 0, y: 0, w: 1, h: 1, angle: params.crop.angle } : params.crop;
    this._smallBlur(params.sharpenRadius);
    this._curves(params.curve);
    // Caché pequeña de destinos por tamaño (vista, histograma, análisis).
    this.outs = this.outs || new Map();
    const okey = `${width}x${height}`;
    let mainOut = this.outs.get(okey);
    if (!mainOut) {
      if (this.outs.size >= 3) {
        const [k, t] = this.outs.entries().next().value;
        this._free(t);
        this.outs.delete(k);
      }
      mainOut = this._target(width, height);
      this.outs.set(okey, mainOut);
    }
    this.mainOut = mainOut;
    const P = params;
    const wb = wbMultipliers(P.temperature, P.tint);
    const curveOn = !['master', 'r', 'g', 'b'].every((k) => isIdentity(P.curve[k]));
    this._draw(this.progs.main, this.mainOut, (u) => {
      this._bind(0, this.src.tex, u.uSrc);
      this._bind(1, this.blurS.tex, u.uBlurS);
      this._bind(2, this.blurL.tex, u.uBlurL);
      this._bind(3, this.curveTex, u.uCurve);
      gl.uniform2f(u.uSrcSize, this.src.w, this.src.h);
      gl.uniform4f(u.uCrop, crop.x, crop.y, crop.w, crop.h);
      gl.uniform1f(u.uAngle, (crop.angle * Math.PI) / 180);
      gl.uniform2f(u.uOutSize, width, height);
      gl.uniform1i(u.uBicubic, width > crop.w * this.src.w * 1.05 ? 1 : 0);
      gl.uniform1i(u.uBypass, opts.before ? 1 : 0);
      gl.uniform1f(u.uPixScale, this.src.scale);
      gl.uniform1f(u.uExposure, P.exposure);
      gl.uniform1f(u.uContrast, P.contrast / 100);
      gl.uniform1f(u.uHighlights, P.highlights / 100);
      gl.uniform1f(u.uShadows, P.shadows / 100);
      gl.uniform1f(u.uWhites, P.whites / 100);
      gl.uniform1f(u.uBlacks, P.blacks / 100);
      gl.uniform3f(u.uWb, wb[0], wb[1], wb[2]);
      gl.uniform1f(u.uTexture, P.texture / 100);
      gl.uniform1f(u.uClarity, P.clarity / 100);
      gl.uniform1f(u.uDehaze, P.dehaze / 100);
      gl.uniform1f(u.uVibrance, P.vibrance / 100);
      gl.uniform1f(u.uSaturation, P.saturation / 100);
      gl.uniform1i(u.uMono, P.monochrome ? 1 : 0);
      gl.uniform1fv(u.uHue, HSL_RANGES.map((r) => r.hue));
      gl.uniform1fv(u.uHslH, P.hslHue.map((v) => v / 100));
      gl.uniform1fv(u.uHslS, P.hslSat.map((v) => v / 100));
      gl.uniform1fv(u.uHslL, P.hslLum.map((v) => v / 100));
      gl.uniform1f(u.uSharpen, P.sharpenAmount / 100);
      gl.uniform1f(u.uMasking, P.sharpenMasking / 100);
      gl.uniform1f(u.uNrLuma, P.nrLuma / 100);
      gl.uniform1f(u.uNrColor, P.nrColor / 100);
      gl.uniform1f(u.uVignette, P.vignette / 100);
      gl.uniform1f(u.uVigMid, P.vignetteMid / 100);
      gl.uniform1f(u.uGrain, P.grain / 100);
      gl.uniform1i(u.uCurveOn, curveOn ? 1 : 0);
      gl.uniform1i(u.uShowMask, opts.showMask ? 1 : 0);
    });

    let out = null;
    if (opts.target === 'pixels') {
      if (!this.readT || this.readT.w !== width || this.readT.h !== height) {
        this._free(this.readT);
        this.readT = this._target(width, height);
      }
      out = this.readT;
    } else if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this._draw(this.progs.final, out, (u) => {
      this._bind(0, this.mainOut.tex, u.uTex);
      gl.uniform2f(u.uTexel, 1 / width, 1 / height);
      gl.uniform1f(u.uSharp, opts.before ? 0 : P.outputSharpen / 100);
    });
    if (opts.target === 'pixels') {
      const px = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { data: px, width, height };
    }
    return null;
  }

  dispose() {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}

/** Convierte píxeles de readPixels (de abajo hacia arriba) a ImageData normal. */
export function flipRows({ data, width, height }) {
  const out = new Uint8ClampedArray(data.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) out.set(data.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  return { data: out, width, height };
}
