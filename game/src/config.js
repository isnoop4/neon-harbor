// Neon Harbor — an original open-world crime game. Every tuning number and colour
// in one place. The world is a 2560x1920 harbour city; the camera shows a 1280x720
// window of it and follows the player. The simulation runs in fixed 1/60 s steps.
export const FIELD = { width: 1280, height: 720 };
export const WORLD = { width: 2560, height: 1920 };
export const STEP = 1 / 60;

// City layout: roads every 320 px, 64 px wide, so blocks are 256x256 squares.
export const ROAD = { spacing: 320, width: 64 };
export const SAVE_KEY = 'neon-harbor.save.v1';
export const BEST_KEY = 'neon-harbor.best';

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 265,
  health: 100,
  punchRange: 34,
  pistolDamage: 34,
  pistolRate: 0.22,
  ammoStart: 48,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 220,
  maxSpeed: 460,
  maxReverse: 150,
  steer: 2.6,
  drag: 0.55,
  trafficSpeed: 150,
};

export const WANTED = {
  max: 5,
  decaySeconds: 14,
  steal: 1,
  hitPed: 1,
  hitCar: 1,
  shoot: 1,
  kill: 2,
};

export const PALETTE = {
  backdrop: '#0b1020',
  water: '#14506e',
  waterDeep: '#0e3d55',
  sand: '#c9a86a',
  grass: '#3f7a4a',
  parkDark: '#356b3f',
  road: '#2b2f3a',
  roadLine: '#d8c56a',
  sidewalk: '#6f7480',
  building: ['#b5673f', '#7a5a8c', '#4f7d8c', '#8c7a4f', '#5a6b8c', '#96604f', '#6b8c5a', '#8c4f6b'],
  roof: '#3a3f4d',
  window: '#ffd98a',
  player: '#ffcf3f',
  playerOutline: '#1c1c22',
  ped: ['#e8e8e8', '#7fb3ff', '#ff9d7f', '#a5e08a', '#e08ad8'],
  police: '#2f6fd6',
  policeLight: ['#ff3b30', '#2f6fd6'],
  taxi: '#ffc233',
  hud: '#10141f',
  hudText: '#f2f4f8',
  muted: '#9aa3b2',
  star: '#ffd23f',
  mission: '#ff5fa2',
  safehouse: '#3fd68a',
  bullet: '#ffe9a3',
  blood: '#c22e2e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Mission story: Rae Voss, a courier new to Neon Harbor, takes jobs from Marla Quinn,
// a fixer who runs the harbour's night trade. All names are invented for this game.
export const STORY = {
  hero: 'Rae Voss',
  fixer: 'Marla Quinn',
  city: 'Neon Harbor',
  intro:
    'New in town, broke, and already on Marla Quinn\u2019s list. Run her jobs, stay out of the harbour police\u2019 way \u2014 or don\u2019t \u2014 and make Neon Harbor yours.',
};
