// A working gta6-meme-x-01 entry (Node 22, standard library only): it hands the
// house the address of the X post that is the entry. It reads POST.json from the
// repository, checks it is a JSON object naming one X post, and writes that
// address out as /output/POST.json in one canonical form, so the two runs the
// grader does write the same bytes.
//
// Nothing this program writes about the post is judged: the post itself is the
// entry, the house reads it from X (its first picture and its text) and hands
// that to the judge. What this program adds over a plain copy:
//   - a UTF-8 byte-order mark at the start of POST.json is tolerated (some
//     editors add one; a strict JSON reader refuses it), and the output never
//     carries one;
//   - a missing, malformed or placeholder POST.json fails here, loudly,
//     instead of handing the gate an entry it must refuse;
//   - the file must name only the post: any extra key is refused, so a
//     stray field cannot silently change what the entry points at;
//   - the address is checked to be one X post's address before it is written
//     out, so a typo in the handle or the status id is caught at once;
//   - the status id must look like a real one (at least 15 digits), so a
//     truncated id copied by hand is caught at once;
//   - the output is written to a temporary file and renamed into place, so
//     a half-written POST.json never lands in the output directory.
//
// No network, no wall clock, no files outside the repository:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// One X post's address, as X shows it: the status id is digits only, and a
// real one is long (modern posts carry 19-digit snowflake ids).
const POST_URL = /^https:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/([0-9]+)$/;

function fail(message: string): never {
  console.error(`POST.json: ${message}`);
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

let text: string;
try {
  text = readFileSync(join(BOT_DIR, 'POST.json'), 'utf8');
} catch (err) {
  fail(`could not be read from ${BOT_DIR}: ${(err as Error).message}`);
}

// Tolerate a UTF-8 byte-order mark at the start of the file.
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

let post: unknown;
try {
  post = JSON.parse(text);
} catch (err) {
  fail(`is not valid JSON: ${(err as Error).message}`);
}

if (typeof post !== 'object' || post === null || Array.isArray(post)) {
  fail('must be a JSON object naming the post, {"url": "https://x.com/<handle>/status/<id>"}');
}

// Exactly one key: anything else is a stray field, not part of the entry.
const keys = Object.keys(post);
if (keys.length !== 1 || keys[0] !== 'url') {
  fail(
    `must name only the post, {"url": "https://x.com/<handle>/status/<id>"}; ` +
      `unexpected keys: ${keys.filter((k) => k !== 'url').join(', ') || '(none, url missing)'}`,
  );
}

const url = (post as { url?: unknown }).url;
const match = typeof url === 'string' ? POST_URL.exec(url) : null;
if (!match) {
  fail(
    'must name one X post, {"url": "https://x.com/<handle>/status/<id>"}; ' +
      'a placeholder or any other address is refused by the gate',
  );
}

// A real status id is long; a short one is a truncated copy, not a post.
// (Capture group 2 is the id; group 1 is the domain.)
if (match[2].length < 15) {
  fail(`status id ${match[2]} is too short to be a real X post id (at least 15 digits)`);
}

// One canonical form, so both runs write the same bytes. Written to a
// temporary file and renamed into place, so the output is never half-written.
const tmp = join(OUTPUT_DIR, '.POST.json.tmp');
writeFileSync(tmp, JSON.stringify({ url }, null, 2) + '\n', 'utf8');
renameSync(tmp, join(OUTPUT_DIR, 'POST.json'));
