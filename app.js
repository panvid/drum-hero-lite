/* Drum Hero Lite – Übungsseite (ohne Tastatur‑Eingaben)
   - Liest einfache ASCII-Drum-Tabs (HH/SN/BD)
   - Visualisiert Noten im Canvas mit Metronom (keine Tastatur-Eingabe, kein Punktesystem)
*/

(() => {
  const $ = (sel) => document.querySelector(sel);
  const bpmEl = $('#bpm');
  const spbEl = $('#spb');
  const leadInEl = $('#leadIn');
  const approachEl = $('#approach');
  const metronomeEl = $('#metronome');
  const tsNumEl = $('#tsNum');
  const tsDenEl = $('#tsDen');
  const formatBadgeEl = document.getElementById('formatBadge');
  const legendEl = document.getElementById('legend');
  const laneLabelsEl = document.getElementById('laneLabels');
  // Formatsteuerung: immer Auto, optional Override durch Klick auf Badge
  let currentFormatMode = 'auto'; // 'auto' | 'classic' | 'guitar'

  const btnParse = $('#btnParse');
  const btnStart = $('#btnStart');
  const btnPause = $('#btnPause');
  const btnStop = $('#btnStop');
  const demoSelect = $('#demoSelect');
  const fileInput = $('#fileInput');
  const btnFullscreen = $('#btnFullscreen');

  const tabsEl = $('#tabs');
  const stageEl = document.querySelector('.stage');
  const hudEl = document.querySelector('.hud');
  const fileMetaEl = document.getElementById('fileMeta');
  const soundPanelEl = document.getElementById('soundPanel');
  let lastLoadedFile = null; // remember last uploaded file for meta display

  // Keep HUD pinned to the visible top-right corner of the stage, even when horizontally scrolling
  function updateHudPosition() {
    if (!hudEl || !stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const m = 10; // margin inside stage
    const hudW = hudEl.offsetWidth || 0;
    const left = Math.max(0, Math.round(rect.right - hudW - m));
    const top = Math.max(0, Math.round(rect.top + m));
    hudEl.style.position = 'fixed';
    hudEl.style.left = left + 'px';
    hudEl.style.top = top + 'px';
    hudEl.style.right = 'auto';
    // ensure on top
    hudEl.style.zIndex = '1000';
  }


  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  // Breite pro Step und Innenabstände für Labels/Canvas
  const STEP_PX = 28; // Pixel pro Schritt für horizontales Scrollen
  const PADS = { L: 150, R: 20, T: 40, B: 40 };

  // Alle möglichen Spuren (wird später dynamisch gefiltert)
  const ALL_LANES = [
    { key: 'hhc', color: '#ffd166', label: 'Hi‑Hat geschlossen', abbr: 'HC' },
    { key: 'hhp', color: '#ffc14d', label: 'Hi‑Hat Pedal', abbr: 'HP' },
    { key: 'hho', color: '#ffb347', label: 'Hi‑Hat offen', abbr: 'HO' },
    { key: 'cr1', color: '#f7a8f0', label: 'Crash 1', abbr: 'CA' },
    { key: 'cr2', color: '#f58ae6', label: 'Crash 2', abbr: 'CB' },
    { key: 'ride', color: '#9ad1ff', label: 'Ride', abbr: 'RD' },
    { key: 'ridebell', color: '#8bc7ff', label: 'Ride Bell', abbr: 'RB' },
    { key: 'china', color: '#f68f6f', label: 'China', abbr: 'CH' },
    { key: 'splash', color: '#f6cf6f', label: 'Splash', abbr: 'SP' },
    { key: 'sn', color: '#ef476f', label: 'Snare', abbr: 'SN' },
    { key: 't1', color: '#d4e157', label: 'Tom High', abbr: 'TH' },
    { key: 't2', color: '#b0d445', label: 'Tom High‑Mid', abbr: 'TM' },
    { key: 't3', color: '#8cc64a', label: 'Tom Low‑Mid', abbr: 'LM' },
    { key: 't4', color: '#5cc06e', label: 'Tom Low', abbr: 'TL' },
    { key: 't5', color: '#41b58a', label: 'Floor Tom High', abbr: 'FH' },
    { key: 't6', color: '#2aa57a', label: 'Floor Tom Low', abbr: 'FL' },
    { key: 'bd', color: '#06d6a0', label: 'Bassdrum', abbr: 'BD' },
  ];

  let chart = { notes: [], steps: 0 };

  // Map a MIDI number to internal lane key (same mapping as in parseTabs)
  function midiToLaneKey(n) {
    if (n == null || Number.isNaN(n)) return null;
    // Bass Drum
    if (n === 35 || n === 36) return 'bd';
    // Snares
    if (n === 37 || n === 38 || n === 39 || n === 40) return 'sn';
    // Toms (high → floor)
    if (n === 50) return 't1';       // High Tom
    if (n === 48) return 't2';       // High-Mid Tom
    if (n === 47) return 't3';       // Low-Mid Tom
    if (n === 45) return 't4';       // Low Tom
    if (n === 43) return 't5';       // Floor Tom High
    if (n === 41) return 't6';       // Floor Tom Low
    // Hi-Hats & Cymbals
    if (n === 42) return 'hhc';      // Closed Hi-Hat
    if (n === 44) return 'hhp';      // Pedal Hi-Hat
    if (n === 46) return 'hho';      // Open Hi-Hat
    if (n === 49) return 'cr1';      // Crash 1
    if (n === 57) return 'cr2';      // Crash 2
    if (n === 51) return 'ride';     // Ride 1
    if (n === 53) return 'ridebell'; // Ride Bell
    if (n === 59) return 'ride';     // Ride 2 → ride
    if (n === 52) return 'china';    // China
    if (n === 55) return 'splash';   // Splash
    return null;
  }

  // Map an internal lane key to a representative MIDI note number for legend display
  function laneKeyToMidi(key) {
    switch (key) {
      case 'bd': return 36;          // Bass Drum
      case 'sn': return 38;          // Snare
      case 't1': return 50;          // Tom High
      case 't2': return 48;          // Tom High-Mid
      case 't3': return 47;          // Tom Low-Mid
      case 't4': return 45;          // Tom Low
      case 't5': return 43;          // Floor Tom High
      case 't6': return 41;          // Floor Tom Low
      case 'hhc': return 42;         // Hi-Hat closed
      case 'hhp': return 44;         // Hi-Hat pedal
      case 'hho': return 46;         // Hi-Hat open
      case 'cr1': return 49;         // Crash 1
      case 'cr2': return 57;         // Crash 2
      case 'ride': return 51;        // Ride
      case 'ridebell': return 53;    // Ride Bell
      case 'china': return 52;       // China
      case 'splash': return 55;      // Splash
      default: return null;
    }
  }
  let state = 'idle'; // idle | playing | paused | stopped
  let startTime = 0; // performance.now() when playback started
  let pauseAccum = 0; // accumulated paused time
  let pauseStart = 0;


  // Metronome
  let audioCtx = null;
  let lastBeatIndex = -1;
  
  // Per-lane sound enable state (checkbox controlled)
  const laneSoundEnabled = Object.create(null);
  
  // Render the sound panel with checkboxes for current lanes
  function renderSoundPanel() {
    if (!soundPanelEl) return;
    const lanes = chart.lanes || [];
    soundPanelEl.innerHTML = '';
    for (const lane of lanes) {
      const id = `sp-${lane.key}`;
      const defaultOn = (lane.key === 'hhc' || lane.key === 'sn' || lane.key === 'bd');
      const enabled = (Object.prototype.hasOwnProperty.call(laneSoundEnabled, lane.key) ? laneSoundEnabled[lane.key] : defaultOn);
      laneSoundEnabled[lane.key] = enabled; // persist default
      const wrap = document.createElement('label');
      wrap.className = 'lane';
      wrap.title = lane.label || lane.key.toUpperCase();
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = id;
      cb.checked = !!enabled;
      cb.addEventListener('change', () => { laneSoundEnabled[lane.key] = !!cb.checked; updateLaneLabelStates(); });
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = lane.color;
      const txt = document.createElement('span');
      txt.textContent = (lane.key === 'hhc' ? 'Hat' : (lane.label || lane.key.toUpperCase()));
      wrap.appendChild(cb);
      wrap.appendChild(dot);
      wrap.appendChild(txt);
      soundPanelEl.appendChild(wrap);
    }
  }

  // Render fixed lane labels overlay in stage (non-scrolling)
  function renderLaneLabels() {
    if (!laneLabelsEl) return;
    const lanes = chart.lanes || [];
    // Compute row layout like in renderFrame
    const w = canvas.width, h = canvas.height;
    const padT = PADS.T, padB = PADS.B;
    const innerH = h - padT - padB;
    const laneCount = Math.max(1, lanes.length);
    const rowH = innerH / laneCount;

    laneLabelsEl.innerHTML = '';
    laneLabelsEl.style.width = PADS.L + 'px';
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const yTop = padT + i * rowH;
      const el = document.createElement('div');
      el.className = 'lane-label' + (laneSoundEnabled[lane.key] === false ? ' off' : '');
      const labelH = 30;
      el.style.top = Math.round(yTop + (rowH - labelH) / 2) + 'px';
      el.style.height = labelH + 'px';
      el.style.left = '0px';

      // Show full instrument name in playback area next to the mute/unmute switch
      const laneInfo = getLane(lane.key) || { label: lane.key.toUpperCase() };
      const nameEl = document.createElement('span');
      nameEl.className = 'name';
      nameEl.textContent = laneInfo.label || lane.key.toUpperCase();
      nameEl.title = nameEl.textContent;
      el.title = `${laneInfo.label || lane.key.toUpperCase()} – Ton an/aus`;

      // Mini switch
      const swWrap = document.createElement('label');
      swWrap.className = 'mini-switch';
      swWrap.title = 'Ton an/aus';
      const sw = document.createElement('input');
      sw.type = 'checkbox';
      sw.id = `lane-sw-${lane.key}`;
      // Default on for common lanes if not set yet
      const defaultOn = (lane.key === 'hhc' || lane.key === 'sn' || lane.key === 'bd');
      if (!Object.prototype.hasOwnProperty.call(laneSoundEnabled, lane.key)) {
        laneSoundEnabled[lane.key] = defaultOn;
      }
      sw.checked = !!laneSoundEnabled[lane.key];
      const slider = document.createElement('span');
      slider.className = 'slider';
      sw.addEventListener('change', () => {
        laneSoundEnabled[lane.key] = !!sw.checked;
        updateLaneLabelStates();
      });
      swWrap.appendChild(sw);
      swWrap.appendChild(slider);

      // Layout: [name] .... [switch]
      el.appendChild(nameEl);
      el.appendChild(swWrap);

      // No click/keypress on label itself; only the switch controls sound
      laneLabelsEl.appendChild(el);
    }
    updateLaneLabelsPosition();
  }

  function updateLaneLabelStates() {
    if (!laneLabelsEl) return;
    const lanes = chart.lanes || [];
    const items = laneLabelsEl.querySelectorAll('.lane-label');
    for (let i = 0; i < items.length && i < lanes.length; i++) {
      const lane = lanes[i];
      const on = !!laneSoundEnabled[lane.key];
      const it = items[i];
      it.classList.toggle('off', !on);
      // sync the switch UI if present
      const sw = it.querySelector('input[type="checkbox"]');
      if (sw) sw.checked = on;
    }
    // also re-render current frame for visual dimming
    renderFrame(currentTime());
  }

  function updateLaneLabelsPosition() {
    if (!laneLabelsEl || !stageEl) return;
    const x = stageEl.scrollLeft || 0;
    laneLabelsEl.style.transform = `translateX(${x}px)`;
  }

  function ensureAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tickSound(accent = false) {
    const ctx = ensureAudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1200 : 880;
    g.gain.value = accent ? 0.09 : 0.06;
    o.connect(g).connect(ctx.destination);
    const t = ctx.currentTime;
    o.start(t);
    o.stop(t + 0.04);
  }

  // ===== Drum Synth (WebAudio) =====
  let noiseBuf = null;
  function getNoiseBuffer() {
    const ctx = ensureAudioCtx();
    if (noiseBuf) return noiseBuf;
    const seconds = 1.0;
    const rate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, seconds * rate, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseBuf = buffer;
    return noiseBuf;
  }

  function playKick(when) {
    const ctx = ensureAudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(50, when + 0.12);
    g.gain.setValueAtTime(0.9, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(when);
    o.stop(when + 0.25);
  }

  function playSnare(when) {
    const ctx = ensureAudioCtx();
    // Noise burst
    const n = ctx.createBufferSource();
    n.buffer = getNoiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    n.connect(hp).connect(g).connect(ctx.destination);
    n.start(when);
    n.stop(when + 0.25);
    // Body tone
    const o = ctx.createOscillator();
    const g2 = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, when);
    o.frequency.exponentialRampToValueAtTime(140, when + 0.05);
    g2.gain.setValueAtTime(0.2, when);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
    o.connect(g2).connect(ctx.destination);
    o.start(when);
    o.stop(when + 0.15);
  }

  function playHat(when, type = 'closed') {
    const ctx = ensureAudioCtx();
    const n = ctx.createBufferSource();
    n.buffer = getNoiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const g = ctx.createGain();
    const dur = type === 'open' ? 0.5 : (type === 'pedal' ? 0.12 : 0.08);
    const startGain = type === 'open' ? 0.35 : 0.25;
    g.gain.setValueAtTime(startGain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    n.connect(hp).connect(g).connect(ctx.destination);
    n.start(when);
    n.stop(when + dur + 0.05);
  }

  function playCymbal(when, kind = 'crash') {
    const ctx = ensureAudioCtx();
    const n = ctx.createBufferSource();
    n.buffer = getNoiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (kind === 'ride' ? 7000 : 6000);
    const g = ctx.createGain();
    const dur = (kind === 'ride' ? 0.8 : 1.2);
    g.gain.setValueAtTime(0.28, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    n.connect(hp).connect(bp).connect(g).connect(ctx.destination);
    n.start(when);
    n.stop(when + dur + 0.1);
  }

  function playRideBell(when) {
    const ctx = ensureAudioCtx();
    const o = ctx.createOscillator();
    o.type = 'triangle';
    const g = ctx.createGain();
    o.frequency.setValueAtTime(900, when);
    o.frequency.exponentialRampToValueAtTime(700, when + 0.08);
    g.gain.setValueAtTime(0.25, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start(when);
    o.stop(when + 0.3);
  }

  function playTom(when, freq = 180) {
    const ctx = ensureAudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, when);
    o.frequency.exponentialRampToValueAtTime(freq * 0.7, when + 0.12);
    g.gain.setValueAtTime(0.4, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start(when);
    o.stop(when + 0.3);
  }

  function triggerLaneSound(laneKey, when) {
    switch (laneKey) {
      case 'bd': return playKick(when);
      case 'sn': return playSnare(when);
      case 'hhc': return playHat(when, 'closed');
      case 'hho': return playHat(when, 'open');
      case 'hhp': return playHat(when, 'pedal');
      case 'ride': return playCymbal(when, 'ride');
      case 'ridebell': return playRideBell(when);
      case 'cr1':
      case 'cr2': return playCymbal(when, 'crash');
      case 'china': return playCymbal(when, 'crash');
      case 'splash': return playCymbal(when, 'crash');
      case 't1': return playTom(when, 220);
      case 't2': return playTom(when, 200);
      case 't3': return playTom(when, 180);
      case 't4': return playTom(when, 160);
      case 't5': return playTom(when, 140);
      case 't6': return playTom(when, 120);
      default:
        // Fallback: short hat-like noise
        return playHat(when, 'closed');
    }
  }

  // ===== Scheduling =====
  let sortedNotes = [];
  let nextNoteIdx = 0;

  function noteTimeFromStep(step) {
    const { bpm, spb, leadIn } = getSettings();
    const stepDur = (60 / bpm) / spb;
    return leadIn + step * stepDur;
  }

  function rebuildSortedNotes() {
    sortedNotes = (chart.notes || []).slice().sort((a, b) => a.step - b.step);
    nextNoteIdx = 0;
  }

  function syncSchedulerToTime(t) {
    // Move pointer to first note with time >= t
    nextNoteIdx = 0;
    for (let i = 0; i < sortedNotes.length; i++) {
      if (noteTimeFromStep(sortedNotes[i].step) >= t - 0.01) { nextNoteIdx = i; break; }
      nextNoteIdx = i + 1;
    }
  }

  function scheduleDueNotes(t) {
    const ctx = ensureAudioCtx();
    const lookahead = 0.2; // seconds
    while (nextNoteIdx < sortedNotes.length) {
      const n = sortedNotes[nextNoteIdx];
      const nt = noteTimeFromStep(n.step);
      if (nt <= t + lookahead) {
        if (laneSoundEnabled[n.lane]) {
          const when = Math.max(0, nt - t);
          triggerLaneSound(n.lane, ctx.currentTime + when);
        }
        nextNoteIdx++;
      } else {
        break;
      }
    }
  }

  function nowSec() { return performance.now() / 1000; }

  function getSettings() {
    const bpm = clamp(parseFloat(bpmEl.value) || 120, 20, 300);
    const spb = clamp(parseInt(spbEl?.value) || 4, 1, 12);
    const leadIn = Math.max(0, parseFloat(leadInEl.value) || 0);
    const approach = Math.max(0.5, parseFloat(approachEl?.value ?? 4) || 4);
    const tsNum = clamp(parseInt(tsNumEl?.value) || 4, 1, 32);
    const tsDen = clamp(parseInt(tsDenEl?.value) || 4, 1, 32);
    return { bpm, spb, leadIn, approach, tsNum, tsDen };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Parsing
  function parseTabs(text, opts = {}) {
    const formatOpt = (opts.format || 'auto').toLowerCase(); // 'auto' | 'classic' | 'guitar'
    // Supports two formats:
    // 1) Drum ASCII lines: HH|x-x-|, SN: --o-, BD|o---|
    // 2) Gitarren-Tab-ähnliche Zeilen mit MIDI-Zahlen auf Saiten (E, A, D, G, B, e), z. B. E|-42--|, G|-38-|, A|-36-|
    const lines = text.split(/\r?\n/);
    const tracks = Object.create(null); // dynamic map: laneKey -> [segments]
    const guitarSeqs = [];
    const midiTokens = new Set(); // collect encountered two-digit MIDI numbers (as numbers)
    let detectedFormat = null;
    const stringNames = ['e', 'a', 'd', 'g', 'b']; // Gitarren-Saitenlabels

    // Helper to map label text (left of : or |) to an internal lane key
    function mapLabel(label) {
      const norm = label.toLowerCase().replace(/[^a-z0-9]/g, '');
      const aliasToLane = {
        // Hi-Hats
        'hc': 'hhc', 'ho': 'hho', 'hp': 'hhp', 'hh': 'hhc', 'h': 'hhc',
        // Snare
        'sn': 'sn', 's': 'sn', 'sd': 'sn', 'snare': 'sn',
        // Bassdrum
        'bd': 'bd', 'k': 'bd', 'kick': 'bd', 'bass': 'bd',
        // Cymbals
        'rd': 'ride', 'ride': 'ride',
        'rb': 'ridebell', 'ridebell': 'ridebell',
        'ca': 'cr1', 'cr1': 'cr1',
        'cb': 'cr2', 'cr2': 'cr2',
        'ch': 'china', 'china': 'china',
        'sp': 'splash', 'splash': 'splash',
        // Toms (semantic 2-letter and explicit indices)
        'th': 't1', 'tm': 't2', 'lm': 't3', 'tl': 't4', 'fh': 't5', 'fl': 't6',
        't1': 't1', 't2': 't2', 't3': 't3', 't4': 't4', 't5': 't5', 't6': 't6',
      };
      return aliasToLane[norm] || null;
    }

    // Helper to map MIDI note numbers to extended lanes
    function mapMidiToLane(n) {
      if (n == null || Number.isNaN(n)) return null;
      // Bass Drum
      if (n === 35 || n === 36) return 'bd';
      // Snares
      if (n === 37 || n === 38 || n === 39 || n === 40) return 'sn';
      // Toms (high → floor)
      if (n === 50) return 't1';       // High Tom
      if (n === 48) return 't2';       // High-Mid Tom
      if (n === 47) return 't3';       // Low-Mid Tom
      if (n === 45) return 't4';       // Low Tom
      if (n === 43) return 't5';       // Floor Tom High
      if (n === 41) return 't6';       // Floor Tom Low
      // Hi-Hats & Cymbals
      if (n === 42) return 'hhc';      // Closed Hi-Hat
      if (n === 44) return 'hhp';      // Pedal Hi-Hat
      if (n === 46) return 'hho';      // Open Hi-Hat
      if (n === 49) return 'cr1';      // Crash 1
      if (n === 57) return 'cr2';      // Crash 2
      if (n === 51) return 'ride';     // Ride 1
      if (n === 53) return 'ridebell'; // Ride Bell
      if (n === 59) return 'ride';     // Ride 2 → ride
      if (n === 52) return 'china';    // China
      if (n === 55) return 'splash';   // Splash
      return null;
    }

    // Collect content segments per track (both formats)
    for (let raw of lines) {
      const line = raw.trimEnd();
      if (!line) continue;
      const pipeIdx = line.indexOf('|');
      const colonIdx = line.indexOf(':');
      const sepIdx = (pipeIdx === -1) ? colonIdx : (colonIdx === -1 ? pipeIdx : Math.min(pipeIdx, colonIdx));
      if (sepIdx <= 0) continue;
      const label = line.slice(0, sepIdx).trim();
      const seqRaw = line.slice(sepIdx + 1).replace(/\s+/g, '');

      // First, detect guitar-string labels to avoid alias collisions (e.g., 'B' string)
      const normLbl = label.toLowerCase().replace(/[^a-z]/g, '');
      if (stringNames.includes(normLbl)) {
        let cleaned = '';
        for (const ch of seqRaw) {
          if (ch === '|' || ch === '-' || (ch >= '0' && ch <= '9')) cleaned += ch;
        }
        cleaned = cleaned.replace(/\|/g, '');
        if (cleaned) guitarSeqs.push(cleaned);
        continue;
      }

      // Otherwise, try classic HH/SN/BD aliases
      const key = mapLabel(label);
      if (key) {
        let cleaned = '';
        for (const ch of seqRaw) {
          if (ch === '|' || ch === '-' || ch === 'x' || ch === 'X' || ch === 'o' || ch === 'O' || ch === '*') cleaned += ch;
        }
        cleaned = cleaned.replace(/\|/g, ''); // drop bar lines
        if (!tracks[key]) tracks[key] = [];
        tracks[key].push(cleaned);
        continue;
      }
    }

    // If we collected classic tracks, use that parsing
    const merged = {};
    let maxLen = 0;
    let hasClassic = false;
    for (const key of Object.keys(tracks)) {
      const seq = tracks[key].length ? tracks[key].join('') : '';
      merged[key] = seq;
      maxLen = Math.max(maxLen, seq.length);
      if (seq.length) hasClassic = true;
    }

    // Helper to build classic notes array
    function buildClassic(mergedObj, len) {
      const arr = [];
      const keys = Object.keys(mergedObj);
      for (let i = 0; i < len; i++) {
        for (const laneKey of keys) {
          const seq = mergedObj[laneKey] || '';
          if (seq[i] && seq[i] !== '-') {
            // laneKey is already the normalized internal key (e.g., 'hhc', 'ride', 't1')
            arr.push({ lane: laneKey, step: i });
          }
        }
      }
      return arr;
    }

    // Forced classic
    if (formatOpt === 'classic') {
      if (!hasClassic || maxLen === 0) return { notes: [], steps: 0, detectedFormat: 'classic' };
      for (const k of Object.keys(merged)) {
        if (merged[k].length < maxLen) merged[k] = merged[k].padEnd(maxLen, '-');
      }
      const classicNotes = buildClassic(merged, maxLen);
      return { notes: classicNotes, steps: maxLen, detectedFormat: 'classic' };
    }

    // Forced guitar: skip classic entirely
    if (formatOpt === 'guitar') {
      let gMax = 0;
      if (guitarSeqs.length === 0) return { notes: [], steps: 0, detectedFormat: 'guitar', midiTokens: [] };
      for (let i = 0; i < guitarSeqs.length; i++) gMax = Math.max(gMax, guitarSeqs[i].length);
      for (let i = 0; i < guitarSeqs.length; i++) if (guitarSeqs[i].length < gMax) guitarSeqs[i] = guitarSeqs[i].padEnd(gMax, '-');
      const notes = [];
      for (const seq of guitarSeqs) {
        for (let i = 0; i < seq.length; i++) {
          const ch = seq[i];
          if (ch >= '0' && ch <= '9') {
            const d2 = (i + 1 < seq.length) ? seq[i + 1] : '';
            if (d2 >= '0' && d2 <= '9') {
              const num = parseInt(seq[i] + d2, 10);
              const lane = mapMidiToLane(num);
              if (lane) {
                notes.push({ lane, step: i });
                midiTokens.add(num);
                i += 1; 
                continue; 
              }
            }
          }
        }
      }
      return { notes, steps: gMax, detectedFormat: 'guitar', midiTokens: Array.from(midiTokens).sort((a,b)=>a-b) };
    }

    // AUTO mode (default)
    if (hasClassic && maxLen > 0) {
      // Pad to same length
      for (const key of Object.keys(merged)) {
        if (merged[key].length < maxLen) merged[key] = merged[key].padEnd(maxLen, '-');
      }
      // Build notes (any non '-' is a note)
      const classicNotes = buildClassic(merged, maxLen);
      // Safety fallback: if no classic notes but we have guitar numeric lines, fall through to guitar parsing
      if (classicNotes.length > 0 || guitarSeqs.length === 0) {
        return { notes: classicNotes, steps: maxLen, detectedFormat: 'classic' };
      }
      // else: proceed to guitar numeric parsing below
    }

    // Otherwise, try to parse guitar-style numeric tabs
    if (guitarSeqs.length === 0) return { notes: [], steps: 0, detectedFormat: null, midiTokens: [] };
    for (let i = 0; i < guitarSeqs.length; i++) {
      maxLen = Math.max(maxLen, guitarSeqs[i].length);
    }
    // Pad sequences
    for (let i = 0; i < guitarSeqs.length; i++) {
      if (guitarSeqs[i].length < maxLen) guitarSeqs[i] = guitarSeqs[i].padEnd(maxLen, '-');
    }

    const notes = [];
    // Scan each string line and read contiguous digits as two-digit MIDI tokens (e.g., 3838 -> 38, 38)
    for (const seq of guitarSeqs) {
      for (let i = 0; i < seq.length; i++) {
        const ch = seq[i];
        if (ch >= '0' && ch <= '9') {
          const d2 = (i + 1 < seq.length) ? seq[i + 1] : '';
          if (d2 >= '0' && d2 <= '9') {
            const num = parseInt(seq[i] + d2, 10);
            const lane = mapMidiToLane(num);
            if (lane) {
              notes.push({ lane, step: i });
              midiTokens.add(num);
              i += 1; // consume the second digit of this token
              continue;
            }
            // If the two-digit number is not a known MIDI mapping, fall through and treat the first digit as noise
          }
          // Ignore single stray digits (no one-digit MIDI notes supported)
        }
      }
    }

    return { notes, steps: maxLen, detectedFormat: 'guitar', midiTokens: Array.from(midiTokens).sort((a,b)=>a-b) };
  }

  function buildTimedChart(parsed) {
    const { bpm, spb, leadIn } = getSettings();
    const stepDur = (60 / bpm) / spb; // seconds per step
    const notes = parsed.notes.map(n => ({
      lane: n.lane,
      step: n.step,
      time: leadIn + n.step * stepDur,
    }));
    // Erzeuge dynamische Spur-Liste nur mit verwendeten Spuren
    const present = new Set(notes.map(n => n.lane));
    const laneOrder = ['hhc','hho','hhp','cr1','cr2','splash','china','ride','ridebell','sn','t1','t2','t3','t4','t5','t6','bd'];
    const lanes = laneOrder
      .filter(k => present.has(k))
      .map(k => ALL_LANES.find(l => l.key === k))
      .filter(Boolean);
    const midiTokens = Array.isArray(parsed.midiTokens) ? parsed.midiTokens.slice() : [];
    return { notes, steps: parsed.steps, stepDur, lanes, detectedFormat: parsed.detectedFormat ?? null, midiTokens };
  }

  function updateFormatBadge(mode, detected) {
    if (!formatBadgeEl) return;
    let text = 'Format: ';
    const map = { classic: 'Drum‑ASCII', guitar: 'Gitarren‑Tab' };
    if (mode === 'auto') {
      if (detected && map[detected]) {
        text += map[detected];
      } else {
        text += '—';
      }
    } else {
      const label = map[mode] || '—';
      text += `${label} (erzwungen)`;
    }
    formatBadgeEl.textContent = text;
  }

  function updateLegend(mode, detected) {
    if (!legendEl) return;
    const effective = (mode === 'auto') ? (detected || null) : mode;

    // Guitar format: show all possible instruments with their representative numbers; dim unused
    if (effective === 'guitar') {
      const used = new Set((chart.lanes || []).map(l => l.key));
      const chips = ALL_LANES.map(l => {
        const on = used.has(l.key);
        const offCls = on ? '' : ' off';
        const num = laneKeyToMidi(l.key);
        const keyTxt = (num != null) ? String(num) : '—';
        const full = l.label || l.key.toUpperCase();
        const title = (num != null) ? `${keyTxt} = ${full}` + (on ? ' – verwendet' : ' – nicht verwendet') : `${full}`;
        return `<span class="chip${offCls}" title="${title}"><span class=\"key\">${keyTxt}</span><span class=\"dot\" style=\"background:${l.color}\"></span><span class=\"nm\">${full}</span></span>`;
      }).join(' ');
      legendEl.style.display = 'flex';
      legendEl.innerHTML = chips;
      const count = used.size;
      legendEl.setAttribute('aria-label', `Legende: Zahlen und Instrumente; aktuell verwendet: ${count}`);
      return;
    }

    // Classic/default: full instrument legend with abbreviations and names
    const used = new Set((chart.lanes || []).map(l => l.key));
    const chips = ALL_LANES.map(l => {
      const on = used.has(l.key);
      const offCls = on ? '' : ' off';
      const abbr = l.abbr || l.key.toUpperCase();
      const full = l.label || l.key.toUpperCase();
      const title = `${abbr} = ${full}` + (on ? ' – verwendet' : ' – nicht verwendet');
      return `<span class="chip${offCls}" title="${title}"><span class="key">${abbr}</span><span class="dot" style="background:${l.color}"></span><span class="nm">${full}</span></span>`;
    }).join(' ');
    legendEl.style.display = 'flex';
    legendEl.innerHTML = chips;
    const count = used.size;
    legendEl.setAttribute('aria-label', `Legende: Abkürzungen mit Erklärung; aktuell verwendet: ${count}`);
  }

  function parseAndRender(text) {
    const mode = currentFormatMode || 'auto';
    const parsed = parseTabs(text, { format: mode });
    chart = buildTimedChart(parsed);
    updateCanvasSize();
    state = 'idle';
    if (stageEl) stageEl.scrollLeft = 0;
    updateFormatBadge(mode, parsed.detectedFormat);
    updateLegend(mode, parsed.detectedFormat);
    rebuildSortedNotes();
    renderSoundPanel();
    renderLaneLabels();
    // Render metadata based on current text; include file info if available
    try {
      const meta = extractMeta(text || '');
      renderMeta(meta, lastLoadedFile || undefined);
    } catch (_) { /* noop */ }
    renderFrame(0);
    updateHudPosition();
  }

  function updateCanvasSize() {
    // Canvas-Breite abhängig von der Schrittanzahl, aber mindestens so breit wie der sichtbare Stage‑Bereich
    const viewW = stageEl?.clientWidth || 900;
    const minInner = Math.max(0, viewW - PADS.L - PADS.R); // nutze freien Platz vollständig
    const totalSteps = Math.max(0, chart.steps);
    const innerW = Math.max(totalSteps * STEP_PX, minInner);
    // Höhe dynamisch an den sichtbaren Stage-Container anpassen
    const containerH = Math.max((stageEl?.clientHeight || 600), 260);
    canvas.height = containerH;
    canvas.width = PADS.L + innerW + PADS.R;
  }

  // Rendering (stationary grid with moving playhead)
  function renderFrame(t) {
    const { bpm, spb, leadIn, tsNum } = getSettings();
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Layout-Paddings (für Spur-Labels links)
    const padL = PADS.L, padR = PADS.R, padT = PADS.T, padB = PADS.B;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    // Lane rows (dynamisch)
    const lanes = chart.lanes || [];
    const laneCount = Math.max(1, lanes.length);
    const rowH = innerH / laneCount;

    // Step/grid metrics
    const stepDur = 60 / bpm / spb;
    const totalSteps = Math.max(1, chart.steps);
    const totalDur = leadIn + totalSteps * stepDur;

    // Background and row separators (dim muted lanes)
    for (let i = 0; i < laneCount; i++) {
      const yTop = padT + i * rowH;
      const lane = lanes[i];
      const on = lane ? !!laneSoundEnabled[lane.key] : true;
      const bgAlpha = on ? 0.03 : 0.01;
      ctx.fillStyle = `rgba(255,255,255,${bgAlpha})`;
      ctx.fillRect(padL, yTop, innerW, rowH);
      // Row separator line
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, Math.round(yTop + rowH));
      ctx.lineTo(padL + innerW, Math.round(yTop + rowH));
      ctx.stroke();
    }

    // Vertical grid lines per step; accent each beat and stronger on bar starts
    const stepsPerBar = Math.max(1, (tsNum || 4) * spb);
    for (let s = 0; s <= totalSteps; s++) {
      const x = padL + (s / totalSteps) * innerW;
      const isBeat = (s % spb) === 0;
      const isBar = (s % stepsPerBar) === 0;
      ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.28)' : (isBeat ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)');
      ctx.lineWidth = isBar ? 3 : (isBeat ? 2 : 1);
      ctx.beginPath();
      ctx.moveTo(Math.round(x), padT);
      ctx.lineTo(Math.round(x), padT + innerH);
      ctx.stroke();
    }

    // Hinweis, wenn keine Noten geladen sind (keine Spur-Beschriftungen im Canvas)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Arial, \'Noto Sans\', sans-serif';
    if (lanes.length === 0) {
      ctx.fillStyle = 'rgba(230,233,239,0.7)';
      ctx.fillText('Keine Noten geladen', padL + innerW / 2, padT + innerH / 2);
    }
    ctx.restore();

    // Notes as small pills at (x, lane row)
    for (const note of chart.notes) {
      const laneIndex = laneIdx(note.lane);
      if (laneIndex < 0) continue;
      const y = padT + laneIndex * rowH + rowH / 2;
      const x = padL + (note.step / totalSteps) * innerW;
      drawNote(x, y, note.lane);
    }

    // Playhead
    const playProg = (t - leadIn) / (totalSteps * stepDur);
    const clampedProg = Math.max(0, Math.min(1, playProg));
    const playX = padL + clampedProg * innerW;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.round(playX), padT);
    ctx.lineTo(Math.round(playX), padT + innerH);
    ctx.stroke();

    // Auto-Scroll: halte den Abspielzeiger im sichtbaren Bereich
    // Fokusposition ~35% der sichtbaren Breite von links, sanftes Folgen
    if (state === 'playing' && stageEl && canvas && typeof stageEl.scrollLeft === 'number') {
      const viewW = stageEl.clientWidth || 0;
      const contentW = canvas.width || 0;
      if (viewW > 0 && contentW > viewW) {
        const focusRatio = 0.35;
        const focusX = viewW * focusRatio;
        const maxScroll = Math.max(0, contentW - viewW);
        let targetScroll = playX - focusX;
        if (targetScroll < 0) targetScroll = 0;
        if (targetScroll > maxScroll) targetScroll = maxScroll;
        const cur = stageEl.scrollLeft;
        const delta = targetScroll - cur;
        if (Math.abs(delta) > 0.5) {
          stageEl.scrollLeft = cur + delta * 0.25; // sanftes Nachführen
        }
      }
    }
  }

  function getLane(key) {
    const lanes = chart.lanes || [];
    return (lanes.find(l => l.key === key) || ALL_LANES.find(l => l.key === key));
  }

  function drawNote(x, y, laneKey) {
    const lane = getLane(laneKey) || { color: '#8ab4f8' };
    const on = !!laneSoundEnabled[laneKey];
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = on ? 1 : 0.35;
    ctx.fillStyle = lane.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    // draw rounded rectangle pill
    const w = 26, h = 10, r = 5;
    roundRect(ctx, -w/2, -h/2, w, h, r);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function laneIdx(key) {
    const lanes = chart.lanes || [];
    return lanes.findIndex(l => l.key === key);
  }

  function start() {
    if (!chart.notes.length) {
      alert('Keine Noten geladen. Bitte Tabs einfügen und „Tabs parsen“ klicken oder eine Demo im Dropdown wählen.');
      return;
    }
    state = 'playing';
    startTime = nowSec();
    pauseAccum = 0;
    pauseStart = 0;
    lastBeatIndex = -1;
    rebuildSortedNotes();
    syncSchedulerToTime(0);
    ensureAudioCtx();
    loop();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    pauseStart = nowSec();
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    pauseAccum += nowSec() - pauseStart;
    pauseStart = 0;
    loop();
  }

  function stop() {
    state = 'stopped';
  }

  function currentTime() {
    if (state === 'idle') return 0;
    if (state === 'paused') return (pauseStart - startTime - pauseAccum);
    if (state === 'stopped') return 0;
    return nowSec() - startTime - pauseAccum;
  }

  function loop() {
    if (state !== 'playing') return;
    const t = currentTime();

    // Metronome ticking on beats (accent on bar start)
    if (metronomeEl.checked) {
      const { bpm, tsNum } = getSettings();
      const beatDur = 60 / bpm;
      const beatIndex = Math.floor(t / beatDur);
      if (beatIndex !== lastBeatIndex && t >= 0) {
        lastBeatIndex = beatIndex;
        const accent = (tsNum > 0) ? (beatIndex % tsNum === 0) : false;
        tickSound(accent);
      }
    }

    // Schedule instrument notes for the next short interval
    scheduleDueNotes(t);

    renderFrame(t);
    requestAnimationFrame(loop);
  }




  // Buttons
  btnParse.addEventListener('click', () => {
    lastLoadedFile = null; // manual parse clears file context
    parseAndRender(tabsEl.value);
  });
  btnStart.addEventListener('click', () => {
    if (state === 'paused') resume(); else start();
  });
  btnPause.addEventListener('click', () => { if (state === 'playing') pause(); });
  btnStop.addEventListener('click', () => { stop(); renderFrame(0); });
  // Instant demo switching on dropdown change (no button press needed)
  demoSelect?.addEventListener('change', () => {
    lastLoadedFile = null; // demo content is not a file
    const kind = demoSelect?.value || '';
    if (!kind) return; // nothing selected
    tabsEl.value = demoTabs(kind);
    parseAndRender(tabsEl.value);
  });
  // Fullscreen toggle
  function isFullscreen() {
    return !!document.fullscreenElement;
  }
  function updateFullscreenBtn() {
    if (!btnFullscreen) return;
    const on = isFullscreen();
    btnFullscreen.title = on ? 'Vollbild aus' : 'Vollbild ein';
    btnFullscreen.setAttribute('aria-label', on ? 'Vollbild verlassen' : 'Vollbild');
    btnFullscreen.innerHTML = `<span class="icon" aria-hidden="true">${on ? '🗗' : '⛶'}</span>`;
  }
  btnFullscreen?.addEventListener('click', async () => {
    try {
      if (!isFullscreen()) {
        if (stageEl.requestFullscreen) {
          await stageEl.requestFullscreen();
        } else if (stageEl.webkitRequestFullscreen) {
          stageEl.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Fullscreen toggle failed', e);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    updateFullscreenBtn();
    // On entering/exiting fullscreen, recalc sizes
    updateCanvasSize();
    renderLaneLabels();
    renderFrame(0);
    updateHudPosition();
    updateLaneLabelsPosition();
  });

  // Immediate refresh on settings change
  bpmEl?.addEventListener('input', () => renderFrame(0));
  spbEl?.addEventListener('input', () => renderFrame(0));
  leadInEl?.addEventListener('input', () => renderFrame(0));
  tsNumEl?.addEventListener('input', () => renderFrame(0));
  tsDenEl?.addEventListener('input', () => renderFrame(0));
  // Format-Badge klickbar zum Umschalten
  formatBadgeEl?.addEventListener('click', () => {
    currentFormatMode = (currentFormatMode === 'auto') ? 'classic' : (currentFormatMode === 'classic' ? 'guitar' : 'auto');
    parseAndRender(tabsEl.value);
  });

  // Observe stage resizing
  if (window.ResizeObserver && stageEl) {
    const ro = new ResizeObserver(() => { 
      updateCanvasSize(); 
      renderLaneLabels();
      renderFrame(0); 
      updateHudPosition(); 
      updateLaneLabelsPosition();
    });
    ro.observe(stageEl);
  }
  window.addEventListener('resize', () => { 
    updateCanvasSize(); 
    renderLaneLabels();
    renderFrame(0); 
    updateHudPosition(); 
    updateLaneLabelsPosition();
  });
  // Keep HUD and lane labels pinned on scrolls
  stageEl?.addEventListener('scroll', () => { updateHudPosition(); updateLaneLabelsPosition(); });
  window.addEventListener('scroll', () => { updateHudPosition(); updateLaneLabelsPosition(); });

  // File upload handling
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        tabsEl.value = text;
        lastLoadedFile = file; // remember file for subsequent parses
        const meta = extractMeta(text);
        renderMeta(meta, file);
        parseAndRender(text);
      } catch (err) {
        console.error('Datei lesen fehlgeschlagen:', err);
        alert('Konnte die Datei nicht lesen.');
      }
    });
  }

  function extractMeta(text) {
    const lines = text.split(/\r?\n/);
    const meta = { fields: {}, tracks: [] };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^\s*(Title|Artist|Album|Author)\s*:\s*$/i);
      if (m) {
        const key = m[1].toLowerCase();
        let j = i + 1;
        const vals = [];
        while (j < lines.length && lines[j].trim() !== '') {
          vals.push(lines[j].trim());
          j++;
        }
        if (vals.length) meta.fields[key] = vals.join(' ');
        i = j - 1;
        continue;
      }
      const m2 = line.match(/^\s*Track\s*(\d+)\s*:\s*$/i);
      if (m2) {
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j++;
        let desc = '';
        if (j < lines.length) desc = lines[j].trim();
        meta.tracks.push({ index: parseInt(m2[1], 10), desc });
        i = j; // skip consumed
        continue;
      }
      // Stop scanning metadata once we hit typical tab content
      const looksLikeTab = /^\s*(?:[EADGBe]|HH|HC|HO|HP|SN|BD|RD|RB|CA|CB|CH|SP|T[1-6]|TH|TM|LM|TL|FH|FL)\s*[:|]/i.test(line);
      if (looksLikeTab) break;
    }
    return meta;
  }

  function renderMeta(meta, file) {
    if (!fileMetaEl) return;
    const parts = [];
    const f = (meta && meta.fields) || {};
    const t = (meta && meta.tracks) || [];
    if (file && file.name) {
      parts.push(`<strong>Datei:</strong> ${escapeHtml(file.name)} (${((file.size || 0) / 1024).toFixed(1)} KB)`);
    }
    if (f.title) parts.push(`<strong>Titel:</strong> ${escapeHtml(f.title)}`);
    if (f.artist) parts.push(`<strong>Künstler:</strong> ${escapeHtml(f.artist)}`);
    if (f.album) parts.push(`<strong>Album:</strong> ${escapeHtml(f.album)}`);
    if (f.author) parts.push(`<strong>Autor:</strong> ${escapeHtml(f.author)}`);
    if (t.length) {
      const trackLines = t
        .sort((a, b) => (a.index || 0) - (b.index || 0))
        .map(tr => `Track ${tr.index}: ${escapeHtml(tr.desc || '')}`);
      parts.push(trackLines.join('<br/>'));
    }
    fileMetaEl.innerHTML = parts.join('<br/>');
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function demoClassic() {
    return [
      'Title:',
      '  Demo – Classic ASCII',
      '',
      'HC|x-x-|x-x-|x-x-|x-x-|',
      'SN|----|o---|----|o---|',
      'BD|o---|----|o---|----|',
      '',
      'HC|x-x-|x-x-|x-x-|x-x-|',
      'SN|----|--o-|----|--o-|',
      'BD|o---|o---|o---|o---|'
    ].join('\n');
  }

  function demoGuitar() {
    // Gitarren-Tab-ähnliche Zeilen mit zweistelligen MIDI-Zahlen
    // 42=HH closed, 38=Snare, 36=Bassdrum
    return [
      'Title:',
      '  Demo – Gitarren‑Tab (MIDI‑Zahlen)',
      '',
      'E|-42--42--42--42-|',
      'G|----38------38--|',
      'A|36------36------|',
      '',
      'E|-46--46--42--42-|',
      'G|----38------38--|',
      'A|36------36------|'
    ].join('\n');
  }

  function demoTabs(kind = 'classic') {
    if (kind === 'guitar') return demoGuitar();
    return demoClassic();
  }

  // Initial paint
  updateCanvasSize();
  renderFrame(0);
  // Init fullscreen button state
  try { if (typeof updateFullscreenBtn === 'function') updateFullscreenBtn(); } catch(_){}
})();
