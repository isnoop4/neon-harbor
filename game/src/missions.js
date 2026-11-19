// Neon Harbor's missions and story. Each mission is a small chain of objectives
// with a place to reach, something to do there, and a cash reward. The mission
// runner lives here; the world only holds the places and the entities.
import { PLACES, distance } from './world.js';

export const MISSIONS = [
  {
    id: 'first-drop',
    title: '1. First Drop',
    giver: 'Marla Quinn',
    brief: 'Pick up the package at the Night Market and deliver it to the Pier. Walk or drive — just don\u2019t make a scene.',
    reward: 150,
    steps: [
      { kind: 'goto', place: 'market', text: 'Pick up the package at the Night Market' },
      { kind: 'goto', place: 'pier', text: 'Deliver the package to Pier 9' },
    ],
  },
  {
    id: 'hot-wheels',
    title: '2. Hot Wheels',
    giver: 'Marla Quinn',
    brief: 'A client wants the yellow taxi parked near the plaza. Steal it — yes, steal it — and bring it to the Garage. The police will notice.',
    reward: 250,
    steps: [
      { kind: 'steal', place: 'plaza', text: 'Steal the yellow taxi near Harbor Plaza' },
      { kind: 'goto', place: 'garage', text: 'Drive the taxi to the Garage', needCar: true },
    ],
  },
  {
    id: 'harbor-heat',
    title: '3. Harbor Heat',
    giver: 'Marla Quinn',
    brief: 'The harbour police are watching the warehouse. Make some noise, get to 3 stars, then lose them and reach the Safehouse. If you can.',
    reward: 350,
    steps: [
      { kind: 'wanted', level: 3, text: 'Raise your wanted level to 3 stars' },
      { kind: 'lose', text: 'Lose the police (0 stars), then reach the Safehouse' },
      { kind: 'goto', place: 'safehouse', text: 'Reach the Safehouse', needClear: true },
    ],
  },
  {
    id: 'the-ledger',
    title: '4. The Ledger',
    giver: 'Marla Quinn',
    brief: 'The warehouse crew kept a ledger of every harbour deal. Take it back. They will shoot. So will you — click to fire, mind your ammo.',
    reward: 500,
    steps: [
      { kind: 'goto', place: 'warehouse', text: 'Go to the Warehouse', spawn: 4 },
      { kind: 'clear', text: 'Deal with the warehouse crew (4 enforcers)' },
      { kind: 'goto', place: 'marla', text: 'Bring the ledger to Marla\u2019s Bar' },
    ],
  },
];

export function createMissions(world) {
  const state = world.state;
  let index = 0;
  let stepIndex = 0;
  let done = false;
  let banner = '';
  let bannerTimer = 0;
  let spawned = false;

  function current() {
    return done ? null : MISSIONS[index];
  }
  function currentStep() {
    const m = current();
    return m ? m.steps[stepIndex] : null;
  }
  function targetPlace() {
    const step = currentStep();
    if (!step || !step.place) return null;
    return PLACES[step.place];
  }
  function objectiveText() {
    const m = current();
    if (!m) return 'All jobs done — Neon Harbor is yours. Free roam: steal cars, dodge the police, earn cash.';
    return `${m.title} — ${currentStep().text}`;
  }

  function advance() {
    const m = current();
    stepIndex += 1;
    spawned = false;
    if (stepIndex >= m.steps.length) {
      state.cash += m.reward;
      state.missionsDone += 1;
      banner = `Job done: ${m.title}  +$${m.reward}`;
      bannerTimer = 4;
      state.message = banner;
      state.messageTimer = 4;
      index += 1;
      stepIndex = 0;
      if (index >= MISSIONS.length) {
        done = true;
        banner = 'Story complete! You run Neon Harbor now.';
        bannerTimer = 5;
      }
    }
  }

  function update(dt) {
    if (bannerTimer > 0) bannerTimer -= dt;
    const step = currentStep();
    if (!step) return;
    const p = state.player;
    if (step.kind === 'goto') {
      const place = PLACES[step.place];
      if (step.spawn && !spawned) {
        world.spawnEnforcers(place.x, place.y, step.spawn);
        spawned = true;
      }
      if (step.needClear && state.wanted > 0) return;
      if (distance(p.x, p.y, place.x, place.y) < 70) advance();
    } else if (step.kind === 'steal') {
      if (p.inCar) advance();
    } else if (step.kind === 'wanted') {
      if (state.wanted >= step.level) advance();
    } else if (step.kind === 'lose') {
      if (state.wanted === 0) advance();
    } else if (step.kind === 'clear') {
      const alive = state.enforcers.filter((e) => !e.down).length;
      if (state.player.inCar) {
        state.message = 'Get out of the car (E) to fight on foot.';
        state.messageTimer = 1;
      }
      if (alive === 0) advance();
    }
  }

  function loadProgress(missionsDone, cash) {
    // A save restores the mission chain at the next unfinished job.
    index = Math.min(missionsDone, MISSIONS.length - 1);
    if (missionsDone >= MISSIONS.length) { done = true; index = MISSIONS.length; }
    stepIndex = 0;
    state.cash = cash;
    state.missionsDone = missionsDone;
  }

  return {
    current, currentStep, targetPlace, objectiveText, update, loadProgress,
    get index() { return index; },
    get done() { return done; },
    get banner() { return bannerTimer > 0 ? banner : ''; },
  };
}
