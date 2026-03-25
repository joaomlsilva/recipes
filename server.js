/**
 * Recipe App – Local Development Server
 *
 * - Serves static files from the project root
 * - POST /api/recipes  → writes a new JSON file to recipes/ and updates index.json
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT        = 3000;
const ROOT        = __dirname;
const RECIPES_DIR = path.join(ROOT, 'recipes');
const INDEX_FILE  = path.join(RECIPES_DIR, 'index.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css; charset=utf-8',
  '.js'  : 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.ico' : 'image/x-icon',
};

// Convert a recipe title to a URL-friendly filename slug
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accent marks
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '');          // trim leading/trailing hyphens
}

// Serve a static file, or 404
function serveStatic(res, filePath) {
  // Prevent path traversal: resolved path must stay inside ROOT
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(resolved);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// Collect the full request body as a string
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// POST /api/recipes – create a new recipe file and update index.json
async function handleCreateRecipe(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read request body' }));
    return;
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  // Basic validation
  if (!data.title || !data.mealType ||
      !Array.isArray(data.ingredients) || !Array.isArray(data.steps)) {
    res.writeHead(422, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing required fields: title, mealType, ingredients, steps' }));
    return;
  }

  try {
    // Read current index
    const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));

    // Determine next numeric ID from existing filenames
    let maxId = 0;
    index.forEach(filename => {
      const match = filename.match(/^(\d+)-/);
      if (match) maxId = Math.max(maxId, parseInt(match[1], 10));
    });
    const nextId = maxId + 1;

    // Build filename and ensure it doesn't already exist
    const slug     = slugify(data.title) || `recipe-${nextId}`;
    const filename = `${nextId}-${slug}.json`;
    const filePath = path.join(RECIPES_DIR, filename);

    if (fs.existsSync(filePath)) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `File already exists: ${filename}` }));
      return;
    }

    // Build the recipe object (numeric id, no "source" field for file-backed recipes)
    const recipe = {
      id:          nextId,
      title:       String(data.title).trim(),
      mealType:    String(data.mealType).trim(),
      serves:      data.serves != null ? Number(data.serves) : null,
      difficulty:  data.difficulty ? String(data.difficulty).trim() : 'Unknown',
      image:       data.image ? String(data.image).trim() : '',
      origin:      data.origin ? String(data.origin).trim() : '',
      ingredients: data.ingredients.map(ing => ({
        amount: String(ing.amount || '').trim(),
        item:   String(ing.item   || '').trim(),
      })),
      steps: data.steps.map(s => String(s).trim()),
    };

    // Write recipe file
    fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2) + '\n', 'utf8');

    // Update index.json
    index.push(filename);
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + '\n', 'utf8');

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(recipe));
  } catch (err) {
    console.error('Error creating recipe:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// ─── Main request handler ─────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { method, url: reqUrl } = req;

  // POST /api/recipes
  if (method === 'POST' && reqUrl === '/api/recipes') {
    await handleCreateRecipe(req, res);
    return;
  }

  // Static file serving (GET only)
  if (method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  // Map / to index.html; strip query strings
  const urlPath  = reqUrl.split('?')[0];
  const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Recipe server running → http://localhost:${PORT}`);
});
