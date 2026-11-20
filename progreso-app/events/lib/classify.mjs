import { strip } from './normalize.mjs';
// Disciplina por palabras clave (español e inglés). Si no se reconoce, 'other' y va a revisión.
const RULES = [
  ['hyrox', /\bhyrox\b/], ['triathlon', /\b(ironman|triatl[oó]n|triathlon|duatl[oó]n|duathlon|acuatl[oó]n|aquathlon|70 3)\b/],
  ['fitness_race', /\b(spartan|deka|ocr|obstacle|obst[aá]culos|crossfit|ninja|functional fitness)\b/],
  ['bodybuilding', /\b(bodybuilding|fisicoculturismo|physique|bikini|wellness|figure|npc|ifbb|wnbf)\b/],
  ['strength', /\b(powerlifting|weightlifting|halterofilia|strongman|strongwoman|calistenia|calisthenics)\b/],
  ['running', /\b(marat[oó]n|marathon|half marathon|medio marat[oó]n|\d+ ?k\b|trail|ultra|carrera|run\b|running|cross country)\b/],
];
export function classify(text) { const s = strip(text); for (const [k, re] of RULES) if (re.test(s)) return k; return 'other'; }
export function runDistance(text) {
  const s = strip(text);
  if (/medio marat|half marathon|21k|21 k/.test(s)) return '21K'; if (/marat|marathon|42k/.test(s)) return '42K';
  const m = s.match(/\b(\d{1,3}) ?k\b/); return m ? m[1] + 'K' : null;
}
