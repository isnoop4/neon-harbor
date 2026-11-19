// Drawing only: the world's state and the current screen in, pixels out. A camera
// follows the player through the 2560x1920 city; the 1280x720 view is scaled to fit
// the window. Flat shapes, canvas text for the HUD, the minimap and the panels.
import { FIELD, FONT, PALETTE, ROAD, STORY, WORLD } from './config.js';
import { PLACES } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MINIMAP = { x: 1024, y: 16, w: 240, h: 180 };

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 640, y: 360 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function worldToScreen(x, y) {
    return { x: (x - camera.x) * 1 + FIELD.width / 2, y: (y - camera.y) + FIELD.height / 2 };
  }

  function drawCity(state) {
    const left = camera.x - FIELD.width / 2 - 40;
    const top = camera.y - FIELD.height / 2 - 40;
    const right = camera.x + FIELD.width / 2 + 40;
    const bottom = camera.y + FIELD.height / 2 + 40;
    // Ground: grass blocks, sand beach, harbour water at the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(left, top, right - left, bottom - top);
    context.fillStyle = PALETTE.sand;
    context.fillRect(Math.max(left, 0), 1728, Math.min(right, WORLD.width) - Math.max(left, 0), 64);
    context.fillStyle = PALETTE.water;
    context.fillRect(Math.max(left, 0), 1792, Math.min(right, WORLD.width) - Math.max(left, 0), WORLD.height - 1792);
    context.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < WORLD.width; x += 160) {
      context.fillRect(x + 40, 1830, 70, 6);
      context.fillRect(x + 110, 1870, 50, 5);
    }
    // Parks.
    for (const park of state.parks) {
      if (park.x > right || park.x + park.w < left || park.y > bottom || park.y + park.h < top) continue;
      context.fillStyle = PALETTE.parkDark;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    // Roads: dark strips with a dashed centre line, plus sidewalks.
    context.fillStyle = PALETTE.road;
    for (let i = 0; i < 8; i += 1) {
      const v = i * ROAD.spacing;
      if (v < right && v + ROAD.width > left) context.fillRect(v, Math.max(top, 0), ROAD.width, Math.min(bottom, WORLD.height) - Math.max(top, 0));
      if (v < bottom && v + ROAD.width > top) context.fillRect(Math.max(left, 0), v, Math.min(right, WORLD.width) - Math.max(left, 0), ROAD.width);
    }
    context.fillStyle = PALETTE.roadLine;
    for (let i = 0; i < 8; i += 1) {
      const v = i * ROAD.spacing + ROAD.width / 2;
      for (let d = 0; d < WORLD.width; d += 64) {
        if (v > top && v < bottom && d > left && d < right) context.fillRect(d, v - 2, 32, 4);
        if (v > left && v < right && d > top && d < bottom) context.fillRect(v - 2, d, 4, 32);
      }
    }
    // Trees.
    for (const tree of state.trees) {
      if (tree.x < left || tree.x > right || tree.y < top || tree.y > bottom) continue;
      context.fillStyle = '#2c5a33';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3f8a4a';
      context.beginPath();
      context.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
    // Buildings: coloured blocks with a darker roof edge and lit windows.
    for (const b of state.buildings) {
      if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.roof;
      context.fillRect(b.x, b.y, b.w, 8);
      context.fillRect(b.x, b.y, 8, b.h);
      if (b.tall) {
        context.fillStyle = 'rgba(255,255,255,0.12)';
        context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      }
      context.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 3 + Math.floor(b.x)) % 5 === 0) continue;
          context.fillRect(b.x + 14 + c * 26, b.y + 16 + r * 26, 10, 12);
        }
      }
    }
    // Place labels.
    context.font = `600 13px ${FONT}`;
    context.fillStyle = 'rgba(255,255,255,0.75)';
    context.textAlign = 'left';
    for (const key of Object.keys(PLACES)) {
      const place = PLACES[key];
      if (place.x < left || place.x > right || place.y < top || place.y > bottom) continue;
      context.fillText(place.label, place.x + 10, place.y - 8);
    }
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(-CAR_LEN / 2 + 3, -CAR_WID / 2 + 3, CAR_LEN, CAR_WID);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-CAR_LEN / 2, -CAR_WID / 2, CAR_LEN, CAR_WID, 8);
    context.fill();
    context.fillStyle = '#1c2733';
    context.beginPath();
    context.roundRect(-8, -CAR_WID / 2 + 4, 20, CAR_WID - 8, 4);
    context.fill();
    context.fillStyle = '#ffe9a3';
    context.fillRect(CAR_LEN / 2 - 3, -CAR_WID / 2 + 3, 3, 6);
    context.fillRect(CAR_LEN / 2 - 3, CAR_WID / 2 - 9, 3, 6);
    context.fillStyle = '#ff5a4d';
    context.fillRect(-CAR_LEN / 2, -CAR_WID / 2 + 3, 3, 6);
    context.fillRect(-CAR_LEN / 2, CAR_WID / 2 - 9, 3, 6);
    if (car.taxi) {
      context.fillStyle = '#1c1c22';
      context.fillRect(-14, -5, 26, 10);
      context.fillStyle = '#ffc233';
      context.font = `700 8px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('TAXI', -1, 3);
    }
    if (car.police) {
      const flash = Math.floor(time * 6) % 2 === 0;
      context.fillStyle = flash ? '#ff3b30' : '#2f6fd6';
      context.fillRect(-6, -CAR_WID / 2 - 2, 12, 5);
      context.fillStyle = flash ? '#2f6fd6' : '#ff3b30';
      context.fillRect(-6, CAR_WID / 2 - 3, 12, 5);
    }
    context.restore();
  }
  const CAR_LEN = 54;
  const CAR_WID = 26;

  function drawPed(ped) {
    if (ped.down) {
      context.fillStyle = PALETTE.blood;
      context.beginPath();
      context.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1c1c22';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 3.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawWorld(state, time) {
    drawCity(state);
    // Pickups.
    for (const pk of state.pickups) {
      context.fillStyle = pk.kind === 'health' ? '#3fd68a' : pk.kind === 'ammo' ? '#ffd23f' : '#7fe08a';
      context.beginPath();
      context.arc(pk.x, pk.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#10141f';
      context.font = `700 11px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + 4);
    }
    // Mission target ring.
    const target = state.missionTarget;
    if (target) {
      const pulse = 26 + Math.sin(time * 4) * 5;
      context.strokeStyle = PALETTE.mission;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(target.x, target.y, pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.mission;
      context.beginPath();
      context.arc(target.x, target.y, 6, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) if (!car.dead) drawCar(car, time);
    for (const ped of state.peds) drawPed(ped);
    for (const e of state.enforcers) {
      if (e.down) {
        context.fillStyle = PALETTE.blood;
        context.beginPath();
        context.arc(e.x, e.y, 11, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.fillStyle = '#3a2b3f';
      context.beginPath();
      context.arc(e.x, e.y, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ff5a4d';
      context.beginPath();
      context.arc(e.x, e.y, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Bullets.
    context.fillStyle = PALETTE.bullet;
    for (const b of state.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    // Player.
    const p = state.player;
    if (!p.inCar && !(p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0)) {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(p.x, p.y, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.playerOutline;
      context.lineWidth = 3;
      context.stroke();
      // Aim direction.
      context.strokeStyle = 'rgba(255,207,63,0.9)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
      context.stroke();
      // Health ring.
      context.strokeStyle = 'rgba(255,255,255,0.5)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, p.y, 17, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.health) / 100);
      context.stroke();
    }
    if (p.inCar) {
      context.strokeStyle = '#ffcf3f';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, p.y, 36, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawMinimap(state, missions) {
    const { x, y, w, h } = MINIMAP;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    context.fillStyle = 'rgba(16,20,31,0.85)';
    context.fillRect(x - 4, y - 4, w + 8, h + 8);
    context.fillStyle = '#22303f';
    context.fillRect(x, y, w, h);
    context.fillStyle = PALETTE.water;
    context.fillRect(x, y + 1792 * sy, w, (WORLD.height - 1792) * sy);
    context.strokeStyle = '#4a5568';
    context.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const v = i * ROAD.spacing;
      context.beginPath();
      context.moveTo(x + v * sx, y);
      context.lineTo(x + v * sx, y + h);
      context.stroke();
      context.beginPath();
      context.moveTo(x, y + v * sy);
      context.lineTo(x + w, y + v * sy);
      context.stroke();
    }
    const dot = (wx, wy, color, r) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
      context.fill();
    };
    const target = missions ? missions.targetPlace() : null;
    if (target) dot(target.x, target.y, PALETTE.mission, 6);
    dot(PLACES.safehouse.x, PLACES.safehouse.y, PALETTE.safehouse, 4);
    for (const unit of state.police) dot(unit.car.x, unit.car.y, '#5aa0ff', 3);
    dot(state.player.x, state.player.y, PALETTE.player, 4);
    context.strokeStyle = '#f2f4f8';
    context.lineWidth = 1;
    context.strokeRect(x - 4, y - 4, w + 8, h + 8);
    context.fillStyle = 'rgba(16,20,31,0.85)';
    context.fillRect(x, y + h - 18, w, 18);
    text('NEON HARBOR', x + 4, y + h - 5, 12, PALETTE.hudText, 'left');
  }

  function drawHud(state, missions, time) {
    const p = state.player;
    context.fillStyle = 'rgba(16,20,31,0.82)';
    context.fillRect(12, 12, 300, 86);
    text(`$${state.cash}`, 24, 40, 26, '#7fe08a', 'left');
    text(`Ammo ${p.ammo}`, 24, 66, 16, PALETTE.hudText, 'left');
    text(`Missions ${state.missionsDone}/4`, 24, 88, 16, PALETTE.hudText, 'left');
    // Health bar.
    context.fillStyle = '#3a2020';
    context.fillRect(160, 24, 140, 16);
    context.fillStyle = p.health > 40 ? '#3fd68a' : '#ff5a4d';
    context.fillRect(160, 24, (140 * p.health) / 100, 16);
    text('HP', 160, 58, 13, PALETTE.muted, 'left');
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text('\u2605', 170 + i * 26, 84, 22, i < state.wanted ? PALETTE.star : '#3a4152', 'left');
    }
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.speed) * 0.32);
      text(`${kmh} km/h`, 24, 128, 22, PALETTE.hudText, 'left');
    }
    drawMinimap(state, missions);
    // Mission objective + message.
    const objective = missions ? missions.objectiveText() : '';
    context.fillStyle = 'rgba(16,20,31,0.82)';
    context.fillRect(12, FIELD.height - 76, 620, 52);
    context.fillStyle = PALETTE.mission;
    context.fillRect(12, FIELD.height - 76, 5, 52);
    text(objective, 28, FIELD.height - 42, 16, PALETTE.hudText, 'left');
    if (state.messageTimer > 0 && state.message) {
      text(state.message, FIELD.width / 2, 120, 22, '#ffd23f', 'center');
    }
    const banner = missions ? missions.banner : '';
    if (banner) {
      text(banner, FIELD.width / 2, 160, 26, '#7fe08a', 'center');
    }
    text('WASD move / drive  \u00b7  E steal & exit car  \u00b7  Click shoot  \u00b7  Shift run  \u00b7  Q save  \u00b7  P pause', 12, FIELD.height - 6, 13, PALETTE.muted, 'left');
  }

  function drawPanel(title, lines, prompt) {
    const width = 680;
    // Wrap long lines so no text runs past the panel's edges.
    const wrapped = [];
    for (const line of lines) {
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        context.font = `18px ${FONT}`;
        if (context.measureText(next).width > width - 60 && current) {
          wrapped.push(current);
          current = word;
        } else current = next;
      }
      if (current) wrapped.push(current);
    }
    const height = 200 + wrapped.length * 30;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(16,20,31,0.94)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = '#ff5fa2';
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 64, 44, '#ffcf3f', 'center');
    for (let i = 0; i < wrapped.length; i += 1) {
      text(wrapped[i], FIELD.width / 2, y + 112 + i * 30, 18, PALETTE.hudText, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 28, 20, '#7fe08a', 'center');
  }

  /** Paint one frame. `ui` carries the screen, missions and save state. */
  function draw(state, ui) {
    const time = state.elapsed;
    camera.x = clamp(state.player.x, FIELD.width / 2, WORLD.width - FIELD.width / 2);
    camera.y = clamp(state.player.y, FIELD.height / 2, WORLD.height - FIELD.height / 2);
    if (ui.screen === SCREEN_TITLE) {
      camera.x = 1280;
      camera.y = 960;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Translate the world so the camera centre lands in the middle of the view.
    context.save();
    context.translate(FIELD.width / 2 - camera.x, FIELD.height / 2 - camera.y);
    drawWorld(state, time);
    context.restore();
    if (ui.screen === SCREEN_TITLE) {
      drawPanel('NEON HARBOR', [
        STORY.intro,
        `${STORY.hero} takes jobs from ${STORY.fixer} in a sun-soaked harbour city.`,
        'Steal cars, dodge the police, run four jobs, and make the city yours.',
        ui.hasSave ? 'A saved game is waiting — press C to continue it.' : '',
      ].filter(Boolean), 'Press Space or click to start  \u00b7  C continue saved game');
      return;
    }
    drawHud(state, ui.missions, time);
    if (ui.screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The harbour waits for no one — except now.'], 'Press P to resume  \u00b7  Q save game');
    } else if (ui.screen === SCREEN_OVER) {
      drawPanel('Busted', [`${STORY.hero} was caught. Cash kept: $${state.cash}. Missions done: ${state.missionsDone}/4.`], 'Press Space to start over');
    }
  }

  resize();
  window.addEventListener('resize', resize);

  // Convert a point in canvas CSS pixels to world coordinates, for mouse aiming.
  function screenToWorld(cssX, cssY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const logicalX = (cssX * dpr - view.x) / view.scale;
    const logicalY = (cssY * dpr - view.y) / view.scale;
    return {
      x: logicalX - FIELD.width / 2 + camera.x,
      y: logicalY - FIELD.height / 2 + camera.y,
    };
  }

  return { draw, screenToWorld };
}
