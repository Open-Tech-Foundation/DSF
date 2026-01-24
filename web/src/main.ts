import './style.css';
import { DSFLexer, DSFParser, stringify, format } from '../../ref-impl/ts/dsf.ts';

declare const jsyaml: any;
declare const JSON5: any;
declare const toml: any;
declare const fxp: any;
declare const msgpack: any;
declare const CBOR: any;

const SAMPLES = {
  // ... (SAMPLES remain same)
  welcome: `{
  title: \`Welcome to DSF\`,
  version: 1.0,
  features: [
    \`Predictable\`,
    \`High Performance\`,
    \`Zero Overhead\`,
  ],
  metrics: {
    latency: 0.12,
    isActive: T,
  },
  timestamp: D(2026-01-24),
}`,
  users: `{
  users: [
    {
      id: BN(10029384756201928374),
      name: \`Alice\`,
      email: \`alice@example.com\`,
      roles: [\`admin\`, \`dev\`],
      lastLogin: D(2026-01-23T14:20:00Z),
    },
    {
      id: BN(10029384756201928375),
      name: \`Bob\`,
      email: \`bob@example.com\`,
      avatar: B(89504E470D0A1A0A),
      isActive: F,
    },
  ],
}`,
  complex: `{
  config: {
    debug: T,
    max_retries: 3,
    timeout: 1.5e3,
  },
  data: [
    N,
    123,
    -45.6,
    \`multi-line
string\`,
  ],
  metadata: {
    hash: B(E2C1),
    tags: [],
  },
}`
};

const FORMATS = [
  { id: 'json', name: 'JSON', ext: '.json', bidirectional: true },
  { id: 'json5', name: 'JSON5', ext: '.json5', bidirectional: true },
  { id: 'yaml', name: 'YAML', ext: '.yaml', bidirectional: true },
  { id: 'toml', name: 'TOML', ext: '.toml', bidirectional: true },
  { id: 'xml', name: 'XML', ext: '.xml', bidirectional: true },
  { id: 'minified', name: 'Minified DSF', ext: '.dsf', bidirectional: true },
  { id: 'msgpack', name: 'MsgPack (Hex)', ext: '.msgpack', bidirectional: false },
  { id: 'cbor', name: 'CBOR (Hex)', ext: '.cbor', bidirectional: false },
];

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="container">
    <header>
      <h1>DSF Playground</h1>
      <p class="subtitle">Experience the future of predictable, high-performance data interchange. Edit DSF on the left, see results on the right.</p>
    </header>

    <main class="playground">
      <div class="editor-pane">
        <div class="pane-header">
          <div class="header-left">
            <span class="label">DSF Input</span>
            <select id="sample-select">
              <option value="welcome">Welcome</option>
              <option value="users">User Profile</option>
              <option value="complex">Complex Types</option>
            </select>
          </div>
          <button id="format-btn" class="action-btn">Format</button>
        </div>
        <textarea id="dsf-input" spellcheck="false">${SAMPLES.welcome}</textarea>
      </div>

      <div class="editor-pane">
        <div class="pane-header">
          <div class="header-left">
            <span class="label">Output</span>
            <select id="format-select">
              ${FORMATS.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
            </select>
          </div>
          <span class="ext" id="output-ext">.json</span>
        </div>
        <textarea id="output-view" class="output-viewer" spellcheck="false"></textarea>
      </div>
    </main>

    <div class="stats-container">
      <div class="stat-card">
        <div class="stat-value" id="dsf-size">0 B</div>
        <div class="stat-label">DSF Payload</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="target-size">0 B</div>
        <div class="stat-label" id="target-label">JSON Equivalent</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="reduction-pct">0%</div>
        <div class="stat-label">Space Reduction</div>
      </div>
    </div>

    <footer>
      Created by the <a href="https://github.com/Open-Tech-Foundation">Open Tech Foundation</a>. 
      Read the <a href="https://github.com/Open-Tech-Foundation/dsf/blob/main/doc/spec.md">Spec</a>.
    </footer>
  </div>
`;

const dsfInput = document.querySelector<HTMLTextAreaElement>('#dsf-input')!;
const formatBtn = document.querySelector<HTMLButtonElement>('#format-btn')!;
const outputView = document.querySelector<HTMLTextAreaElement>('#output-view')!;
const sampleSelect = document.querySelector<HTMLSelectElement>('#sample-select')!;
const formatSelect = document.querySelector<HTMLSelectElement>('#format-select')!;
const outputExt = document.querySelector<HTMLSpanElement>('#output-ext')!;

const dsfSizeEl = document.querySelector<HTMLDivElement>('#dsf-size')!;
const targetSizeEl = document.querySelector<HTMLDivElement>('#target-size')!;
const targetLabelEl = document.querySelector<HTMLDivElement>('#target-label')!;
const reductionEl = document.querySelector<HTMLDivElement>('#reduction-pct')!;

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(2) + ' KB';
}

function updateStats(dsfText: string, targetText: string, formatName: string) {
  const dsfBytes = new TextEncoder().encode(dsfText).length;
  let targetBytes: number;
  const currentFormat = formatSelect.value;
  if (currentFormat === 'msgpack' || currentFormat === 'cbor') {
    targetBytes = targetText.replace(/[^0-9A-F]/gi, '').length / 2;
  } else {
    targetBytes = new TextEncoder().encode(targetText).length;
  }

  const reduction = targetBytes > 0 ? ((targetBytes - dsfBytes) / targetBytes * 100).toFixed(1) : '0.0';

  dsfSizeEl.textContent = formatBytes(dsfBytes);
  targetSizeEl.textContent = formatBytes(targetBytes);
  targetLabelEl.textContent = `${formatName} Equivalent`;
  reductionEl.textContent = reduction + '%';

  reductionEl.style.color = parseFloat(reduction) > 0 ? 'var(--accent-color)' : '#ff4d4d';
}

function prepareForSerialization(v: any): any {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Uint8Array) {
    return Array.from(v).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
  }
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(prepareForSerialization);
  if (v !== null && typeof v === 'object') {
    const res: any = {};
    for (const k in v) res[k] = prepareForSerialization(v[k]);
    return res;
  }
  return v;
}

const Handlers: Record<string, { serialize: (obj: any) => string, parse?: (text: string) => any }> = {
  json: {
    serialize: (obj) => JSON.stringify(prepareForSerialization(obj), null, 2),
    parse: (text) => JSON.parse(text)
  },
  json5: {
    serialize: (obj) => {
      if (typeof JSON5 === 'undefined') return "Error: JSON5 not loaded";
      return JSON5.stringify(prepareForSerialization(obj), null, 2);
    },
    parse: (text) => JSON5.parse(text)
  },
  yaml: {
    serialize: (obj) => {
      if (typeof jsyaml === 'undefined') return "Error: js-yaml not loaded";
      return jsyaml.dump(prepareForSerialization(obj), { indent: 2, lineWidth: -1 });
    },
    parse: (text) => jsyaml.load(text)
  },
  toml: {
    serialize: (obj) => {
      if (typeof toml === 'undefined') return "Error: toml not loaded";
      try {
        return toml.stringify(prepareForSerialization(obj));
      } catch (e: any) {
        // fallback for objects that might fail due to nesting rules or other TOML constraints
        return `# Error: ${e.message}\n` + JSON.stringify(prepareForSerialization(obj), null, 2);
      }
    },
    parse: (text) => toml.parse(text)
  },
  xml: {
    serialize: (obj) => {
      if (typeof fxp === 'undefined') return "Error: fast-xml-parser not loaded";
      const builder = new fxp.XMLBuilder({ format: true, ignoreAttributes: false });
      return builder.build({ root: prepareForSerialization(obj) });
    },
    parse: (text) => {
      if (typeof fxp === 'undefined') return "Error: fast-xml-parser not loaded";
      const parser = new fxp.XMLParser();
      const res = parser.parse(text);
      return res.root || res;
    }
  },
  minified: {
    serialize: (obj) => stringify(obj, null),
    parse: (text) => {
      const lexer = new DSFLexer(text);
      const parser = new DSFParser(lexer.tokens);
      return parser.parse();
    }
  },
  msgpack: {
    serialize: (obj) => {
      if (typeof msgpack === 'undefined') return "Error: msgpack-lite not loaded";
      const buffer = msgpack.encode(prepareForSerialization(obj));
      return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    }
    // Bidirectional for binary is complex in a text area, keeping one-way for now as per plan
  },
  cbor: {
    serialize: (obj) => {
      if (typeof CBOR === 'undefined') return "Error: cbor-js not loaded";
      const buffer = CBOR.encode(prepareForSerialization(obj));
      // CBOR.encode returns an ArrayBuffer or similar
      return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    }
  }
};

function updateOutput() {
  const dsfText = dsfInput.value;
  const targetFormatId = formatSelect.value;
  const formatInfo = FORMATS.find(f => f.id === targetFormatId)!;

  try {
    const lexer = new DSFLexer(dsfText);
    const parser = new DSFParser(lexer.tokens);
    const parsed = parser.parse();

    outputView.classList.remove('error');

    const handler = Handlers[targetFormatId];
    const outputText = handler ? handler.serialize(parsed) : "Unsupported format";

    outputView.value = outputText;
    outputExt.textContent = formatInfo.ext;

    updateStats(dsfText, outputText, formatInfo.name);

  } catch (e: any) {
    outputView.classList.add('error');
  }
}

function updateFromOutput() {
  const outputText = outputView.value;
  const targetFormatId = formatSelect.value;
  const formatInfo = FORMATS.find(f => f.id === targetFormatId)!;

  if (!formatInfo.bidirectional) return;

  try {
    const handler = Handlers[targetFormatId];
    if (!handler || !handler.parse) return;

    const parsed = handler.parse(outputText);
    const dsfText = stringify(parsed, '  ');

    dsfInput.classList.remove('error');
    dsfInput.value = dsfText;

    updateStats(dsfText, outputText, formatInfo.name);
  } catch (e: any) {
    dsfInput.classList.add('error');
  }
}

let isUpdating = false;

dsfInput.addEventListener('input', () => {
  if (isUpdating) return;
  isUpdating = true;
  updateOutput();
  isUpdating = false;
});

outputView.addEventListener('input', () => {
  if (isUpdating) return;
  if (!FORMATS.find(f => f.id === formatSelect.value)?.bidirectional) return;
  isUpdating = true;
  updateFromOutput();
  isUpdating = false;
});

sampleSelect.addEventListener('change', () => {
  const sampleName = sampleSelect.value as keyof typeof SAMPLES;
  dsfInput.value = SAMPLES[sampleName];
  updateOutput();
});

formatSelect.addEventListener('change', () => {
  const formatInfo = FORMATS.find(f => f.id === formatSelect.value)!;
  outputView.readOnly = !formatInfo.bidirectional;
  updateOutput();
});

formatBtn.addEventListener('click', () => {
  try {
    const formatted = format(dsfInput.value);
    dsfInput.value = formatted;
    updateOutput();
  } catch (e) {
    alert("Cannot format invalid DSF code");
  }
});

// Initial run
updateOutput();
