(function() {
  const STORE_KEY = 'lang';
  function normLang(l) {
    return (l && l.toLowerCase().startsWith('en')) ? 'en' : 'de';
  }
  let lang = normLang(localStorage.getItem(STORE_KEY) || document.documentElement.getAttribute('lang') || navigator.language || 'de');

  const dict = {
    de: {
      'app.title': 'Drum Hero Lite',
      'app.tagline': 'Füge deine Drum‑Tabs ein – klassisches Drum‑ASCII (HH/SN/BD), Gitarren‑Tabs mit MIDI‑Zahlen (E/A/D/G/B/e) oder lade eine Standard‑MIDI‑Datei (.mid/.midi). Übe mit Raster, Abspielzeiger und optionalem Metronom.',
      'lang.title': 'Sprache',
      'lang.de': 'Deutsch',
      'lang.en': 'Englisch',

      'controls.file.label': 'Tab‑Datei',
      'controls.parse': 'Tabs parsen',
      'controls.demo.placeholder': 'Demo auswählen …',
      'controls.demo.classic': 'Demo: Drum‑ASCII',
      'controls.demo.guitar': 'Demo: Gitarren‑Tab (MIDI‑Zahlen)',

      'format.badge.title': 'Format erkennen/übersteuern – klicken zum Umschalten',
      'format.prefix': 'Format:',
      'format.auto.none': '—',
      'format.mode.classic': 'Drum‑ASCII',
      'format.mode.guitar': 'Gitarren‑Tab',
      'format.mode.midi': 'MIDI',
      'format.forced': '(erzwungen)',

      'editor.label': 'Tabs',
      'editor.placeholder': 'Füge hier deine Songsterr/ASCII Drum Tabs ein...',
      'legend.aria.guitar': 'Legende: Zahlen und Instrumente; aktuell verwendet: {{count}}',
      'legend.aria.classic': 'Legende: Abkürzungen mit Erklärung; aktuell verwendet: {{count}}',
      'legend.used': ' – verwendet',
      'legend.notUsed': ' – nicht verwendet',

      'transport.title': 'Transport und Tempo',
      'btn.start.title': 'Start / Fortsetzen',
      'btn.start.aria': 'Start',
      'btn.pause.title': 'Pause',
      'btn.pause.aria': 'Pause',
      'btn.stop.title': 'Stop',
      'btn.stop.aria': 'Stop',

      'field.bpm.title': 'Beats pro Minute',
      'field.bpm.mini': 'BPM',
      'field.spb.title': 'Schritte pro Schlag (z. B. 4 = 16tel, 3 = Triolen)',
      'field.spb.mini': 'SPB',
      'field.ts.title': 'Taktart (Zähler/Nenner)',
      'field.ts.mini': 'Takt',
      'field.leadIn.title': 'Einzähler in Sekunden',
      'field.leadIn.mini': 'Einz',
      'switch.metronome.title': 'Metronom an/aus',
      'switch.metronome.mini': 'Met',
      'switch.loop.title': 'Dauerschleife an/aus',
      'switch.loop.mini': 'Loop',

      'btn.fullscreen.titleOn': 'Vollbild ein',
      'btn.fullscreen.titleOff': 'Vollbild aus',
      'btn.fullscreen.ariaOn': 'Vollbild',
      'btn.fullscreen.ariaOff': 'Vollbild verlassen',

      'footer.made': 'Made with',
      'footer.in.city': 'in Leipzig',
      'footer.help': 'Hilfe',
      'footer.help.title': 'Hilfe & Format‑Hinweise',
      'footer.github.title': 'GitHub Repository',
      'footer.note': 'Hinweis: Diese Seite und der Code sind KI‑generiert.',

      'lane.hhc': 'Hi‑Hat geschlossen',
      'lane.hhp': 'Hi‑Hat Pedal',
      'lane.hho': 'Hi‑Hat offen',
      'lane.cr1': 'Crash 1',
      'lane.cr2': 'Crash 2',
      'lane.ride': 'Ride',
      'lane.ridebell': 'Ride Bell',
      'lane.china': 'China',
      'lane.splash': 'Splash',
      'lane.sn': 'Snare',
      'lane.t1': 'Tom High',
      'lane.t2': 'Tom High‑Mid',
      'lane.t3': 'Tom Low‑Mid',
      'lane.t4': 'Tom Low',
      'lane.t5': 'Floor Tom High',
      'lane.t6': 'Floor Tom Low',
      'lane.bd': 'Bassdrum',

      'sound.onoff': 'Ton an/aus',

      'meta.nameSize': 'Dateiname und Größe',
      'meta.title': 'Titel',
      'meta.artist': 'Künstler',
      'meta.album': 'Album',
      'meta.author': 'Autor',
      'meta.tempo': 'Tempo (BPM)',
      'meta.time': 'Taktart',
      'meta.spb': 'Schritte pro Schlag',

      'canvas.noNotes': 'Keine Noten geladen',

      'alert.noNotes': 'Keine Noten geladen. Bitte Tabs einfügen und „Tabs parsen“ klicken oder eine Demo im Dropdown wählen.',
      'alert.midiReadError': 'Die MIDI‑Datei konnte nicht gelesen werden.',
      'alert.fileReadError': 'Konnte die Datei nicht lesen.'
    },
    en: {
      'app.title': 'Drum Hero Lite',
      'app.tagline': 'Add your drum tabs – classic drum ASCII (HH/SN/BD), guitar tabs with MIDI numbers (E/A/D/G/B/e), or load a Standard MIDI file (.mid/.midi). Practice with a grid, playhead, and optional metronome.',
      'lang.title': 'Language',
      'lang.de': 'German',
      'lang.en': 'English',

      'controls.file.label': 'Tab file',
      'controls.parse': 'Parse tabs',
      'controls.demo.placeholder': 'Choose demo …',
      'controls.demo.classic': 'Demo: Drum ASCII',
      'controls.demo.guitar': 'Demo: Guitar tab (MIDI numbers)',

      'format.badge.title': 'Detect/override format – click to toggle',
      'format.prefix': 'Format:',
      'format.auto.none': '—',
      'format.mode.classic': 'Drum ASCII',
      'format.mode.guitar': 'Guitar tab',
      'format.mode.midi': 'MIDI',
      'format.forced': '(forced)',

      'editor.label': 'Tabs',
      'editor.placeholder': 'Paste your Songsterr/ASCII drum tabs here...',
      'legend.aria.guitar': 'Legend: numbers and instruments; currently used: {{count}}',
      'legend.aria.classic': 'Legend: abbreviations with explanation; currently used: {{count}}',
      'legend.used': ' – used',
      'legend.notUsed': ' – not used',

      'transport.title': 'Transport and tempo',
      'btn.start.title': 'Start / Resume',
      'btn.start.aria': 'Start',
      'btn.pause.title': 'Pause',
      'btn.pause.aria': 'Pause',
      'btn.stop.title': 'Stop',
      'btn.stop.aria': 'Stop',

      'field.bpm.title': 'Beats per minute',
      'field.bpm.mini': 'BPM',
      'field.spb.title': 'Steps per beat (e.g., 4 = sixteenth, 3 = triplets)',
      'field.spb.mini': 'SPB',
      'field.ts.title': 'Time signature (numerator/denominator)',
      'field.ts.mini': 'Time',
      'field.leadIn.title': 'Count-in in seconds',
      'field.leadIn.mini': 'Cnt',
      'switch.metronome.title': 'Metronome on/off',
      'switch.metronome.mini': 'Met',
      'switch.loop.title': 'Loop on/off',
      'switch.loop.mini': 'Loop',

      'btn.fullscreen.titleOn': 'Enter fullscreen',
      'btn.fullscreen.titleOff': 'Exit fullscreen',
      'btn.fullscreen.ariaOn': 'Fullscreen',
      'btn.fullscreen.ariaOff': 'Leave fullscreen',

      'footer.made': 'Made with',
      'footer.in.city': 'in Leipzig',
      'footer.help': 'Help',
      'footer.help.title': 'Help & format notes',
      'footer.github.title': 'GitHub repository',
      'footer.note': 'Note: This page and the code are AI‑generated.',

      'lane.hhc': 'Closed hi‑hat',
      'lane.hhp': 'Hi‑hat pedal',
      'lane.hho': 'Open hi‑hat',
      'lane.cr1': 'Crash 1',
      'lane.cr2': 'Crash 2',
      'lane.ride': 'Ride',
      'lane.ridebell': 'Ride bell',
      'lane.china': 'China',
      'lane.splash': 'Splash',
      'lane.sn': 'Snare',
      'lane.t1': 'High tom',
      'lane.t2': 'High‑mid tom',
      'lane.t3': 'Low‑mid tom',
      'lane.t4': 'Low tom',
      'lane.t5': 'Floor tom high',
      'lane.t6': 'Floor tom low',
      'lane.bd': 'Bass drum',

      'sound.onoff': 'Sound on/off',

      'meta.nameSize': 'Filename and size',
      'meta.title': 'Title',
      'meta.artist': 'Artist',
      'meta.album': 'Album',
      'meta.author': 'Author',
      'meta.tempo': 'Tempo (BPM)',
      'meta.time': 'Time signature',
      'meta.spb': 'Steps per beat',

      'alert.noNotes': 'No notes loaded. Please paste tabs and click “Parse tabs”, or choose a demo from the dropdown.',
      'alert.midiReadError': 'Could not read the MIDI file.',
      'alert.fileReadError': 'Could not read the file.'
    }
  };

  function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{\{(.*?)\}\}/g, (m, k) => (params[k.trim()] ?? m));
  }

  function t(key, fallback, params) {
    let s = (dict[lang] && dict[lang][key]) || (dict.de && dict.de[key]) || fallback || key;
    if (typeof s !== 'string') return fallback || key;
    return interpolate(s, params);
  }

  function setLang(l) {
    lang = normLang(l);
    localStorage.setItem(STORE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    applyDocument();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }
  function getLang() { return lang; }

  function applyDocument(root) {
    const doc = root && root.querySelectorAll ? root : document;
    doc.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key, el.textContent);
    });
    const attrMap = [
      ['data-i18n-title', 'title'],
      ['data-i18n-placeholder', 'placeholder'],
      ['data-i18n-aria', 'aria-label']
    ];
    attrMap.forEach(([dataAttr, attr]) => {
      doc.querySelectorAll(`[${dataAttr}]`).forEach(el => {
        const key = el.getAttribute(dataAttr);
        const val = t(key, el.getAttribute(attr) || '');
        if (attr.startsWith('aria-')) {
          el.setAttribute(attr, val);
        } else {
          el[attr] = val;
        }
      });
    });
  }

  window.I18N = { t, setLang, getLang, applyDocument, dict };

  document.addEventListener('DOMContentLoaded', () => {
    // Initialize selector if present (legacy fallback)
    const sel = document.getElementById('langSelect');
    if (sel) {
      try { sel.value = lang; } catch(_) {}
      sel.addEventListener('change', () => setLang(sel.value));
      sel.setAttribute('title', t('lang.title'));
      const optDe = sel.querySelector('option[value="de"]');
      const optEn = sel.querySelector('option[value="en"]');
      if (optDe) optDe.textContent = t('lang.de');
      if (optEn) optEn.textContent = t('lang.en');
    }

    // Initialize icon button if present
    const btn = document.getElementById('langBtn');
    function flagFor(l) { return l === 'en' ? '🇬🇧' : '🇩🇪'; }
    function updateBtn() {
      if (!btn) return;
      btn.title = t('lang.title');
      btn.setAttribute('aria-label', t('lang.title'));
      const span = btn.querySelector('.icon');
      if (span) span.textContent = flagFor(lang);
    }
    if (btn) {
      btn.addEventListener('click', () => {
        setLang(lang === 'de' ? 'en' : 'de');
      });
      updateBtn();
    }

    // Initialize language switch if present
    const langSwitch = document.getElementById('langSwitch');
    function updateSwitch() {
      if (!langSwitch) return;
      try { langSwitch.checked = (lang === 'en'); } catch(_) {}
      const wrap = langSwitch.closest('.lang-switch') || langSwitch.parentElement;
      if (wrap) {
        wrap.title = t('lang.title');
        wrap.setAttribute('aria-label', t('lang.title'));
      }
    }
    if (langSwitch) {
      try { langSwitch.checked = (lang === 'en'); } catch(_) {}
      langSwitch.addEventListener('change', () => {
        setLang(langSwitch.checked ? 'en' : 'de');
      });
      updateSwitch();
    }

    applyDocument();
    // Ensure help link carries language
    function updateHelpLinks() {
      document.querySelectorAll('a[href="help.html"]').forEach(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          u.searchParams.set('lang', lang);
          a.setAttribute('href', u.pathname + u.search + u.hash);
        } catch(_) {}
      });
    }
    updateHelpLinks();

    // If URL has ?lang=.., honor it
    try {
      const urlLang = new URL(location.href).searchParams.get('lang');
      if (urlLang && normLang(urlLang) !== lang) {
        setLang(urlLang);
      }
    } catch(_) {}

    // Keep icon and links in sync on language change
    document.addEventListener('langchange', () => { updateBtn(); updateSwitch(); updateHelpLinks(); });
  });
})();
