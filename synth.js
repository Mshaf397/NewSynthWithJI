// == Synth state ==
const keyboard = document.getElementById('keyboard');
const baseFreqInput = document.getElementById('baseFreq');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('cols');
const rootNoteInput = document.getElementById('rootNote');
const tuningInput = document.getElementById('tuning');
const noteNamesInput = document.getElementById('noteNames');

let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let activeOscillators = new Map(); // keyIndex -> oscillator node

// Synth parameters
let baseFreq = 261.63;
let rows = 4;
let cols = 12;
let rootNote = 0;
let noteNames = [];
let tuningData = { type: "edo", steps: 12, interval: 2, ratios: [] };

// --- UTILITIES ---

// GCD function
function gcd(a, b) {
  while (b !== 0) {
    let t = b;
    b = a % b;
    a = t;
  }
  return a;
}

// Prime factors for odd part only
function primeFactors(n) {
  const factors = [];
  let x = n;
  for (let i = 2; i <= x; i++) {
    while (x % i === 0) {
      factors.push(i);
      x /= i;
    }
  }
  return factors;
}

// Check allowed odd prime factors ≤ z (excluding 2)
function allowedFactors(n, z) {
  while (n % 2 === 0) n /= 2;
  if (n === 1) return true;
  const factors = primeFactors(n);
  return factors.every(f => f <= z && f !== 2);
}

// Normalize ratio into [1, 2)
function normalizeRatio(ratio) {
  while (ratio < 1) ratio *= 2;
  while (ratio >= 2) ratio /= 2;
  return ratio;
}

// Generate all ratios within z-limit JI tuning
function generateZLimitRatios(z) {
  const ratioSet = new Set();

  for (let numerator = 1; numerator <= z; numerator += 2) {
    if (!allowedFactors(numerator, z)) continue;

    for (let denominator = 1; denominator <= z; denominator += 2) {
      if (!allowedFactors(denominator, z)) continue;

      const g = gcd(numerator, denominator);
      const num = numerator / g;
      const den = denominator / g;

      const ratio = normalizeRatio(num / den);

      ratioSet.add(ratio.toFixed(10));
    }
  }

  // Convert back to numbers and sort ascending
  const ratios = Array.from(ratioSet).map(Number).sort((a, b) => a - b);
  return ratios;
}

// Parse tuning string and produce tuning data object
function parseTuning(tuningStr) {
  tuningStr = tuningStr.trim().toLowerCase();

  // Equal division of interval (assumed octave = 2)
  if (/^\d+ed2$/.test(tuningStr)) {
    const x = parseInt(tuningStr);
    if (!isNaN(x) && x > 0) {
      return { type: "edo", steps: x, interval: 2 };
    }
  }

  // z-limit JI tuning, e.g. "5-limit"
  if (tuningStr.endsWith("-limit")) {
    const zStr = tuningStr.slice(0, tuningStr.length - 6);
    const z = parseInt(zStr);
    if (!isNaN(z) && z % 2 === 1 && z >= 3) {
      const ratios = generateZLimitRatios(z);
      return { type: "z-limit", z, ratios };
    }
  }

  // Default fallback
  return { type: "edo", steps: 12, interval: 2 };
}

// Calculate frequency for given step (distance from root)
function calculateFrequency(step, tuningData, baseFreq) {
  if (tuningData.type === "edo") {
    return baseFreq * Math.pow(tuningData.interval, step / tuningData.steps);
  }
  if (tuningData.type === "z-limit") {
    const len = tuningData.ratios.length;
    // wrap index cyclically
    const idx = ((step % len) + len) % len;
    return baseFreq * tuningData.ratios[idx];
  }
  return baseFreq;
}

// Calculate cents difference from base frequency
function calculateCents(freq, baseFreq) {
  return Math.round(1200 * Math.log2(freq / baseFreq));
}

// --- NOTE NAME UTILITIES ---
// Cycle forward/backward over noteNames array
function getNoteNameForStep(step) {
  if (noteNames.length === 0) return `Key ${step}`;
  const len = noteNames.length;
  const idx = ((step % len) + len) % len;
  return noteNames[idx];
}

// --- AUDIO CONTROLS ---

function playNote(keyIndex) {
  if (activeOscillators.has(keyIndex)) return; // already playing

  const stepFromRoot = keyIndex - rootNote;
  const freq = calculateFrequency(stepFromRoot, tuningData, baseFreq);

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.frequency.value = freq;
  osc.type = 'sine';

  gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start();

  activeOscillators.set(keyIndex, { osc, gainNode });
}

function stopNote(keyIndex) {
  const oscData = activeOscillators.get(keyIndex);
  if (!oscData) return;

  // Fade out smoothly
  oscData.gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.03);

  oscData.osc.stop(audioCtx.currentTime + 0.03);
  activeOscillators.delete(keyIndex);
}

// --- KEYBOARD RENDERING ---

function createKeyboard(rows, cols) {
  keyboard.innerHTML = '';
  keyboard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const totalKeys = rows * cols;
  const rootFreq = calculateFrequency(0, tuningData, baseFreq);

  for (let i = 0; i < totalKeys; i++) {
    const key = document.createElement('div');
    key.classList.add('key');
    key.dataset.index = i;

    const stepFromRoot = i - rootNote;
    const freq = calculateFrequency(stepFromRoot, tuningData, baseFreq);
    const centsFromRoot = calculateCents(freq, rootFreq);

    const noteName = getNoteNameForStep(stepFromRoot);

    key.innerHTML = `
      <div class="name">${noteName}</div>
      <div class="cent">${centsFromRoot >= 0 ? '+' : ''}${centsFromRoot}¢</div>
    `;

    // Mouse/touch events for polyphonic sustain
    key.addEventListener('mousedown', (e) => {
      e.preventDefault();
      playNote(i);
    });
    key.addEventListener('mouseup', () => {
      stopNote(i);
    });
    key.addEventListener('mouseleave', () => {
      stopNote(i);
    });

    // Touch events for mobile
    key.addEventListener('touchstart', (e) => {
      e.preventDefault();
      playNote(i);
    });
    key.addEventListener('touchend', () => {
      stopNote(i);
    });
    key.addEventListener('touchcancel', () => {
      stopNote(i);
    });

    keyboard.appendChild(key);
  }
}

// --- APPLY SETTINGS ---

function applySettings() {
  baseFreq = parseFloat(baseFreqInput.value) || 261.63;
  rows = Math.max(1, parseInt(rowsInput.value) || 4);
  cols = Math.max(1, parseInt(colsInput.value) || 12);
  rootNote = parseInt(rootNoteInput.value) || 0;

  const tuningStr = tuningInput.value.trim();
  tuningData = parseTuning(tuningStr);

  noteNames = noteNamesInput.value
    .split(/[\s,]+/)
    .map(n => n.trim())
    .filter(n => n.length > 0);

  const totalKeys = rows * cols;
  if (rootNote < 0) rootNote = 0;
  if (rootNote >= totalKeys) rootNote = totalKeys - 1;

  createKeyboard(rows, cols);
}

// --- INITIAL SETUP ---
applySettings();

// Bind apply button
document.getElementById('applyBtn').addEventListener('click', applySettings);