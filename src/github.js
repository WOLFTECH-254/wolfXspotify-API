const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || 'tokens.json';
const LOCAL_PATH = path.join(__dirname, '..', 'tokens.json');

function buildPayload(token) {
  return {
    tokens: [
      {
        access_token: token,
        generated_at: new Date().toISOString(),
        expires_in: 3600,
        source: 'totp',
      },
    ],
    last_updated: new Date().toISOString(),
    source: 'wolf-tech-spotify-api',
  };
}

async function commitToken(token) {
  const payload = buildPayload(token);
  const content = JSON.stringify(payload, null, 2);

  fs.writeFileSync(LOCAL_PATH, content, 'utf8');

  if (!GITHUB_TOKEN || !GITHUB_REPO) return;

  try {
    const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'wolfXspotify-API',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    let sha;
    const get = await fetch(apiBase, { headers });
    if (get.ok) {
      const data = await get.json();
      sha = data.sha;
    }

    const body = {
      message: `chore: refresh spotify token [${new Date().toISOString()}]`,
      content: Buffer.from(content).toString('base64'),
      ...(sha ? { sha } : {}),
    };

    const put = await fetch(apiBase, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!put.ok) {
      const err = await put.text();
      console.error('[github] commit failed:', err);
    }
  } catch (err) {
    console.error('[github] error:', err.message);
  }
}

module.exports = { commitToken };
