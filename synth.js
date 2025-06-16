const keyboard = document.getElementById('keyboard');
const numRowsInput = document.getElementById('numRows');
const numColsInput = document.getElementById('numCols');
const rootNoteInput = document.getElementById('rootNote');
const baseFreqInput = document.getElementById('baseFreq');
const tuningInput = document.getElementById('tuning');
const mappingInput = document.getElementById('mapping');
const noteNamesInput = document.getElementById('noteNames');
const applySettingsBtn = document.getElementById('applySettings');

let numRows = parseInt(numRowsInput.value, 10);
let numCols = parseInt(numColsInput.value, 10);
let rootNote = parseInt(rootNoteInput.value, 10);
let baseFreq = parseFloat(baseFreqInput.value);
let tuning = tuningInput.value.trim();
let mapping = [];
let noteNames = [];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const activeOscillators = new Map(); // Track currently playing notes for polyphony

function parseEqualDivisionTuning(tuning) {
  const match = tuning.match(/^(\d+)ed([\d.]+)$/i);
  if (!match) return null;
  return {
    divisions: parseInt(match[1], 10),
    interval: parseFloat(match[2])
  };
}

function parseJustIntonationTuning(tuning) {
  const match = tuning.match(/^(\d+)-limit$/i);
  if (!match) return null;
  return parseInt(match[1], 10);
}

const fiveLimitScale = [
  1/1,
  16/15,
  9/8,
  6/5,
  5/4,
  4/3,
  45/32,
  3/2,
  8/5,
  5/3,
  9/5,
  15/8,
  2/1
];

function parseMapping(str) {
  if (!str.trim()) return [];
  return str
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));
}

function parseNoteNames(str) {
  if (!str.trim()) return [];
  return str.split(',').map(s => s.trim());
}

function getEqualDivisionFreq(baseFreq, step, divisions, interval) {
  return baseFreq * Math.pow(interval, step / divisions);
}

function getJustIntonationFreq(baseFreq, step, limit) {
  if (limit === 5) {
    step = ((step % fiveLimitScale.length) + fiveLimitScale.length) % fiveLimitScale.length;
    return baseFreq * fiveLimitScale[step];
  }
  // Add support for other limits here if needed
  return baseFreq;
}

function calculateFrequency(i) {
  if (mapping.length > 0) {
    if (i >= mapping.length) return null;
    i = mapping[i];
  }

  const jiLimit = parseJustIntonationTuning(tuning);
  if (jiLimit) {
    return getJustIntonationFreq(baseFreq, i, jiLimit);
  }

  const ed = parseEqualDivisionTuning(tuning);
  if (ed) {
    return getEqualDivisionFreq(baseFreq, i, ed.divisions, ed.interval);
  }

  // Default fallback: 12-tone equal temperament
  return baseFreq * Math.pow(2, i / 12);
}

function createKeyboard(rows, cols) {
  keyboard.innerHTML = '';
  keyboard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const totalKeys = rows * cols;

  for (let i = 0; i < totalKeys; i++) {
    const key = document.createElement('div');
    key.classList.add('key');

    // Display note name if available, else show index + 1
    const name = (noteNames.length > i) ? noteNames[i] : (i + 1);
    key.textContent = name;

    key.dataset.index = i;
    keyboard.appendChild(key);
  }
}

function playNote(freq, keyElement) {
  if (!freq) return;
  if (activeOscillators.has(keyElement)) return; // prevent retrigger while active

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
    active.gain.gain.setTargetAtTime(0, now, 0.05); // smooth fade out
    active.osc.stop(now + 0.05);
    activeOscillators.delete(keyElement);
    keyElement.classList.remove('active');
  }
}

function wireKeysToPlay() {
  const keys = document.querySelectorAll('.key');

  keys.forEach(key => {
    key.onmousedown = (e) => {
      e.preventDefault();
      const i = parseInt(key.dataset.index, 10);
      const freq = calculateFrequency(i);
      key.classList.add('active');
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

    // Touch events for mobile
    key.ontouchstart = (e) => {
      e.preventDefault();
      const i = parseInt(key.dataset.index, 10);
      const freq = calculateFrequency(i);
      key.classList.add('active');
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

applySettingsBtn.onclick = () => {
  numRows = parseInt(numRowsInput.value, 10);
  numCols = parseInt(numColsInput.value, 10);
  rootNote = parseInt(rootNoteInput.value, 10);
  baseFreq = parseFloat(baseFreqInput.value);
  tuning = tuningInput.value.trim();
  mapping = parseMapping(mappingInput.value);
  noteNames = parseNoteNames(noteNamesInput.value);

  createKeyboard(numRows, numCols);
  wireKeysToPlay();
};

// Initialize with default values
createKeyboard(numRows, numCols);
wireKeysToPlay();