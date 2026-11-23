'use strict';
/* =====================================================================
 *  41.0 · Ilustraciones de HYROX (originales, SVG animado)
 *  Cada estación tiene su versión de competencia y su versión Planet Fitness.
 *  Figura articulada: 11 puntos (cabeza, cuello, pelvis, rodilla/pie lejanos y cercanos,
 *  codo/mano lejanos y cercanos) que se interpolan entre dos poses A ↔ B en bucle.
 * ===================================================================== */
const ART_DUR = '1.8s';
const P = (h, n, p, kf, ff, kn, fn, ef, hf, en, hn) => ({ h, n, p, kf, ff, kn, fn, ef, hf, en, hn });
function artAnim(attr, a, b, dur) {
  if (a === b) return '';
  return `<animate attributeName="${attr}" values="${a};${b};${a}" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${dur || ART_DUR}" repeatCount="indefinite"/>`;
}
/** Segmento animado entre dos poses. */
function artSeg(A, B, k1, k2, col, w) {
  const a1 = A[k1], a2 = A[k2], b1 = B[k1], b2 = B[k2];
  return `<line x1="${a1[0]}" y1="${a1[1]}" x2="${a2[0]}" y2="${a2[1]}" stroke="${col}" stroke-width="${w}" stroke-linecap="round">${artAnim('x1', a1[0], b1[0])}${artAnim('y1', a1[1], b1[1])}${artAnim('x2', a2[0], b2[0])}${artAnim('y2', a2[1], b2[1])}</line>`;
}
function artFigure(A, B) {
  const far = '#7c7c7c', near = '#ededed';
  return [
    artSeg(A, B, 'p', 'kf', far, 8), artSeg(A, B, 'kf', 'ff', far, 7), artSeg(A, B, 'n', 'ef', far, 6.5), artSeg(A, B, 'ef', 'hf', far, 6),
    artSeg(A, B, 'n', 'p', near, 12),
    artSeg(A, B, 'p', 'kn', near, 8.5), artSeg(A, B, 'kn', 'fn', near, 7.5), artSeg(A, B, 'n', 'en', near, 7), artSeg(A, B, 'en', 'hn', near, 6.5),
    `<circle cx="${A.h[0]}" cy="${A.h[1]}" r="9" fill="${near}">${artAnim('cx', A.h[0], B.h[0])}${artAnim('cy', A.h[1], B.h[1])}</circle>`
  ].join('');
}
/** Línea de equipo que sigue a una mano (cuerda, cable, cadena). */
const artFollow = (x, y, A, B, k, col, w) => `<line x1="${x}" y1="${y}" x2="${A[k][0]}" y2="${A[k][1]}" stroke="${col || '#c6f432'}" stroke-width="${w || 2}">${artAnim('x2', A[k][0], B[k][0])}${artAnim('y2', A[k][1], B[k][1])}</line>`;
/** Objeto que se mueve con un punto del cuerpo (balón, mancuerna, saco). */
const artMove = (A, B, k, dx, dy, inner) => `<g transform="translate(${A[k][0] + dx} ${A[k][1] + dy})"><animateTransform attributeName="transform" type="translate" values="${A[k][0] + dx} ${A[k][1] + dy};${B[k][0] + dx} ${B[k][1] + dy};${A[k][0] + dx} ${A[k][1] + dy}" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${ART_DUR}" repeatCount="indefinite"/>${inner}</g>`;
const EQ = '#3b3b3b', EQ2 = '#5c5c5c', LIME = '#c6f432';
const KB = `<path d="M-4 -5 Q0 -12 4 -5" fill="none" stroke="${LIME}" stroke-width="2.5"/><circle r="7.5" cy="3" fill="#4a4a4a" stroke="${LIME}" stroke-width="1.8"/>`;
const DBH = `<rect x="-10" y="-1.5" width="20" height="3" rx="1.5" fill="#9a9a9a"/><rect x="-13" y="-6" width="5" height="12" rx="1.5" fill="#4a4a4a" stroke="${LIME}" stroke-width="1.3"/><rect x="8" y="-6" width="5" height="12" rx="1.5" fill="#4a4a4a" stroke="${LIME}" stroke-width="1.3"/>`;
const DBV = `<rect x="-1.5" y="-10" width="3" height="20" rx="1.5" fill="#9a9a9a"/><rect x="-6" y="-13" width="12" height="5" rx="1.5" fill="#4a4a4a" stroke="${LIME}" stroke-width="1.3"/><rect x="-6" y="8" width="12" height="5" rx="1.5" fill="#4a4a4a" stroke="${LIME}" stroke-width="1.3"/>`;
const TREAD = `<path d="M30 122 L172 104" stroke="${EQ}" stroke-width="9" stroke-linecap="round"/><path d="M30 122 L172 104" stroke="${EQ2}" stroke-width="2" stroke-dasharray="6 6"><animate attributeName="stroke-dashoffset" values="0;-24" dur=".8s" repeatCount="indefinite"/></path><path d="M166 104 L172 64 M162 64 H182" stroke="${EQ2}" stroke-width="5" stroke-linecap="round"/><text x="150" y="132" font-size="8" fill="${LIME}" font-weight="800" font-family="system-ui">15 %</text>`;

const ART = {
  run: { A: P([106, 40], [103, 51], [98, 84], [86, 100], [72, 110], [114, 100], [110, 123], [110, 66], [118, 58], [92, 66], [90, 78]),
    B: P([106, 37], [103, 48], [98, 81], [112, 98], [108, 122], [88, 100], [74, 108], [92, 64], [90, 76], [110, 64], [118, 56]), eq: () => '' },
  ski: { A: P([104, 36], [102, 48], [98, 82], [100, 103], [98, 124], [104, 103], [104, 124], [112, 36], [124, 26], [114, 38], [126, 28]),
    B: P([120, 54], [113, 61], [94, 84], [102, 104], [98, 124], [106, 104], [104, 124], [118, 77], [114, 94], [120, 79], [116, 96]),
    eq: (A, B) => `<rect x="134" y="14" width="12" height="110" rx="4" fill="${EQ}"/><circle cx="140" cy="22" r="6" fill="${EQ2}"/><rect x="130" y="112" width="28" height="12" rx="3" fill="${EQ}"/>${artFollow(138, 22, A, B, 'hf', LIME)}${artFollow(140, 24, A, B, 'hn', LIME)}` },
  push: { A: P([124, 60], [117, 66], [92, 88], [82, 106], [66, 122], [104, 104], [97, 124], [126, 72], [134, 76], [128, 74], [136, 78]),
    B: P([124, 60], [117, 66], [92, 88], [104, 104], [97, 124], [84, 106], [68, 122], [126, 72], [134, 76], [128, 74], [136, 78]),
    eq: () => `<g><animateTransform attributeName="transform" type="translate" values="0 0;5 0;0 0" dur="${ART_DUR}" repeatCount="indefinite"/><rect x="134" y="104" width="46" height="14" rx="3" fill="${EQ}"/><rect x="146" y="94" width="26" height="10" rx="2" fill="${LIME}" opacity=".85"/><path d="M137 104 V70 M143 104 V70" stroke="${EQ2}" stroke-width="4" stroke-linecap="round"/></g>` },
  pull: { A: P([80, 48], [85, 58], [96, 88], [110, 104], [120, 124], [104, 106], [110, 124], [100, 68], [114, 70], [96, 74], [104, 66]),
    B: P([80, 48], [85, 58], [96, 88], [110, 104], [120, 124], [104, 106], [110, 124], [94, 76], [100, 66], [102, 68], [116, 70]),
    eq: (A, B) => `<g><animateTransform attributeName="transform" type="translate" values="0 0;-4 0;0 0" dur="${ART_DUR}" repeatCount="indefinite"/><rect x="152" y="104" width="38" height="14" rx="3" fill="${EQ}"/><rect x="158" y="94" width="24" height="10" rx="2" fill="${LIME}" opacity=".85"/></g>${artFollow(152, 110, A, B, 'hn', LIME, 2.5)}<path d="M152 110 Q130 126 110 122" fill="none" stroke="${LIME}" stroke-width="2" opacity=".5"/>` },
  bbj: { A: P([134, 108], [124, 110], [94, 114], [78, 118], [62, 122], [78, 120], [62, 123], [124, 117], [124, 123], [121, 117], [121, 123]),
    B: P([112, 34], [108, 46], [100, 78], [88, 92], [80, 104], [112, 94], [108, 106], [122, 40], [130, 30], [120, 38], [128, 28]),
    eq: () => `<path d="M40 128 H70 M150 128 H180" stroke="${LIME}" stroke-width="2" stroke-dasharray="3 4"/>` },
  row: { A: P([112, 64], [108, 76], [96, 106], [116, 94], [138, 113], [118, 92], [140, 112], [126, 90], [146, 96], [126, 92], [146, 98]),
    B: P([60, 66], [64, 78], [72, 106], [100, 105], [138, 113], [102, 104], [140, 112], [80, 96], [78, 86], [84, 94], [80, 88]),
    eq: (A, B) => `<path d="M36 116 H170" stroke="${EQ}" stroke-width="6" stroke-linecap="round"/><circle cx="160" cy="102" r="14" fill="${EQ}" stroke="${EQ2}" stroke-width="2"/><circle cx="160" cy="102" r="4" fill="${LIME}"/><rect x="132" y="110" width="14" height="5" fill="${EQ2}"/>${artFollow(152, 98, A, B, 'hn', LIME)}<rect x="${A.p[0] - 10}" y="108" width="20" height="6" rx="2" fill="${EQ2}">${artAnim('x', A.p[0] - 10, B.p[0] - 10)}</rect>` },
  farm: { A: P([100, 38], [100, 50], [100, 84], [92, 104], [86, 124], [108, 104], [112, 124], [97, 67], [96, 84], [104, 67], [105, 84]),
    B: P([101, 37], [101, 49], [100, 83], [108, 103], [112, 124], [92, 104], [86, 124], [98, 66], [97, 83], [105, 66], [106, 83]),
    eq: (A, B, pf) => artMove(A, B, 'hf', 0, 8, pf ? DBV : KB) + artMove(A, B, 'hn', 0, 8, pf ? DBV : KB) },
  lunge: { A: P([100, 36], [100, 48], [100, 82], [92, 103], [88, 124], [110, 103], [114, 124], [90, 52], [88, 42], [110, 52], [112, 42]),
    B: P([100, 50], [100, 62], [100, 96], [86, 118], [70, 122], [120, 98], [122, 124], [90, 66], [88, 56], [110, 66], [112, 56]),
    eq: (A, B, pf) => pf ? artMove(A, B, 'n', 0, 12, DBV) : artMove(A, B, 'n', 0, 0, `<rect x="-24" y="-7" width="48" height="13" rx="6.5" fill="#5a4c35" stroke="${LIME}" stroke-width="1.6"/>`) },
  wb: { A: P([98, 64], [98, 76], [88, 100], [104, 106], [104, 124], [110, 104], [108, 124], [108, 90], [106, 76], [110, 92], [108, 78]),
    B: P([100, 36], [100, 48], [98, 82], [100, 104], [102, 124], [104, 104], [106, 124], [106, 34], [110, 20], [108, 36], [112, 22]),
    eq: (A, B, pf) => pf ? artMove(A, B, 'hf', 0, -2, DBH) + artMove(A, B, 'hn', 0, 2, DBH)
      : `<path d="M160 6 V128" stroke="${EQ}" stroke-width="5"/><circle cx="160" cy="18" r="7" fill="none" stroke="${LIME}" stroke-width="2.5"/>${artMove(A, B, 'hn', 6, -6, `<circle r="9" fill="#3d3d3d" stroke="${LIME}" stroke-width="2"/>`)}` }
};
/* Versiones Planet Fitness (cambian el equipo o la postura) */
const ART_PF = {
  ski: { A: P([102, 38], [101, 50], [98, 84], [100, 104], [98, 124], [104, 104], [104, 124], [112, 40], [126, 32], [114, 42], [128, 34]),
    B: P([110, 46], [106, 56], [96, 86], [100, 104], [98, 124], [104, 104], [104, 124], [114, 74], [112, 90], [116, 76], [114, 92]),
    eq: (A, B) => `<rect x="140" y="10" width="10" height="114" rx="3" fill="${EQ}"/><rect x="152" y="40" width="16" height="50" rx="3" fill="${EQ2}"/><circle cx="142" cy="26" r="5" fill="${EQ2}"/>${artFollow(142, 26, A, B, 'hn', LIME, 2.5)}${artFollow(142, 26, A, B, 'hf', LIME, 2)}` },
  push: { A: P([136, 56], [129, 62], [104, 84], [98, 102], [84, 118], [116, 100], [112, 116], [140, 66], [160, 70], [142, 68], [162, 72]),
    B: P([136, 56], [129, 62], [104, 84], [116, 100], [112, 116], [98, 102], [84, 118], [140, 66], [160, 70], [142, 68], [162, 72]), eq: () => TREAD },
  pull: { A: P([118, 42], [116, 54], [110, 86], [102, 102], [96, 118], [118, 102], [124, 115], [124, 68], [140, 74], [126, 70], [160, 70]),
    B: P([118, 42], [116, 54], [110, 86], [118, 102], [124, 115], [102, 102], [96, 118], [124, 68], [140, 74], [126, 70], [160, 70]), eq: () => TREAD + `<path d="M84 60 l-10 4 10 4" fill="none" stroke="${LIME}" stroke-width="2.5" stroke-linecap="round"/>` },
  farm: Object.assign({}, ART.farm), lunge: Object.assign({}, ART.lunge),
  wb: { A: P([98, 64], [98, 76], [88, 100], [104, 106], [104, 124], [110, 104], [108, 124], [106, 90], [104, 76], [110, 92], [110, 76]),
    B: P([100, 36], [100, 48], [98, 82], [100, 104], [102, 124], [104, 104], [106, 124], [104, 30], [104, 14], [108, 30], [110, 14]), eq: ART.wb.eq }
};
const FRONT = new Set(['farm', 'lunge', 'wb']);
const ART_CAP = {
  run: ['1 km de carrera', '1 km en cinta o pista'], ski: ['SkiErg · 1,000 m', 'Ski en polea alta · 100 jalones'], push: ['Sled push · 50 m', 'Empuje en caminadora 15 % · 200 m'],
  pull: ['Sled pull · 50 m', 'Caminar hacia atrás 15 % · 150 m + remo'], bbj: ['Burpee broad jumps · 80 m', 'Burpee broad jumps · 80 m'], row: ['Remo · 1,000 m', 'Remo de PF · 1,000 m'],
  farm: ['Farmers carry · 200 m con kettlebells', 'Farmers carry con mancuernas · 200 m'], lunge: ['Sandbag lunges · 100 m', 'Zancadas goblet con mancuerna · 100 m'], wb: ['Wall balls · 100 reps', 'Thrusters con mancuernas · 100 reps']
};
/** Ilustración de una estación. pf = versión Planet Fitness. */
function hxArt(k, pf, h) {
  const src = pf && ART_PF[k] ? ART_PF[k] : ART[k]; if (!src) return '';
  return `<svg class="hx-art" viewBox="0 0 200 140" ${h ? `height="${h}"` : ''} role="img" aria-label="${esc(ART_CAP[k][pf ? 1 : 0])}">
    <rect width="200" height="140" rx="14" fill="#0e0e0e"/><path d="M14 128 H186" stroke="#262626" stroke-width="2"/>
    ${FRONT.has(k) ? '' : src.eq(src.A, src.B, !!(pf && ART_PF[k]))}${artFigure(src.A, src.B)}${FRONT.has(k) ? src.eq(src.A, src.B, !!(pf && ART_PF[k])) : ''}
    ${pf ? `<text x="12" y="20" font-size="9" font-weight="900" letter-spacing="1" fill="${LIME}" font-family="system-ui">PLANET FITNESS</text>` : `<text x="12" y="20" font-size="9" font-weight="900" letter-spacing="1" fill="#777" font-family="system-ui">COMPETENCIA</text>`}
  </svg>`;
}
