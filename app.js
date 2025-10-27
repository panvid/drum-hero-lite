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
  // Formatsteuerung: immer Auto, optional Override durch Klick auf Badge
  let currentFormatMode = 'auto'; // 'auto' | 'classic' | 'guitar'

  const btnParse = $('#btnParse');
  const btnStart = $('#btnStart');
  const btnPause = $('#btnPause');
  const btnStop = $('#btnStop');
  const btnDemo = $('#btnDemo');
  const fileInput = $('#fileInput');
  const btnFullscreen = $('#btnFullscreen');

  const tabsEl = $('#tabs');
  const stageEl = document.querySelector('.stage');
  const hudEl = document.querySelector('.hud');
  const fileMetaEl = document.getElementById('fileMeta');
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
  const PADS = { L: 120, R: 20, T: 40, B: 40 };

  // Alle möglichen Spuren (wird später dynamisch gefiltert)
  const ALL_LANES = [
    { key: 'hhc', color: '#ffd166', label: 'Hi‑Hat geschlossen' },
    { key: 'hhp', color: '#ffc14d', label: 'Hi‑Hat Pedal' },
    { key: 'hho', color: '#ffb347', label: 'Hi‑Hat offen' },
    { key: 'cr1', color: '#f7a8f0', label: 'Crash 1' },
    { key: 'cr2', color: '#f58ae6', label: 'Crash 2' },
    { key: 'ride', color: '#9ad1ff', label: 'Ride' },
    { key: 'ridebell', color: '#8bc7ff', label: 'Ride Bell' },
    { key: 'china', color: '#f68f6f', label: 'China' },
    { key: 'splash', color: '#f6cf6f', label: 'Splash' },
    { key: 'sn', color: '#ef476f', label: 'Snare' },
    { key: 't1', color: '#d4e157', label: 'Tom High' },
    { key: 't2', color: '#b0d445', label: 'Tom High‑Mid' },
    { key: 't3', color: '#8cc64a', label: 'Tom Low‑Mid' },
    { key: 't4', color: '#5cc06e', label: 'Tom Low' },
    { key: 't5', color: '#41b58a', label: 'Floor Tom High' },
    { key: 't6', color: '#2aa57a', label: 'Floor Tom Low' },
    { key: 'bd', color: '#06d6a0', label: 'Bassdrum' },
  ];

  let chart = { notes: [], steps: 0 };
  let state = 'idle'; // idle | playing | paused | stopped
  let startTime = 0; // performance.now() when playback started
  let pauseAccum = 0; // accumulated paused time
  let pauseStart = 0;


  // Metronome
  let audioCtx = null;
  let lastBeatIndex = -1;

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
    const tracks = { hh: [], sn: [], bd: [] };
    const guitarSeqs = [];
    let detectedFormat = null;
    const aliases = [
      { key: 'hh', names: ['hh', 'h', 'ch', 'c', 'hat', 'ride', 'cy', 'cym'] },
      { key: 'sn', names: ['sn', 's', 'sd', 'snare'] },
      { key: 'bd', names: ['bd', 'k', 'kick', 'bass'] },
    ];
    const stringNames = ['e', 'a', 'd', 'g', 'b']; // Gitarren-Saitenlabels

    // Helper to map label text to track key
    function mapLabel(label) {
      const norm = label.toLowerCase().replace(/[^a-z]/g, '');
      for (const a of aliases) {
        if (a.names.includes(norm)) return a.key;
      }
      return null;
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
      for (let i = 0; i < len; i++) {
        if (mergedObj.hh[i] && mergedObj.hh[i] !== '-') arr.push({ lane: 'hhc', step: i });
        if (mergedObj.sn[i] && mergedObj.sn[i] !== '-') arr.push({ lane: 'sn', step: i });
        if (mergedObj.bd[i] && mergedObj.bd[i] !== '-') arr.push({ lane: 'bd', step: i });
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
      if (guitarSeqs.length === 0) return { notes: [], steps: 0, detectedFormat: 'guitar' };
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
              if (lane) { notes.push({ lane, step: i }); i += 1; continue; }
            }
          }
        }
      }
      return { notes, steps: gMax, detectedFormat: 'guitar' };
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
    if (guitarSeqs.length === 0) return { notes: [], steps: 0, detectedFormat: null };
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
              i += 1; // consume the second digit of this token
              continue;
            }
            // If the two-digit number is not a known MIDI mapping, fall through and treat the first digit as noise
          }
          // Ignore single stray digits (no one-digit MIDI notes supported)
        }
      }
    }

    return { notes, steps: maxLen, detectedFormat: 'guitar' };
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
    return { notes, steps: parsed.steps, stepDur, lanes, detectedFormat: parsed.detectedFormat ?? null };
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

  function parseAndRender(text) {
    const mode = currentFormatMode || 'auto';
    const parsed = parseTabs(text, { format: mode });
    chart = buildTimedChart(parsed);
    updateCanvasSize();
    state = 'idle';
    if (stageEl) stageEl.scrollLeft = 0;
    updateFormatBadge(mode, parsed.detectedFormat);
    // Render metadata based on current text; include file info if available
    try {
      const meta = extractMeta(text || '');
      renderMeta(meta, lastLoadedFile || undefined);
    } catch (_) { /* noop */ }
    renderFrame(0);
    updateHudPosition();
  }

  function updateCanvasSize() {
    // Canvas-Breite abhängig von der Schrittanzahl, um horizontales Scrollen zu ermöglichen
    const minInner = 600; // Mindestbreite des Inhaltsbereichs
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

    // Background and row separators
    for (let i = 0; i < laneCount; i++) {
      const yTop = padT + i * rowH;
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
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

    // Spur-Beschriftungen (links) oder Hinweis
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Arial, \'Noto Sans\', sans-serif';
    if (lanes.length === 0) {
      // Hinweis in der Mitte anzeigen
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(230,233,239,0.7)';
      ctx.fillText('Keine Noten geladen', padL + innerW / 2, padT + innerH / 2);
    } else {
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        const yMid = padT + i * rowH + rowH / 2;
        ctx.fillStyle = 'rgba(230,233,239,0.9)';
        ctx.fillText(lane.label || lane.key.toUpperCase(), padL - 12, yMid);
      }
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
    ctx.save();
    ctx.translate(x, y);
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
      alert('Keine Noten geladen. Bitte Tabs einfügen und „Tabs parsen“ klicken oder „Demo laden“.');
      return;
    }
    state = 'playing';
    startTime = nowSec();
    pauseAccum = 0;
    pauseStart = 0;
    lastBeatIndex = -1;
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
  btnDemo.addEventListener('click', () => {
    lastLoadedFile = null; // demo content is not a file
    tabsEl.value = demoTabs();
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
    renderFrame(0);
    updateHudPosition();
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
    const ro = new ResizeObserver(() => { updateCanvasSize(); renderFrame(0); updateHudPosition(); });
    ro.observe(stageEl);
  }
  window.addEventListener('resize', () => { updateCanvasSize(); renderFrame(0); updateHudPosition(); });
  // Keep HUD pinned on scrolls
  stageEl?.addEventListener('scroll', () => { updateHudPosition(); });
  window.addEventListener('scroll', () => { updateHudPosition(); });

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
      const looksLikeTab = /^(\s*[EADGBe]|HH|SN|BD)\s*[:|]/i.test(line);
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

  function demoTabs() {
    return [
      'HH|x-x-|x-x-|x-x-|x-x-|',
      'SN|----|o---|----|o---|',
      'BD|o---|----|o---|----|',
      '',
      'HH|x-x-|x-x-|x-x-|x-x-|',
      'SN|----|--o-|----|--o-|',
      'BD|o---|o---|o---|o---|'
    ].join('\n');
  }

  // Initial paint
  updateCanvasSize();
  renderFrame(0);
  // Init fullscreen button state
  try { if (typeof updateFullscreenBtn === 'function') updateFullscreenBtn(); } catch(_){}
})();
