// Neon Harbor's city and simulation, with no drawing and no browser in it: the
// road grid, buildings, parks and harbour, the player on foot or in a car, traffic,
// pedestrians, police, bullets and pickups. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react without the world
// knowing about screens or sound.
import { CAR, PALETTE, PLAYER, ROAD, WANTED, WORLD } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_COIN = 2;
export const EVENT_OVER = 4;
export const EVENT_CRIME = 8;
export const EVENT_MISSION = 16;
export const EVENT_SHOT = 32;

// Fixed places in the city, so missions and the save can name them by id.
export const PLACES = {
  safehouse: { x: 352, y: 352, label: 'Safehouse' },
  marla: { x: 1056, y: 352, label: "Marla's Bar" },
  garage: { x: 1760, y: 1056, label: 'Garage' },
  warehouse: { x: 2080, y: 672, label: 'Warehouse' },
  pier: { x: 1440, y: 1696, label: 'Pier 9' },
  market: { x: 672, y: 1376, label: 'Night Market' },
  hospital: { x: 352, y: 1376, label: 'Clinic' },
  plaza: { x: 1440, y: 1056, label: 'Harbor Plaza' },
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
export function distance(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** True when the point is on a road strip (roads sit at the start of each 320 px cell). */
export function onRoad(x, y) {
  if (x < 0 || y < 0 || x >= WORLD.width || y >= WORLD.height) return false;
  return x % ROAD.spacing < ROAD.width || y % ROAD.spacing < ROAD.width;
}
/** True when the point is in the harbour water (south edge, below the beach). */
export function inWater(x, y) {
  return y >= 1792 && y < WORLD.height;
}

export function createWorld(random) {
  // ---- city generation (seeded, so the same seed builds the same city) ----
  const buildings = [];
  const parks = [];
  const trees = [];
  for (let bx = 0; bx < 8; bx += 1) {
    for (let by = 0; by < 6; by += 1) {
      const x0 = bx * ROAD.spacing + ROAD.width + 14;
      const y0 = by * ROAD.spacing + ROAD.width + 14;
      const w = ROAD.spacing - ROAD.width - 28;
      const h = ROAD.spacing - ROAD.width - 28;
      const roll = random();
      if ((bx + by) % 5 === 2 || roll < 0.12) {
        // A park: grass, paths and trees instead of buildings.
        parks.push({ x: x0, y: y0, w, h });
        for (let t = 0; t < 7; t += 1) {
          trees.push({ x: x0 + 20 + random() * (w - 40), y: y0 + 20 + random() * (h - 40), r: 9 + random() * 7 });
        }
        continue;
      }
      const count = 1 + Math.floor(random() * 3);
      for (let i = 0; i < count; i += 1) {
        const bw = 70 + random() * 70;
        const bh = 60 + random() * 70;
        const bx0 = x0 + random() * Math.max(1, w - bw);
        const by0 = y0 + random() * Math.max(1, h - bh);
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          color: PALETTE.building[Math.floor(random() * PALETTE.building.length)],
          tall: random() < 0.35,
          windows: 4 + Math.floor(random() * 10),
        });
      }
    }
  }

  function hitsBuilding(x, y, r) {
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }
  function blocked(x, y, r) {
    if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
    if (inWater(x, y)) return true;
    return hitsBuilding(x, y, r) !== null;
  }

  // ---- entities ----
  const player = {
    x: PLACES.safehouse.x, y: PLACES.safehouse.y, angle: 0,
    health: PLAYER.health, cash: 0, ammo: PLAYER.ammoStart,
    inCar: null, speed: 0, invulnerable: 0, running: false,
  };
  const cars = [];
  const peds = [];
  const police = [];
  const bullets = [];
  const pickups = [];
  const enforcers = [];
  let carId = 0;

  function addCar(x, y, angle, opts) {
    const car = {
      id: carId += 1, x, y, angle, speed: 0,
      color: opts.color, police: !!opts.police, taxi: !!opts.taxi,
      traffic: !!opts.traffic, parked: !!opts.parked,
      axis: opts.axis || 'h', dir: opts.dir || 1, driver: opts.traffic !== false,
      health: 100, dead: false,
    };
    cars.push(car);
    return car;
  }

  function spawnTraffic(count) {
    const colors = ['#d94f3d', '#4f8fd9', '#e8e8e8', '#5ab56a', '#8c6fd9', '#d9a03d'];
    for (let n = 0; n < count; n += 1) {
      const horizontal = random() < 0.5;
      const roadIndex = Math.floor(random() * 8);
      const along = 100 + random() * (WORLD.width - 200);
      const lane = ROAD.width * 0.25 + (random() < 0.5 ? 0 : ROAD.width * 0.5);
      const x = horizontal ? along : roadIndex * ROAD.spacing + lane;
      const y = horizontal ? roadIndex * ROAD.spacing + lane : along;
      addCar(x, y, horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2), {
        color: colors[Math.floor(random() * colors.length)],
        traffic: true,
        axis: horizontal ? 'h' : 'v',
        dir: random() < 0.5 ? 1 : -1,
      });
    }
    // A few parked cars the player can steal, one of them the yellow taxi.
    // Each sits on a road strip and faces along it, so it can drive away.
    const parkedSpots = [
      { x: 352, y: 176, angle: Math.PI / 2, taxi: false },
      { x: 992, y: 816, angle: -Math.PI / 2, taxi: false },
      { x: 1632, y: 496, angle: Math.PI / 2, taxi: false },
      { x: 1312, y: 992, angle: Math.PI / 2, taxi: true },
      { x: 1952, y: 1456, angle: Math.PI / 2, taxi: false },
      { x: 672, y: 496, angle: -Math.PI / 2, taxi: false },
      { x: 1312, y: 1456, angle: Math.PI / 2, taxi: false },
    ];
    for (const spot of parkedSpots) {
      addCar(spot.x, spot.y, spot.angle, {
        color: spot.taxi ? PALETTE.taxi : '#7a8699', parked: true, traffic: false,
      });
    }
  }

  function spawnPeds(count) {
    for (let n = 0; n < count; n += 1) {
      const x = 80 + random() * (WORLD.width - 160);
      const y = 80 + random() * (WORLD.height - 320);
      if (hitsBuilding(x, y, 4) || inWater(x, y)) continue;
      peds.push({
        x, y, angle: random() * Math.PI * 2, speed: 28 + random() * 30,
        color: PALETTE.ped[Math.floor(random() * PALETTE.ped.length)],
        state: 'walk', fleeX: 0, fleeY: 0, timer: 2 + random() * 6, down: false,
      });
    }
  }

  const state = {
    player, cars, peds, police, bullets, pickups, enforcers,
    buildings, parks, trees,
    cash: 0, wanted: 0, wantedTimer: 0, elapsed: 0,
    kills: 0, carsStolen: 0, missionsDone: 0, score: 0,
    message: '', messageTimer: 0, timeOfDay: 0.35,
  };

  function addWanted(amount) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + amount, 0, WANTED.max);
    if (state.wanted > before) state.wantedTimer = WANTED.decaySeconds;
    return state.wanted;
  }

  function nearestCar(x, y, maxDist, wantParkedOnly) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of cars) {
      if (car.dead || car.police) continue;
      if (wantParkedOnly && !car.parked && !car.traffic) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function spawnPolice() {
    const want = state.wanted === 0 ? 0 : 1 + Math.floor(state.wanted / 2);
    while (police.length < want) {
      const angle = random() * Math.PI * 2;
      const px = clamp(player.x + Math.cos(angle) * 520, 40, WORLD.width - 40);
      const py = clamp(player.y + Math.sin(angle) * 520, 40, WORLD.height - 80);
      const car = addCar(px, py, Math.atan2(player.y - py, player.x - px), { color: PALETTE.police, police: true, traffic: false });
      police.push({ car, shootTimer: 1 + random() * 2, ramTimer: 0 });
    }
  }

  function removePolice() {
    for (let i = police.length - 1; i >= 0; i -= 1) {
      const p = police[i];
      p.car.dead = true;
      police.splice(i, 1);
    }
    for (let i = cars.length - 1; i >= 0; i -= 1) if (cars[i].dead) cars.splice(i, 1);
  }

  function stepPlayer(dt, input) {
    let events = 0;
    const p = player;
    if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);
    if (p.inCar) {
      const car = p.inCar;
      const forward = Math.cos(car.angle);
      const right = Math.sin(car.angle);
      let throttle = 0;
      if (input.up) throttle = 1;
      else if (input.down) throttle = car.speed > 10 ? -1 : -0.5;
      car.speed += throttle * (throttle > 0 ? CAR.accel : CAR.brake) * dt;
      car.speed -= car.speed * CAR.drag * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      if (Math.abs(car.speed) > 5) {
        car.angle -= input.steer * CAR.steer * dt * (car.speed > 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120);
      }
      const nx = car.x + forward * car.speed * dt;
      const ny = car.y + right * car.speed * dt;
      if (blocked(nx, car.y, 14)) { car.speed *= -0.25; }
      else car.x = nx;
      if (blocked(car.x, ny, 14)) { car.speed *= -0.25; }
      else car.y = ny;
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
      // Hitting pedestrians or traffic while speeding is a crime.
      for (const ped of peds) {
        if (!ped.down && dist2(p.x, p.y, ped.x, ped.y) < 26 * 26 && Math.abs(car.speed) > 60) {
          ped.down = true;
          addWanted(WANTED.hitPed);
          events |= EVENT_CRIME;
          state.message = 'Pedestrian hit! The police are coming.';
          state.messageTimer = 3;
        }
      }
      for (const other of cars) {
        if (other !== car && !other.dead && dist2(p.x, p.y, other.x, other.y) < 30 * 30 && Math.abs(car.speed) > 120) {
          other.speed = 0;
          if (other.traffic) { addWanted(WANTED.hitCar); events |= EVENT_CRIME; }
        }
      }
      return;
    }
    // On foot.
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = input.moveX;
    let my = input.moveY;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; p.angle = Math.atan2(my, mx); }
    const nx = p.x + mx * speed * dt;
    const ny = p.y + my * speed * dt;
    if (!blocked(nx, p.y, PLAYER.radius)) p.x = nx;
    if (!blocked(p.x, ny, PLAYER.radius)) p.y = ny;
    p.speed = len > 0 ? speed : 0;
    p.running = input.run && len > 0;
    return events;
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (!car.traffic || car.dead) continue;
      // Keep to the road: if it drifted off, steer back onto the nearest road centre.
      const ahead = { x: car.x + Math.cos(car.angle) * 40, y: car.y + Math.sin(car.angle) * 40 };
      let blockedAhead = blocked(ahead.x, ahead.y, 12) || !onRoad(ahead.x, ahead.y);
      // A car ahead on the same road makes this one slow down.
      for (const other of cars) {
        if (other !== car && !other.dead && dist2(ahead.x, ahead.y, other.x, other.y) < 34 * 34) blockedAhead = true;
      }
      const target = blockedAhead ? 0 : CAR.trafficSpeed;
      car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.x < 30 || car.x > WORLD.width - 30 || car.y < 30 || car.y > WORLD.height - 100) {
        car.angle += Math.PI;
        car.x = clamp(car.x, 30, WORLD.width - 30);
        car.y = clamp(car.y, 30, WORLD.height - 100);
      }
      // At an intersection (both road strips cross), sometimes turn onto the other road.
      if (onRoad(car.x, car.y) && car.x % ROAD.spacing < 70 && car.y % ROAD.spacing < 70 && random() < dt * 0.12) {
        car.angle += (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (ped.down) continue;
      ped.timer -= dt;
      const threat = state.wanted >= 2 || (player.inCar && Math.abs(player.speed) > 200);
      const dPlayer = distance(ped.x, ped.y, player.x, player.y);
      if (threat && dPlayer < 260) {
        ped.state = 'flee';
        ped.fleeX = ped.x - player.x;
        ped.fleeY = ped.y - player.y;
      } else if (ped.state === 'flee' && dPlayer > 320) ped.state = 'walk';
      let dirX = Math.cos(ped.angle);
      let dirY = Math.sin(ped.angle);
      if (ped.state === 'flee') {
        const l = Math.hypot(ped.fleeX, ped.fleeY) || 1;
        dirX = ped.fleeX / l; dirY = ped.fleeY / l;
        ped.angle = Math.atan2(dirY, dirX);
      } else if (ped.timer <= 0) {
        ped.timer = 3 + random() * 6;
        // Wander along sidewalks: pick a road direction.
        ped.angle = (Math.floor(random() * 4) * Math.PI) / 2;
      }
      const speed = ped.state === 'flee' ? ped.speed * 2.2 : ped.speed;
      const nx = ped.x + dirX * speed * dt;
      const ny = ped.y + dirY * speed * dt;
      if (!blocked(nx, ped.y, 6)) ped.x = nx;
      if (!blocked(ped.x, ny, 6)) ped.y = ny;
    }
  }

  function stepPolice(dt) {
    let events = 0;
    if (state.wanted > 0) spawnPolice();
    else if (police.length > 0) removePolice();
    for (let i = police.length - 1; i >= 0; i -= 1) {
      const unit = police[i];
      const car = unit.car;
      const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
      let diff = targetAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const wantSpeed = 300 + state.wanted * 32;
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!blocked(nx, car.y, 14)) car.x = nx;
      if (!blocked(car.x, ny, 14)) car.y = ny;
      // Ramming the player hurts and raises the heat.
      if (dist2(car.x, car.y, player.x, player.y) < 30 * 30) {
        if (player.inCar) {
          player.inCar.speed *= 0.4;
        } else if (player.invulnerable === 0) {
          player.health -= 8;
          player.invulnerable = 1;
          events |= EVENT_HIT;
        }
        unit.ramTimer = 0.6;
      }
      // At three stars and up, police shoot at the player.
      unit.shootTimer -= dt;
      if (state.wanted >= 3 && unit.shootTimer <= 0 && distance(car.x, car.y, player.x, player.y) < 420) {
        unit.shootTimer = 1.4 + random() * 1.2;
        const a = Math.atan2(player.y - car.y, player.x - car.x) + (random() - 0.5) * 0.25;
        bullets.push({ x: car.x, y: car.y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, fromPolice: true, life: 1.2 });
      }
    }
    return events;
  }

  function stepBullets(dt) {
    let events = 0;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let gone = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height || hitsBuilding(b.x, b.y, 1);
      if (!gone && b.fromPolice) {
        if (player.inCar) {
          if (dist2(b.x, b.y, player.x, player.y) < 24 * 24) { player.inCar.health -= 4; gone = true; }
        } else if (dist2(b.x, b.y, player.x, player.y) < 14 * 14 && player.invulnerable === 0) {
          player.health -= 9;
          player.invulnerable = 0.4;
          events |= EVENT_HIT;
          gone = true;
        }
      }
      if (!gone && !b.fromPolice) {
        for (const e of enforcers) {
          if (!e.down && dist2(b.x, b.y, e.x, e.y) < 16 * 16) {
            e.health -= PLAYER.pistolDamage;
            gone = true;
            if (e.health <= 0) {
              e.down = true;
              state.kills += 1;
              state.cash += 60;
              state.message = 'Enforcer down. +$60';
              state.messageTimer = 2;
            }
            break;
          }
        }
        if (!gone) {
          for (const unit of police) {
            if (dist2(b.x, b.y, unit.car.x, unit.car.y) < 24 * 24) {
              unit.car.health -= PLAYER.pistolDamage;
              gone = true;
              if (unit.car.health <= 0) {
                unit.car.dead = true;
                state.kills += 1;
                addWanted(WANTED.kill);
                events |= EVENT_CRIME;
              }
              break;
            }
          }
        }
      }
      if (gone) bullets.splice(i, 1);
    }
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      if (cars[i].dead && cars[i].police) {
        const idx = police.findIndex((u) => u.car === cars[i]);
        if (idx >= 0) police.splice(idx, 1);
        cars.splice(i, 1);
      }
    }
    // Enforcers shoot back at the player.
    for (const e of enforcers) {
      if (e.down) continue;
      e.shootTimer -= dt;
      const d = distance(e.x, e.y, player.x, player.y);
      if (d < 460 && e.shootTimer <= 0) {
        e.shootTimer = 1.6 + random() * 1.4;
        const a = Math.atan2(player.y - e.y, player.x - e.x) + (random() - 0.5) * 0.3;
        bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 580, vy: Math.sin(a) * 580, fromPolice: true, life: 1.1 });
      }
    }
    return events;
  }

  function stepPickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pk = pickups[i];
      if (dist2(pk.x, pk.y, player.x, player.y) < 30 * 30) {
        if (pk.kind === 'cash') { state.cash += pk.amount; state.message = `+$${pk.amount}`; }
        else if (pk.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + 40); state.message = 'Health +40'; }
        else if (pk.kind === 'ammo') { player.ammo += 24; state.message = 'Ammo +24'; }
        state.messageTimer = 2;
        pickups.splice(i, 1);
      }
    }
  }

  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    state.timeOfDay = (0.35 + state.elapsed / 600) % 1;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (player.health < PLAYER.health) player.health = Math.min(PLAYER.health, player.health + dt * 1.2);
    // Wanted decays after a quiet spell; any fresh crime resets the timer.
    if (state.wanted > 0) {
      state.wantedTimer -= dt;
      if (state.wantedTimer <= 0) {
        state.wanted -= 1;
        state.wantedTimer = state.wanted > 0 ? WANTED.decaySeconds : 0;
        if (state.wanted === 0) state.message = 'You lost the police.';
      }
    }
    events |= stepPlayer(dt, input);
    stepTraffic(dt);
    stepPeds(dt);
    events |= stepPolice(dt);
    events |= stepBullets(dt);
    stepPickups(dt);
    if (player.health <= 0) {
      events |= EVENT_OVER;
      player.health = 0;
    }
    return events;
  }

  function reset() {
    player.x = PLACES.safehouse.x;
    player.y = PLACES.safehouse.y;
    player.angle = 0;
    player.health = PLAYER.health;
    player.cash = 0;
    player.ammo = PLAYER.ammoStart;
    player.inCar = null;
    player.speed = 0;
    player.invulnerable = 0;
    cars.length = 0;
    peds.length = 0;
    police.length = 0;
    bullets.length = 0;
    pickups.length = 0;
    enforcers.length = 0;
    carId = 0;
    state.cash = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.elapsed = 0;
    state.kills = 0;
    state.carsStolen = 0;
    state.missionsDone = 0;
    state.score = 0;
    state.message = '';
    state.messageTimer = 0;
    spawnTraffic(16);
    spawnPeds(26);
    pickups.push({ x: 1056, y: 432, kind: 'health', amount: 0 });
    pickups.push({ x: 672, y: 1456, kind: 'ammo', amount: 0 });
    pickups.push({ x: 2080, y: 752, kind: 'cash', amount: 120 });
  }

  function enterCar() {
    if (player.inCar) return true;
    const car = nearestCar(player.x, player.y, 70);
    if (!car) return false;
    if (car.traffic && car.driver) {
      car.driver = false;
      car.traffic = false;
      car.parked = false;
      addWanted(WANTED.steal);
      state.carsStolen += 1;
      state.message = 'Car stolen! Wanted +1 star.';
      state.messageTimer = 3;
    } else if (car.parked) {
      car.parked = false;
      addWanted(WANTED.steal);
      state.carsStolen += 1;
      state.message = 'Car stolen! Wanted +1 star.';
      state.messageTimer = 3;
    }
    player.inCar = car;
    car.speed = 0;
    return true;
  }

  function exitCar() {
    if (!player.inCar) return false;
    const car = player.inCar;
    player.inCar = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    if (blocked(player.x, player.y, PLAYER.radius)) {
      player.x = car.x - Math.cos(car.angle + Math.PI / 2) * 30;
      player.y = car.y - Math.sin(car.angle + Math.PI / 2) * 30;
    }
    return true;
  }

  function shoot(angle) {
    if (player.ammo <= 0 || player.inCar) return false;
    player.ammo -= 1;
    bullets.push({
      x: player.x + Math.cos(angle) * 18, y: player.y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * 640, vy: Math.sin(angle) * 640, fromPolice: false, life: 0.9,
    });
    addWanted(0);
    return true;
  }

  function fireAt(angle) {
    if (shoot(angle)) {
      if (state.wanted < 1) addWanted(WANTED.shoot);
    }
  }

  reset();
  return {
    state, reset, step, enterCar, exitCar, fireAt, addWanted,
    nearestCar, onRoad, inWater, blocked, hitsBuilding,
    spawnEnforcers(x, y, count) {
      for (let i = 0; i < count; i += 1) {
        // Find open ground near the point (never inside a building or the water),
        // so every enforcer can actually be reached and shot.
        let ex = x;
        let ey = y;
        for (let tries = 0; tries < 24; tries += 1) {
          const cx = x + (random() - 0.5) * 220;
          const cy = y + (random() - 0.5) * 220;
          if (!blocked(cx, cy, 14)) { ex = cx; ey = cy; break; }
        }
        enforcers.push({
          x: ex, y: ey,
          health: 100, down: false, shootTimer: 1 + random() * 2,
        });
      }
    },
    addPickup(x, y, kind, amount) {
      pickups.push({ x, y, kind, amount });
    },
    placePlayer(x, y) {
      player.x = x; player.y = y;
      if (player.inCar) { player.inCar.x = x; player.inCar.y = y; }
    },
  };
}
