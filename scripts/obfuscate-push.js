require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH_PREFIX = '';

const FILES = [
  'src/index.js',
  'src/totp.js',
  'src/token-manager.js',
  'src/github.js',
  'src/response.js',
  'src/crypto.js',
  'src/routes/search.js',
  'src/routes/track.js',
  'src/routes/album.js',
  'src/routes/playlist.js',
  'src/routes/artist.js',
  'scripts/refresh.js',
];

const OBFUSCATE_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
};

async function getFileSha(filePath) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'casper-tech-sportify-api' },
    });
    if (res.ok) return (await res.json()).sha;
  } catch {}
  return null;
}

async function pushFile(filePath, content) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return;
  const sha = await getFileSha(filePath);
  const encoded = Buffer.from(content).toString('base64');
  const body = { message: `obfuscate: ${filePath}`, content: encoded, ...(sha ? { sha } : {}) };
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'casper-tech-sportify-api' },
      body: JSON.stringify(body),
    });
    const code = res.status;
    console.log(`${filePath} → HTTP ${code}`);
  } catch {}
}

(async () => {
  const root = path.join(__dirname, '..');
  for (const file of FILES) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) { console.log(`SKIP (not found): ${file}`); continue; }
    const source = fs.readFileSync(fullPath, 'utf8');
    const obfuscated = JavaScriptObfuscator.obfuscate(source, OBFUSCATE_OPTIONS).getObfuscatedCode();
    await pushFile(file, obfuscated);
  }
  console.log('Done.');
})();
