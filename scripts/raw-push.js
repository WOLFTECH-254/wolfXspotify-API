require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.GITHUB_TOKEN;
const REPO  = process.env.GITHUB_REPO;
const ROOT  = path.join(__dirname, "..");

const FILES = [
  "package.json",
  "src/index.js",
  "src/totp.js",
  "src/token-manager.js",
  "src/github.js",
  "src/response.js",
  "src/crypto.js",
  "src/rate-limit-state.js",
  "src/spotify-graphql.js",
  "src/routes/search.js",
  "src/routes/track.js",
  "src/routes/album.js",
  "src/routes/playlist.js",
  "src/routes/artist.js",
];

async function getSha(fp) {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${fp}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "casper-raw-push" },
    });
    if (r.ok) return (await r.json()).sha;
  } catch {}
  return null;
}

async function pushFile(fp, content) {
  const sha = await getSha(fp);
  const encoded = Buffer.from(content).toString("base64");
  const body = { message: `update: ${fp}`, content: encoded, ...(sha ? { sha } : {}) };
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${fp}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "casper-raw-push" },
    body: JSON.stringify(body),
  });
  console.log(`${fp} → HTTP ${r.status}`);
}

(async () => {
  for (const file of FILES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) { console.log(`SKIP: ${file}`); continue; }
    await pushFile(file, fs.readFileSync(full, "utf8"));
  }
  console.log("Done.");
})();
