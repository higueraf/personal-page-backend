/**
 * readline-sync shim for the Playground execution environment.
 *
 * The real readline-sync package bypasses process.stdin and opens /dev/tty
 * directly via a helper shell script. This fails in any environment without
 * a physical terminal (containers, WebSocket-driven execution, etc.).
 *
 * This shim re-implements the most commonly used readline-sync APIs on top
 * of synchronous reads from fd 0 (process.stdin), which works perfectly
 * when stdin is piped from the WebSocket gateway.
 */

'use strict';

const fs = require('fs');

// ── Core: synchronous line read from stdin (fd 0) ────────────────────────────

function readLineSync(prompt) {
  if (prompt) process.stdout.write(String(prompt));

  const buf = Buffer.alloc(1);
  let line = '';

  while (true) {
    let bytesRead;
    try {
      bytesRead = fs.readSync(0, buf, 0, 1);
    } catch {
      // stdin closed or unreadable
      break;
    }
    if (bytesRead === 0) break; // EOF

    const ch = buf.toString('utf8');
    if (ch === '\n') break;
    if (ch === '\r') continue; // ignore CR in CRLF
    line += ch;
  }

  return line;
}

// ── Public API (mirrors the real readline-sync) ──────────────────────────────

exports.question = function question(prompt, _options) {
  return readLineSync(prompt);
};

exports.prompt = function prompt(options) {
  const p = (options && options.prompt != null) ? options.prompt : '> ';
  return readLineSync(p);
};

exports.questionInt = function questionInt(prompt, _options) {
  const answer = readLineSync(prompt);
  const n = parseInt(answer, 10);
  return isNaN(n) ? 0 : n;
};

exports.questionFloat = function questionFloat(prompt, _options) {
  const answer = readLineSync(prompt);
  const n = parseFloat(answer);
  return isNaN(n) ? 0 : n;
};

exports.questionPath = function questionPath(prompt, _options) {
  return readLineSync(prompt);
};

exports.questionEMail = function questionEMail(prompt, _options) {
  return readLineSync(prompt);
};

exports.questionNewPassword = function questionNewPassword(prompt, _options) {
  return readLineSync(prompt);
};

exports.keyIn = function keyIn(prompt, _options) {
  const answer = readLineSync(prompt);
  return answer.length > 0 ? answer[0] : '';
};

exports.keyInYN = function keyInYN(prompt, _options) {
  const answer = readLineSync(prompt);
  if (!answer) return null;
  const ch = answer[0].toLowerCase();
  if (ch === 'y' || ch === 's') return true;   // 's' for Spanish "sí"
  if (ch === 'n') return false;
  return null;
};

exports.keyInYNStrict = function keyInYNStrict(prompt, _options) {
  const answer = readLineSync(prompt);
  if (!answer) return false;
  const ch = answer[0].toLowerCase();
  return ch === 'y' || ch === 's';
};

exports.keyInPause = function keyInPause(prompt, _options) {
  readLineSync(prompt || 'Press any key to continue...');
};

exports.keyInSelect = function keyInSelect(items, prompt, _options) {
  if (prompt) process.stdout.write(String(prompt) + '\n');
  items.forEach((item, i) => {
    process.stdout.write(`[${i + 1}] ${item}\n`);
  });
  process.stdout.write('[0] CANCEL\n');
  const answer = readLineSync('> ');
  const idx = parseInt(answer, 10);
  if (isNaN(idx) || idx < 0 || idx > items.length) return -1;
  return idx - 1; // 0 → CANCEL = -1, 1 → index 0, etc.
};

// ── Setters (no-ops for compatibility) ───────────────────────────────────────

exports.setDefaultOptions = function setDefaultOptions(_options) { return exports; };
exports.setEncoding = function setEncoding(_encoding) { return exports; };
exports.setPrint = function setPrint(_fn) { return exports; };
exports.setPrompt = function setPrompt(_prompt) { return exports; };
exports.setBufferSize = function setBufferSize(_size) { return exports; };
exports.setMask = function setMask(_mask) { return exports; };
