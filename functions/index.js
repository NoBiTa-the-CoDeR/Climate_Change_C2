const { onRequest } = require('firebase-functions/v2/https');

function json(res, status, body) {
  res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(body));
}

async function readJson(req) {
  if (typeof req.body === 'object' && req.body) return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

async function geminiResearch({ query, system }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing GEMINI_API_KEY');
  const prompt = `${system}\n\nBuild a single JSON object for this climate/environment query: ${query}\n\nRequired keys: overview string, confidence_note string, pros array max 5, cons array max 5, alternatives array of objects {name,description}, health_risks array of objects {name,description}, verdict string, rating integer 1-10, sources array of objects {title,url,publisher,why}. Return JSON only.`;
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    })
  });
  if (!response.ok) {
    throw new Error(`Gemini failed with ${response.status}`);
  }
  const data = await response.json();
  const text = (data.candidates || [])
    .flatMap(candidate => candidate.content?.parts || [])
    .map(part => part.text || '')
    .join('\n');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in Gemini response');
  return JSON.parse(text.slice(start, end + 1));
}

async function anthropicResearch({ query, system }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Missing ANTHROPIC_API_KEY');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1800,
      system,
      messages: [{
        role: 'user',
        content: `Build a single JSON object for this climate/environment query: ${query}. Required keys: overview string, confidence_note string, pros array max 5, cons array max 5, alternatives array of objects {name,description}, health_risks array of objects {name,description}, verdict string, rating integer 1-10, sources array of objects {title,url,publisher,why}. Return JSON only.`
      }]
    })
  });
  if (!response.ok) {
    throw new Error(`Anthropic failed with ${response.status}`);
  }
  const data = await response.json();
  const text = (data.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in Anthropic response');
  return JSON.parse(text.slice(start, end + 1));
}

async function geocode(query) {
  const locationIqKey = process.env.LOCATIONIQ_KEY;
  const openCageKey = process.env.OPENCAGE_KEY;
  const providers = [];

  if (locationIqKey) {
    providers.push(async () => {
      const res = await fetch(`https://us1.locationiq.com/v1/search?key=${encodeURIComponent(locationIqKey)}&q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`);
      if (!res.ok) throw new Error(`LocationIQ ${res.status}`);
      const data = await res.json();
      return data[0] || null;
    });
  }

  if (openCageKey) {
    providers.push(async () => {
      const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${encodeURIComponent(openCageKey)}&limit=5&no_annotations=1`);
      if (!res.ok) throw new Error(`OpenCage ${res.status}`);
      const data = await res.json();
      const hit = data.results?.[0];
      if (!hit) return null;
      return {
        name: hit.components?.city || hit.components?.town || hit.components?.village || hit.formatted,
        country: hit.components?.country || '',
        state: hit.components?.state || '',
        lat: hit.geometry?.lat,
        lon: hit.geometry?.lng,
        formatted: hit.formatted
      };
    });
  }

  providers.push(async () => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'ClimateChangeC2/1.0' }
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    return data[0] || null;
  });

  let lastError;
  for (const provider of providers) {
    try {
      const place = await provider();
      if (place) return place;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No geocoder returned a result');
}

exports.api = onRequest({ cors: true, timeoutSeconds: 60 }, async (req, res) => {
  try {
    const path = req.path.replace(/^\/+/, '');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (path === 'research' && req.method === 'POST') {
      const body = await readJson(req);
      const payload = {
        query: String(body.query || '').trim(),
        system: String(body.system || '').trim()
      };
      if (!payload.query) {
        json(res, 400, { error: 'Missing query' });
        return;
      }

      const result = process.env.GEMINI_API_KEY
        ? await geminiResearch(payload)
        : await anthropicResearch(payload);

      json(res, 200, result);
      return;
    }

    if (path === 'geocode' && req.method === 'GET') {
      const query = String(req.query.q || '').trim();
      if (!query) {
        json(res, 400, { error: 'Missing q parameter' });
        return;
      }
      const place = await geocode(query);
      json(res, 200, { place });
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    json(res, 500, { error: error.message || 'Server error' });
  }
});
