const keyboard = document.getElementById('keyboard');
const applySettingsBtn = document.getElementById('applySettings');

const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('cols');
const rootNoteBox = document.getElementById('rootNoteBox');
const baseFreqInput = document.getElementById('baseFreq');
const tuningInput = document.getElementById('tuning');
const mappingInput = document.getElementById('mapping');
const noteNamesInput = document.getElementById('noteNames');

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const activeOscillators = new Map();

let rootNote = 0;
let baseFreq = 440;
let tuning = '12ed2';
let mapping = [];
let noteNames = [];

applySettingsBtn.onclick = applySettings;

function applySettings() {
  const rows = parseInt(rowsInput.value, 10) || 1;
  const cols = parseInt(colsInput.value, 10) || 1;
  rootNote = parseInt(rootNoteBox.value, 10) || 0;
  baseFreq = parseFloat(baseFreqInput.value) || 440;
  tuning = tuningInput.value.trim();
  noteNames = noteNamesInput.value.trim().split(',').map(n => n.trim());

  mapping = mappingInput.value.trim().split(',').map(x => parseFloat(x.trim())).filter(x => !isNaN(x));

  createKeyboard(rows, cols);
  wireKeysToPlay();
}

function createKeyboard(rows, cols) {
  keyboard.innerHTML = '';
  keyboard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const totalKeys = rows * cols;
  const rootFreq = calculateFrequency(0);

  for (let i = 0; i < totalKeys; i++) {
    const key = document.createElement('div');
    key.classList.add('key');
    key.dataset.index = i;

    const stepFromRoot = i - rootNote;
    const freq = calculateFrequency(stepFromRoot);
    const centsFromRoot = Math.round(1200 * Math.log2(freq / rootFreq));

    let name;
    if (noteNames.length > 0) {
      const wrappedIndex = ((stepFromRoot % noteNames.length) + noteNames.length) % noteNames.length;
      name = noteNames[wrappedIndex];
    } else {
      name = `Key ${i}`;
    }

    key.innerHTML = `
      <div class="name">${name}</div>
      <div class="cent">${centsFromRoot >= 0 ? '+' : ''}${centsFromRoot}¢</div>
    `;

    keyboard.appendChild(key);
  }
}

function wireKeysToPlay() {
  const keys = document.querySelectorAll('.key');

  keys.forEach(key => {
    const i = parseInt(key.dataset.index, 10);

    key.onmousedown = (e) => {
      e.preventDefault();
      const freq = calculateFrequency(i - rootNote);
      playNote(freq, key);
    };

    key.onmouseup = (e) => {
      e.preventDefault();
      stopNote(key);
    };

    key.onmouseleave = (e) => {
      e.preventDefault();
      stopNote(key);
    };

    key.ontouchstart = (e) => {
      e.preventDefault();
      const freq = calculateFrequency(i - rootNote);
      playNote(freq, key);
    };

    key.ontouchend = (e) => {
      e.preventDefault();
      stopNote(key);
    };

    key.ontouchcancel = (e) => {
      e.preventDefault();
      stopNote(key);
    };
  });
}

function playNote(freq, keyElement) {
  if (!freq) return;
  if (activeOscillators.has(keyElement)) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();

  activeOscillators.set(keyElement, { osc, gain });
  keyElement.classList.add('active');
}

function stopNote(keyElement) {
  const active = activeOscillators.get(keyElement);
  if (active) {
    const now = audioCtx.currentTime;
    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setTargetAtTime(0, now, 0.05);
    active.osc.stop(now + 0.05);
    activeOscillators.delete(keyElement);
    keyElement.classList.remove('active');
  }
}

function calculateFrequency(step) {
  let mappedStep = step;
  if (mapping.length > 0 && step >= 0 && step < mapping.length) {
    mappedStep = mapping[step];
  }

  const jiLimit = parseJustIntonationTuning(tuning);
  if (jiLimit) {
    return getJustIntonationFreq(baseFreq, mappedStep, jiLimit);
  }

  const ed = parseEqualDivisionTuning(tuning);
  if (ed) {
    return getEqualDivisionFreq(baseFreq, mappedStep, ed.divisions, ed.interval);
  }

  return baseFreq * Math.pow(2, mappedStep / 12);
}

function parseEqualDivisionTuning(tuningStr) {
  const match = tuningStr.match(/^(\d+)ed([\d.]+)$/);
  if (match) {
    return {
      divisions: parseInt(match[1], 10),
      interval: parseFloat(match[2])
    };
  }
  return null;
}

function parseJustIntonationTuning(tuningStr) {
  const match = tuningStr.match(/^(\d+)-limit$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function getEqualDivisionFreq(base, step, divisions, interval) {
  return base * Math.pow(interval, step / divisions);
}

function getJustIntonationFreq(base, step, limit) {
  const primes = getPrimesUpTo(limit);
  let ratio = 1;

  for (let i = 0; i < Math.abs(step); i++) {
    ratio *= primes[i % primes.length];
  }

  if (step < 0) ratio = 1 / ratio;
  return base * ratio;
}

function getPrimesUpTo(n) {
  const primes = [];
  for (let i = 2; i <= n; i++) {
    if (isPrime(i)) primes.push(i);
  }
  return primes;
}

function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false;
  }
  return true;
}

// Auto apply on load
applySettings();