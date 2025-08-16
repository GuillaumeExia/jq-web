// jq-web Playground logic
// Loads jq either from ../jq.js or CDN fallback injected by index.html

const el = {
  filter: /** @type {HTMLInputElement} */ (document.getElementById('filter')),
  input: /** @type {HTMLTextAreaElement} */ (document.getElementById('input')),
  run: /** @type {HTMLButtonElement} */ (document.getElementById('runBtn')),
  loadExample: /** @type {HTMLButtonElement} */ (document.getElementById('loadExampleBtn')),
  loadFile: /** @type {HTMLButtonElement} */ (document.getElementById('loadFileBtn')),
  fileInput: /** @type {HTMLInputElement} */ (document.getElementById('fileInput')),
  formatBtn: /** @type {HTMLButtonElement} */ (document.getElementById('formatBtn')),
  minifyBtn: /** @type {HTMLButtonElement} */ (document.getElementById('minifyBtn')),
  error: /** @type {HTMLPreElement} */ (document.getElementById('error')),
  output: /** @type {HTMLPreElement} */ (document.getElementById('output')),
  copyOutputBtn: /** @type {HTMLButtonElement} */ (document.getElementById('copyOutputBtn')),
  downloadBtn: /** @type {HTMLButtonElement} */ (document.getElementById('downloadBtn')),
  themeToggle: /** @type {HTMLButtonElement} */ (document.getElementById('themeToggle')),
};

let jqReady = null;
let jqLoadPromise = null;

function waitForJq(timeoutMs = 10000) {
  if (window.jq) return Promise.resolve(window.jq);
  if (!jqLoadPromise) {
    jqLoadPromise = new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        if (window.jq) return resolve(window.jq);
        if (Date.now() - start > timeoutMs) return reject(new Error('jq-web failed to load'));
        setTimeout(check, 100);
      })();
    });
  }
  return jqLoadPromise;
}

function setBusy(busy) {
  el.run.disabled = busy;
}

function showError(msg) {
  el.error.textContent = msg;
  el.error.hidden = !msg;
}

function setOutput(text) {
  el.output.textContent = text;
}

function tryParseJSON(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function formatJSON(text) {
  const parsed = tryParseJSON(text);
  if (parsed.ok) return JSON.stringify(parsed.value, null, 2);
  return text; // leave as-is if not valid JSON
}

function minifyJSON(text) {
  const parsed = tryParseJSON(text);
  if (parsed.ok) return JSON.stringify(parsed.value);
  return text;
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function runJq() {
  setBusy(true);
  showError('');
  setOutput('');

  try {
    if (!jqReady) jqReady = waitForJq(20000); // wait for jq global promise to appear
    const jq = await jqReady;

    const filter = el.filter.value.trim() || '.';
    const inputText = el.input.value.trim();

    // Try structured mode first
    const parsed = tryParseJSON(inputText);
    if (parsed.ok) {
      const result = await jq.json(parsed.value, filter);
      setOutput(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    } else {
      // Fallback to raw mode (accepts plain strings, NDJSON, etc.)
      const raw = await jq.raw(inputText, filter);
      setOutput(raw);
    }
  } catch (err) {
    console.error(err);
    showError(String(err?.message || err));
  } finally {
    setBusy(false);
  }
}

function bindEvents() {
  // Initially disable Run until jq is ready
  el.run.disabled = true;
  waitForJq(20000)
    .then(() => {
      el.run.disabled = false;
    })
    .catch((e) => {
      showError('Failed to load jq-web. Check network or build jq.js.');
      el.run.disabled = false; // allow attempts anyway (will show error)
    });
  el.run.addEventListener('click', runJq);

  // Ctrl+Enter to run
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runJq();
    }
  });

  el.loadExample.addEventListener('click', () => {
    el.filter.value = '.items[] | {id, name}';
    el.input.value = formatJSON(
      JSON.stringify({
        items: [
          { id: 1, name: 'Ada Lovelace' },
          { id: 2, name: 'Grace Hopper' },
          { id: 3, name: 'Alan Turing' },
        ],
      })
    );
  });

  el.loadFile.addEventListener('click', () => {
    el.fileInput.click();
  });

  el.fileInput.addEventListener('change', async () => {
    const file = el.fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    el.input.value = text;
  });

  el.formatBtn.addEventListener('click', () => {
    el.input.value = formatJSON(el.input.value);
  });

  el.minifyBtn.addEventListener('click', () => {
    el.input.value = minifyJSON(el.input.value);
  });

  el.copyOutputBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el.output.textContent || '');
      el.copyOutputBtn.textContent = 'Copied!';
      setTimeout(() => (el.copyOutputBtn.textContent = 'Copy'), 900);
    } catch {}
  });

  el.downloadBtn.addEventListener('click', () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    download(`jq-output-${ts}.json`, el.output.textContent || '');
  });

  // Theme toggle
  const root = document.documentElement;
  const THEME_KEY = 'jqweb-theme';
  function applyTheme(theme) {
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme'); // dark is default
    el.themeToggle.textContent = theme === 'light' ? 'Switch to Dark' : 'Switch to Light';
  }
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
  el.themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

bindEvents();

// Small UX nicety: prefill default examples on first load
if (!el.input.value) {
  el.filter.value = '[.foo, .bar]';
  el.input.value = formatJSON(JSON.stringify({ foo: 5, bar: 'baz' }));
}
