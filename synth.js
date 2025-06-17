
const keyboard = document.getElementById('keyboard');
const baseFreqInput = document.getElementById('baseFreq');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('cols');
const rootNoteInput = document.getElementById('rootNote');
const tuningInput = document.getElementById('tuning');
const noteNamesInput = document.getElementById('noteNames');
const applyBtn = document.getElementById('applyBtn');

let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let activeOscillators = new Map();

function gcd(a, b) {
  while (b !== 0) {
    let t = b;
    b = a % b;
    a = t;
  }
  return a;
}

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

function allowedFactors(n, z) {
  while (n % 2 === 0) n /= 2;
  if (n === 1) return true;
  const factors = primeFactors(n);
  return factors.every(f => f <= z && f !== 2);
}

function normalizeRatio(r) {
  while (r < 1) r *= 2;
  while (r >= 2) r /= 2;
  return r;
}

function generateZLimitRatios(z) {
  const ratioSet = new Set();
  for (let num = 1; num <= z; num += 2) {
    if (!allowedFactors(num, z)) continue;
    for (let den = 1; den <= z; den += 2) {
      if (!allowedFactors(den, z)) continue;
      const g = gcd(num, den);
      const n = num / g;
      const d = den / g;
      const ratio = normalizeRatio(n / d);
      ratioSet.add(ratio.toFixed(10));
    }
  }
  return Array.from(ratioSet).map(Number).sort((a, b) => a - b);
}

function generateEdoRatios(steps, interval) {
  const stepSize = Math.pow(interval, 1 / steps);
  return Array.from({ length: steps }, (_, i) => Math.pow(stepSize, i));
}

function toCents(ratio) {
  return Math.round(1200 * Math.log2(ratio));
}

function updateKeyboard() {
  const baseFreq = parseFloat(baseFreqInput.value);
  const rows = parseInt(rowsInput.value);
  const cols = parseInt(colsInput.value);
  const rootNote = parseInt(rootNoteInput.value);
  const tuning = tuningInput.value.trim();
  const noteNamesRaw = noteNamesInput.value.trim().split(/[,\s]+/);
  noteNames = noteNamesRaw.length > 0 ? noteNamesRaw : [''];

  let tuningRatios;
  if (tuning.includes('ed')) {
    const [x, y] = tuning.split('ed').map(Number);
    tuningRatios = generateEdoRatios(x, y);
  } else if (tuning.endsWith('-limit')) {
    const z = parseInt(tuning.split('-')[0]);
    tuningRatios = generateZLimitRatios(z);
  } else {
    alert('Invalid tuning format');
    return;
  }

  const totalKeys = rows * cols;
  const freqs = [];
  for (let i = 0; i < totalKeys; i++) {
    const relIndex = i - rootNote;
    let ratio;
    if (relIndex >= 0) {
      ratio = tuningRatios[relIndex % tuningRatios.length];
    } else {
      const mirrored = tuningRatios.length - (-relIndex % tuningRatios.length);
      ratio = tuningRatios[mirrored % tuningRatios.length];
      ratio = 1 / ratio;
    }
    freqs.push(baseFreq * ratio);
  }

  keyboard.innerHTML = '';
  keyboard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  freqs.forEach((freq, i) => {
    const div = document.createElement('div');
    div.className = 'key';

    const relIndex = i - rootNote;
    const nameIndex = ((relIndex % noteNames.length) + noteNames.length) % noteNames.length;
    const name = noteNames[nameIndex];

    const ratio = freq / baseFreq;
    const cent = toCents(ratio);

    div.innerHTML = `<div class="name">${name}</div><div class="cent">${cent}¢</div>`;

    const startNote = () => {
      if (activeOscillators.has(i)) return;
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      activeOscillators.set(i, { osc, gain });
    };

    const stopNote = () => {
      const node = activeOscillators.get(i);
      if (node) {
        node.gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        node.osc.stop(audioCtx.currentTime + 0.3);
        activeOscillators.delete(i);
      }
    };

    div.addEventListener('mousedown', startNote);
    div.addEventListener('touchstart', startNote);
    div.addEventListener('mouseup', stopNote);
    div.addEventListener('touchend', stopNote);
    div.addEventListener('mouseleave', stopNote);
    div.addEventListener('touchcancel', stopNote);

    keyboard.appendChild(div);
  });
}

applyBtn.addEventListener('click', updateKeyboard);
updateKeyboard();
