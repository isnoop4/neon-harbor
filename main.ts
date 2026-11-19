// Neon Harbor — a gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and
// no network request), and this program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. Neon Harbor is a 2D top-down open-world crime game:
// you are Rae Voss, a courier new to the harbour city, taking jobs from the
// fixer Marla Quinn — explore on foot or by car, steal cars, dodge the
// harbour police and their wanted stars, fight with a pistol, and run four
// story missions, with a HUD, a live minimap and a save that carries your
// progress. Before it copies anything, the program runs a pre-flight gate
// that refuses an entry the scorer would refuse, so a broken submission
// fails loudly here instead of on the judge's table.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (reference/gate.json), in one place so the gate
// below and the dossier builder can never drift apart: only text_max_bytes
// shapes the dossier bytes; the rest refuse an entry the scorer would
// refuse.
const TEXT_MAX_BYTES = 163840;
const SHOT_MAX_COUNT = 4;
const SHOT_MIN_COUNT = 3;
const SHOT_MAX_BYTES = 262144;
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const GAME_PATH_MAX_BYTES = 1000;

// Walk a directory tree and tally its files. Returns the file count, the
// total byte size, and the longest relative path in bytes, so the gate can
// name the file that breaks a cap instead of failing in silence.
function tallyTree(root, rel = '') {
  let files = 0;
  let bytes = 0;
  let longest = { path: rel, size: Buffer.byteLength(rel) };
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const sub = tallyTree(root, childRel);
      files += sub.files;
      bytes += sub.bytes;
      if (sub.longest.size > longest.size) longest = sub.longest;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(join(root, childRel)).size;
      const size = Buffer.byteLength(childRel);
      if (size > longest.size) longest = { path: childRel, size };
    }
  }
  return { files, bytes, longest };
}

// Pre-flight gate: refuse the entry before anything is copied when any
// scorer cap is broken. It only reads the source tree and throws; it
// writes nothing into /output, so a passing run leaves the dossier
// byte-identical to a run without the gate.
function checkEntry(here) {
  const index = join(here, 'game', 'index.html');
  if (!existsSync(index)) {
    throw new Error(`entrypoint gate: game/index.html is missing (expected at ${index})`);
  }

  const shotsDir = join(here, 'screenshots');
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((name) => statSync(join(shotsDir, name)).isFile())
    : [];
  if (shots.length < SHOT_MIN_COUNT || shots.length > SHOT_MAX_COUNT) {
    throw new Error(
      `entrypoint gate: screenshots/ holds ${shots.length} files, cap is ${SHOT_MIN_COUNT}-${SHOT_MAX_COUNT}`,
    );
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > SHOT_MAX_BYTES) {
      throw new Error(
        `entrypoint gate: screenshots/${name} is ${size} bytes, cap is ${SHOT_MAX_BYTES} bytes`,
      );
    }
  }

  const game = tallyTree(join(here, 'game'));
  if (game.files > GAME_MAX_FILES) {
    throw new Error(`entrypoint gate: game/ holds ${game.files} files, cap is ${GAME_MAX_FILES}`);
  }
  if (game.bytes > GAME_MAX_BYTES) {
    throw new Error(`entrypoint gate: game/ totals ${game.bytes} bytes, cap is ${GAME_MAX_BYTES} bytes`);
  }
  if (game.longest.size > GAME_PATH_MAX_BYTES) {
    throw new Error(
      `entrypoint gate: game/${game.longest.path} is ${game.longest.size} bytes long, cap is ${GAME_PATH_MAX_BYTES} bytes`,
    );
  }
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

checkEntry(here);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The dossier the judge reads, built with the same caps the gate just
// checked, so what passes here is what the scorer accepts.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: SHOT_MAX_COUNT, max_bytes: SHOT_MAX_BYTES },
    game_max_files: GAME_MAX_FILES,
    game_max_bytes: GAME_MAX_BYTES,
    game_path_max_bytes: GAME_PATH_MAX_BYTES,
  }),
);
