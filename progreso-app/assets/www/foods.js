'use strict';
/* =====================================================================
 *  38.0 · Base de alimentos (offline)
 *  Valores medios POR 100 g de la parte comestible:
 *   - USDA FoodData Central, SR Legacy (fdc.nal.usda.gov).
 *   - Queso panela: Sistema Mexicano de Alimentos Equivalentes (SMAE, 4.ª ed.).
 *  Las etiquetas de cada marca pueden variar: si tienes la etiqueta, úsala.
 *  Formato: [id, nombre, kcal, proteína, carbohidratos, grasa, categoría, estado, unidades]
 *  estado: 'crudo' | 'cocido' | '' · unidades: { 'nombre': gramos }
 * ===================================================================== */
const NF_CATS = { prot: 'Proteínas', lac: 'Lácteos', leg: 'Leguminosas', cer: 'Cereales y tubérculos', fru: 'Frutas', ver: 'Verduras', gra: 'Grasas y semillas', otr: 'Bebidas y otros' };
const NF = [
  // Proteínas animales
  ['pollo_c', 'Pechuga de pollo', 120, 22.5, 0, 2.6, 'prot', 'crudo', { 'filete chico': 120, 'filete grande': 200 }],
  ['pollo', 'Pechuga de pollo asada', 165, 31, 0, 3.6, 'prot', 'cocido', { 'filete chico': 100, 'filete grande': 160 }],
  ['muslo', 'Muslo de pollo sin piel', 209, 26, 0, 10.9, 'prot', 'cocido', { 'pieza': 80 }],
  ['res_m_c', 'Carne molida de res 90/10', 176, 20, 0, 10, 'prot', 'crudo', {}],
  ['res_m', 'Carne molida de res 90/10', 217, 26.1, 0, 11.8, 'prot', 'cocido', { 'taza': 120 }],
  ['bistec', 'Bistec de res magro', 190, 30, 0, 7, 'prot', 'cocido', { 'bistec': 120 }],
  ['arrachera', 'Arrachera (falda de res)', 192, 28, 0, 8, 'prot', 'cocido', { 'porción': 150 }],
  ['cerdo', 'Lomo de cerdo', 143, 26.2, 0, 3.5, 'prot', 'cocido', { 'porción': 120 }],
  ['tilapia', 'Tilapia / pescado blanco', 128, 26.2, 0, 2.7, 'prot', 'cocido', { 'filete': 120 }],
  ['salmon', 'Salmón', 206, 22.1, 0, 12.4, 'prot', 'cocido', { 'filete': 150 }],
  ['atun', 'Atún en agua (escurrido)', 116, 25.5, 0, 0.8, 'prot', '', { 'lata (escurrida)': 100 }],
  ['camaron', 'Camarón', 99, 24, 0.2, 0.3, 'prot', 'cocido', { 'taza': 120 }],
  ['huevo', 'Huevo entero', 143, 12.6, 0.7, 9.5, 'prot', '', { 'pieza': 50 }],
  ['clara', 'Clara de huevo', 52, 10.9, 0.7, 0.2, 'prot', '', { 'pieza': 33, 'taza': 243 }],
  ['whey', 'Proteína whey (polvo)', 400, 80, 8, 6, 'prot', '', { 'scoop': 30 }],
  // Lácteos
  ['panela', 'Queso panela', 190, 18, 3, 12, 'lac', '', { 'rebanada': 40 }],
  ['oaxaca', 'Queso Oaxaca', 300, 22, 2, 23, 'lac', '', { 'porción': 30 }],
  ['cottage', 'Queso cottage', 98, 11.1, 3.4, 4.3, 'lac', '', { 'taza': 210 }],
  ['griego', 'Yogur griego natural sin grasa', 59, 10.2, 3.6, 0.4, 'lac', '', { 'vaso': 150, 'taza': 245 }],
  ['yogur', 'Yogur natural entero', 61, 3.5, 4.7, 3.3, 'lac', '', { 'vaso': 150 }],
  ['leche', 'Leche entera', 61, 3.2, 4.8, 3.3, 'lac', '', { 'taza': 244, 'vaso': 250 }],
  ['leche_d', 'Leche descremada', 34, 3.4, 5, 0.1, 'lac', '', { 'taza': 245, 'vaso': 250 }],
  // Leguminosas
  ['frijol_n', 'Frijoles negros', 132, 8.9, 23.7, 0.5, 'leg', 'cocido', { 'taza': 172, '½ taza': 86 }],
  ['frijol_p', 'Frijoles pintos de la olla', 143, 9, 26.2, 0.7, 'leg', 'cocido', { 'taza': 171, '½ taza': 86 }],
  ['lenteja', 'Lentejas', 116, 9, 20.1, 0.4, 'leg', 'cocido', { 'taza': 198 }],
  ['garbanzo', 'Garbanzos', 164, 8.9, 27.4, 2.6, 'leg', 'cocido', { 'taza': 164 }],
  ['tofu', 'Tofu firme', 144, 17.3, 2.8, 8.7, 'leg', '', { 'porción': 100 }],
  // Cereales y tubérculos
  ['tortilla', 'Tortilla de maíz', 218, 5.7, 44.6, 2.9, 'cer', '', { 'pieza': 30 }],
  ['tortilla_h', 'Tortilla de harina', 304, 8.2, 49.4, 8, 'cer', '', { 'pieza': 45 }],
  ['arroz_c', 'Arroz blanco', 365, 7.1, 80, 0.7, 'cer', 'crudo', { 'taza': 185, '¼ taza': 46 }],
  ['arroz', 'Arroz blanco', 130, 2.7, 28.2, 0.3, 'cer', 'cocido', { 'taza': 158, '½ taza': 79 }],
  ['arroz_i', 'Arroz integral', 123, 2.7, 25.6, 1, 'cer', 'cocido', { 'taza': 195 }],
  ['avena', 'Avena en hojuelas', 389, 16.9, 66.3, 6.9, 'cer', 'crudo', { '½ taza': 40, 'taza': 80 }],
  ['pasta_c', 'Pasta', 371, 13, 74.7, 1.5, 'cer', 'crudo', { 'porción': 80 }],
  ['pasta', 'Pasta', 158, 5.8, 30.9, 0.9, 'cer', 'cocido', { 'taza': 140 }],
  ['pan_i', 'Pan integral de caja', 252, 12.5, 42.7, 3.5, 'cer', '', { 'rebanada': 28 }],
  ['pan', 'Pan blanco de caja', 266, 7.6, 50.6, 3.3, 'cer', '', { 'rebanada': 25 }],
  ['bolillo', 'Bolillo', 272, 10.8, 51.9, 2.4, 'cer', '', { 'pieza': 70 }],
  ['papa', 'Papa con cáscara', 87, 1.9, 20.1, 0.1, 'cer', 'cocido', { 'pieza mediana': 170 }],
  ['camote', 'Camote', 90, 2, 20.7, 0.2, 'cer', 'cocido', { 'pieza': 150 }],
  ['elote', 'Elote amarillo', 96, 3.4, 21, 1.5, 'cer', 'cocido', { 'pieza': 100, 'taza (granos)': 150 }],
  ['granola', 'Granola', 471, 10, 64, 20, 'cer', '', { '¼ taza': 30 }],
  ['cereal', 'Cereal de maíz (hojuelas)', 357, 7.5, 84, 0.4, 'cer', '', { 'taza': 28 }],
  // Frutas
  ['platano', 'Plátano', 89, 1.1, 22.8, 0.3, 'fru', '', { 'pieza': 118 }],
  ['manzana', 'Manzana', 52, 0.3, 13.8, 0.2, 'fru', '', { 'pieza': 180 }],
  ['naranja', 'Naranja', 47, 0.9, 11.8, 0.1, 'fru', '', { 'pieza': 130 }],
  ['papaya', 'Papaya', 43, 0.5, 10.8, 0.3, 'fru', '', { 'taza': 145 }],
  ['mango', 'Mango', 60, 0.8, 15, 0.4, 'fru', '', { 'pieza': 200 }],
  ['fresa', 'Fresas', 32, 0.7, 7.7, 0.3, 'fru', '', { 'taza': 150 }],
  ['sandia', 'Sandía', 30, 0.6, 7.6, 0.2, 'fru', '', { 'taza': 152 }],
  ['pina', 'Piña', 50, 0.5, 13.1, 0.1, 'fru', '', { 'taza': 165 }],
  ['uva', 'Uvas', 69, 0.7, 18.1, 0.2, 'fru', '', { 'taza': 150 }],
  ['guayaba', 'Guayaba', 68, 2.6, 14.3, 1, 'fru', '', { 'pieza': 55 }],
  ['arandano', 'Arándanos', 57, 0.7, 14.5, 0.3, 'fru', '', { 'taza': 148 }],
  ['aguacate', 'Aguacate', 160, 2, 8.5, 14.7, 'gra', '', { '⅓ pieza': 45, 'pieza': 136 }],
  // Verduras
  ['brocoli', 'Brócoli', 35, 2.4, 7.2, 0.4, 'ver', 'cocido', { 'taza': 156 }],
  ['espinaca', 'Espinaca', 23, 2.9, 3.6, 0.4, 'ver', 'crudo', { 'taza': 30 }],
  ['jitomate', 'Jitomate', 18, 0.9, 3.9, 0.2, 'ver', '', { 'pieza': 120 }],
  ['lechuga', 'Lechuga', 15, 1.4, 2.9, 0.2, 'ver', '', { 'taza': 50 }],
  ['calabacita', 'Calabacita', 15, 1.1, 2.7, 0.4, 'ver', 'cocido', { 'taza': 180 }],
  ['nopal', 'Nopales', 15, 1.4, 3.3, 0.1, 'ver', 'cocido', { 'taza': 150 }],
  ['zanahoria', 'Zanahoria', 41, 0.9, 9.6, 0.2, 'ver', '', { 'pieza': 60 }],
  ['pepino', 'Pepino', 15, 0.7, 3.6, 0.1, 'ver', '', { 'pieza': 200 }],
  ['ejote', 'Ejotes', 35, 1.9, 7.9, 0.3, 'ver', 'cocido', { 'taza': 125 }],
  ['champinon', 'Champiñones', 22, 3.1, 3.3, 0.3, 'ver', '', { 'taza': 70 }],
  ['cebolla', 'Cebolla', 40, 1.1, 9.3, 0.1, 'ver', '', { 'pieza': 110 }],
  // Grasas y semillas
  ['aceite', 'Aceite de oliva', 884, 0, 0, 100, 'gra', '', { 'cucharada': 13.5, 'cucharadita': 4.5 }],
  ['aceite_v', 'Aceite vegetal', 884, 0, 0, 100, 'gra', '', { 'cucharada': 13.6, 'cucharadita': 4.5 }],
  ['mantequilla', 'Mantequilla', 717, 0.9, 0.1, 81.1, 'gra', '', { 'cucharadita': 5 }],
  ['crema_cac', 'Crema de cacahuate', 588, 25, 20, 50, 'gra', '', { 'cucharada': 16 }],
  ['almendra', 'Almendras', 579, 21.2, 21.6, 49.9, 'gra', '', { 'puño (≈23)': 28 }],
  ['cacahuate', 'Cacahuates', 567, 25.8, 16.1, 49.2, 'gra', '', { 'puño': 28 }],
  ['nuez', 'Nueces', 654, 15.2, 13.7, 65.2, 'gra', '', { 'puño': 28 }],
  ['chia', 'Semillas de chía', 486, 16.5, 42.1, 30.7, 'gra', '', { 'cucharada': 12 }],
  ['mayonesa', 'Mayonesa', 680, 1, 0.6, 75, 'gra', '', { 'cucharada': 14 }],
  // Bebidas y otros
  ['jugo', 'Jugo de naranja', 45, 0.7, 10.4, 0.2, 'otr', '', { 'vaso': 250 }],
  ['refresco', 'Refresco de cola', 42, 0, 10.6, 0, 'otr', '', { 'lata': 355, 'botella 600 ml': 600 }],
  ['miel', 'Miel', 304, 0.3, 82.4, 0, 'otr', '', { 'cucharada': 21 }],
  ['azucar', 'Azúcar', 387, 0, 100, 0, 'otr', '', { 'cucharadita': 4 }],
  ['choco', 'Chocolate oscuro 70–85 %', 598, 7.8, 45.9, 42.6, 'otr', '', { 'cuadro': 10 }]
];
const NF_BY = {}; NF.forEach(f => { NF_BY[f[0]] = f; });
/** Nombre visible con su estado (crudo/cocido) para no confundirlos. */
function nfName(f) { return f[1] + (f[7] ? ' (' + f[7] + ')' : ''); }
/** Macros de una cantidad en gramos. */
function nfMacros(id, g) {
  const f = typeof id === 'string' ? NF_BY[id] : id; if (!f || !(g > 0)) return { kcal: 0, p: 0, c: 0, f: 0 };
  const k = g / 100;
  return { kcal: Math.round(f[2] * k), p: Math.round(f[3] * k * 10) / 10, c: Math.round(f[4] * k * 10) / 10, f: Math.round(f[5] * k * 10) / 10 };
}
/** Búsqueda sin acentos que también encuentra por estado ("arroz cocido"). */
function nfSearch(q) {
  const n = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = n(q || '').split(/\s+/).filter(Boolean);
  if (!words.length) return NF.slice();
  return NF.filter(f => { const hay = n(f[1] + ' ' + f[7] + ' ' + NF_CATS[f[6]]); return words.every(w => hay.includes(w)); });
}
