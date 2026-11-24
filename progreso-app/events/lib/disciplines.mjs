// Registro extensible de disciplinas: agregar un deporte = agregar una entrada aquí (y en la app, en EV_SPORTS).
export const SPORTS = {
  hyrox: { name: 'HYROX', officialDomains: ['hyrox.com'], recoveryDays: 14, prepWeeks: 16, minPrepWeeks: 8 },
  running: { name: 'Running', officialDomains: [], recoveryDays: 21, prepWeeks: 16, minPrepWeeks: 8 },
  triathlon: { name: 'Triatlón', officialDomains: ['ironman.com', 'triathlon.org'], recoveryDays: 21, prepWeeks: 20, minPrepWeeks: 12 },
  bodybuilding: { name: 'Fisicoculturismo', officialDomains: ['npcnewsonline.com', 'ifbb.com', 'wnbf.net'], recoveryDays: 14, prepWeeks: 16, minPrepWeeks: 12 },
  strength: { name: 'Fuerza', officialDomains: ['powerlifting.sport', 'iwf.sport'], recoveryDays: 10, prepWeeks: 12, minPrepWeeks: 8 },
  fitness_race: { name: 'Fitness competitivo', officialDomains: ['spartan.com', 'dekafit.com', 'games.crossfit.com'], recoveryDays: 10, prepWeeks: 10, minPrepWeeks: 6 },
};
export const sportOf = k => SPORTS[k] || { name: k, officialDomains: [], recoveryDays: 14, prepWeeks: 12, minPrepWeeks: 6 };
