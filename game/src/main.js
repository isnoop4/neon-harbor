// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play, paused
// and game over.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_OVER } from './world.js';
import { createMissions } from './missions.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_SAVE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const missions = createMissions(world);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  const s = world.state;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: s.cash, missionsDone: s.missionsDone,
      x: s.player.x, y: s.player.y, health: s.player.health, ammo: s.player.ammo,
      carsStolen: s.carsStolen, kills: s.kills,
    }));
    return true;
  } catch {
    return false;
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, missions);
  world.state.missionTarget = missions.targetPlace();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, { screen: scene.screen, missions, hasSave: !!readSave() });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let shootCooldown = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fromSave) {
    world.reset();
    if (fromSave) {
      const save = readSave();
      if (save) {
        missions.loadProgress(save.missionsDone, save.cash);
        world.placePlayer(save.x, save.y);
        world.state.player.health = save.health;
        world.state.player.ammo = save.ammo;
        world.state.carsStolen = save.carsStolen || 0;
        world.state.kills = save.kills || 0;
        announce('Save loaded. Back in Neon Harbor.');
      }
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Follow the pink marker.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    const score = world.state.cash + world.state.missionsDone * 500;
    if (score > best) {
      best = score;
      saveBest(best);
    }
    announce(`Busted. Cash $${world.state.cash}. Missions ${world.state.missionsDone} of 4.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_SAVE && screen === SCREEN_PLAY) {
      announce(writeSave() ? 'Game saved.' : 'Save failed — storage is off.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame(false);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    const adapted = {
      moveX: input.moveX(), moveY: input.moveY(),
      up: input.up, down: input.down, steer: input.steer, run: input.run,
    };
    // Shooting: click / F fires toward the mouse; hold to keep firing at pistol rate.
    shootCooldown -= STEP;
    if (screen === SCREEN_PLAY && !world.state.player.inCar) {
      const wantFire = input.takeFire() || input.mouseDown;
      if (wantFire && shootCooldown <= 0) {
        const mouse = input.mouse;
        const target = renderer.screenToWorld(mouse.x, mouse.y);
        const p = world.state.player;
        p.angle = Math.atan2(target.y - p.y, target.x - p.x);
        if (world.state.player.ammo > 0) {
          world.fireAt(p.angle);
          audio.shoot();
          shootCooldown = 0.22;
        }
      }
    }
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { moveX: 0, moveY: 0, up: false, down: false, steer: 0, run: false });
      return;
    }
    const before = world.state.missionsDone;
    const events = world.step(STEP, adapted);
    missions.update(STEP);
    world.state.missionTarget = missions.targetPlace();
    if (world.state.missionsDone > before) audio.mission();
    audio.siren(STEP, world.state.wanted);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) audio.hit();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, { screen, missions, hasSave: !!readSave() });
  }

  // C on the title screen continues a saved game; E steals / exits a car.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && screen === SCREEN_TITLE && readSave()) startGame(true);
    if (event.code === 'KeyE' && screen === SCREEN_PLAY) {
      if (world.state.player.inCar) world.exitCar();
      else if (world.enterCar()) audio.crash();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  window.__game = { world, missions, startGame, writeSave, readSave };
  announce('Neon Harbor. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
