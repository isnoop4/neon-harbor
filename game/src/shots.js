// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what real play looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { PLACES } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { moveX: 0, moveY: 0, up: false, down: false, steer: 0, run: false };

function driveInput(world) {
  // Drive east along the road at y=352 with proportional steering: a small
  // correction for the angle error to east and for the drift off the centre
  // line, so the car holds a straight line instead of slaloming.
  const car = world.state.player.inCar;
  if (!car) return IDLE;
  const steer = Math.max(-1, Math.min(1, -car.angle * 1.5 - (car.y - 352) * 0.012));
  return { moveX: 0, moveY: 0, up: true, down: false, steer, run: false };
}

function stealNearestCar(world) {
  const p = world.state.player;
  const car = world.nearestCar(p.x, p.y, 400);
  if (!car) return false;
  // Stage the car on the eastbound road at y=352, facing east, so the drive
  // autopilot has a straight road ahead of it.
  car.x = 448;
  car.y = 352;
  car.angle = 0;
  car.speed = 0;
  world.placePlayer(car.x, car.y - 40);
  return world.enterCar();
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * `missions` is the mission runner, so the staged frame shows the real objective.
 */
export function stageShot(name, world, missions) {
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, IDLE);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'mission') {
    missions.loadProgress(3, 750);
    world.placePlayer(PLACES.warehouse.x - 220, PLACES.warehouse.y + 60);
    world.spawnEnforcers(PLACES.warehouse.x, PLACES.warehouse.y, 4);
    for (let i = 0; i < 2 / STEP; i += 1) {
      const e = world.state.enforcers.find((x) => !x.down);
      if (e) {
        const a = Math.atan2(e.y - world.state.player.y, e.x - world.state.player.x);
        world.state.player.angle = a;
        if (i % 20 === 0) world.fireAt(a);
      }
      world.step(STEP, IDLE);
      missions.update(STEP);
    }
    return { screen: SCREEN_PLAY };
  }
  // play / chase: steal a car at the safehouse and drive east through traffic.
  // Four seconds keeps the car mid-city (the city is 2560 px wide) instead of
  // pinned against its eastern edge.
  missions.loadProgress(0, 0);
  world.placePlayer(352, 300);
  stealNearestCar(world);
  if (name === 'chase') world.addWanted(3);
  for (let i = 0; i < 4 / STEP; i += 1) {
    world.step(STEP, driveInput(world));
    missions.update(STEP);
    if (world.state.player.health <= 0) break;
  }
  return { screen: world.state.player.health <= 0 ? SCREEN_OVER : SCREEN_PLAY };
}
