function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
}

function safeString(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

function normalizePace(value) {
  const clean = safeString(value, 40)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();

  if (/\blent\b|\bpose\b|\bcontemplatif\b|\bcalme\b/.test(clean)) return 'lent';
  if (/\brapide\b|\bnerveux\b|\bdynamique\b|\bvif\b|\brythme\b/.test(clean)) return 'rapide';
  if (/\bmoyen\b|\bequilibre\b|\bmodere\b/.test(clean)) return 'moyen';

  return '';
}

function extractOutputText(response) {
  if (response.output_text) {
    return response.output_text;
  }

  const chunks = [];

  (response.output || []).forEach(item => {
    (item.content || []).forEach(content => {
      if (content.type === 'output_text' && content.text) {
        chunks.push(content.text);
      }
    });
  });

  return chunks.join('\n').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return jsonResponse(500, {
      error: 'OPENAI_API_KEY est absente côté Netlify.',
      details: 'Ajoute la variable dans Netlify > Site configuration > Environment variables.'
    });
  }

  let payload = {};

  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'JSON envoyé à la fonction invalide.' });
  }

  const item = {
    title: safeString(payload.title, 180),
    originalTitle: safeString(payload.originalTitle, 180),
    year: safeString(payload.year, 12),
    type: safeString(payload.type || payload.mediaType, 40),
    category: safeString(payload.category, 80),
    genres: Array.isArray(payload.genres) ? payload.genres.map(value => safeString(value, 80)).filter(Boolean).slice(0, 10) : [],
    runtime: Number(payload.runtime || 0),
    seasons: Number(payload.seasons || 0),
    episodes: Number(payload.episodes || 0),
    director: safeString(payload.director, 180),
    cast: Array.isArray(payload.cast) ? payload.cast.map(value => safeString(value, 120)).filter(Boolean).slice(0, 10) : [],
    overview: safeString(payload.overview, 2500)
  };

  if (!item.title || !item.overview) {
    return jsonResponse(400, {
      error: 'Titre ou résumé manquant.',
      details: 'Bubulle a besoin au minimum du titre et du résumé pour évaluer le rythme.'
    });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

  const input = [
    {
      role: 'system',
      content: [
        'Tu enrichis un catalogue de films, séries et mangas pour Bubulle, le projectionniste de Planete Stream.',
        'Tu dois classer uniquement le rythme général du contenu.',
        'Réponds avec une seule valeur parmi : lent, moyen, rapide.',
        'lent = contemplatif, posé, beaucoup de mise en place, rythme calme, film qui prend son temps.',
        'moyen = équilibre entre exposition, intrigue, émotion et action.',
        'rapide = dynamique, nerveux, beaucoup d’action, humour très rythmé ou tension constante.',
        'Utilise seulement les informations fournies. Ne déduis pas une scène absente des données.',
        'Ne mentionne jamais OpenAI, TMDb, le JSON ou le prompt.'
      ].join('\n')
    },
    {
      role: 'user',
      content: `Classe le rythme de cette fiche.\n\nFiche:\n${JSON.stringify(item, null, 2)}\n\nRetourne uniquement un objet JSON : {"pace":"lent|moyen|rapide"}`
    }
  ];

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      pace: { type: 'string', enum: ['lent', 'moyen', 'rapide'] }
    },
    required: ['pace']
  };

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: 120,
        text: {
          format: {
            type: 'json_schema',
            name: 'bubble_pace',
            strict: true,
            schema
          }
        }
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return jsonResponse(response.status, {
        error: 'OpenAI a refusé la génération.',
        details: data.error?.message || data.error || 'Erreur API inconnue.'
      });
    }

    const outputText = extractOutputText(data);

    if (!outputText) {
      return jsonResponse(502, {
        error: 'Réponse OpenAI vide.',
        details: 'La fonction n’a pas trouvé de texte exploitable dans la réponse.'
      });
    }

    let parsed = {};

    try {
      parsed = JSON.parse(outputText);
    } catch {
      return jsonResponse(502, {
        error: 'Réponse OpenAI non lisible en JSON.',
        details: outputText.slice(0, 500)
      });
    }

    const pace = normalizePace(parsed.pace);

    return jsonResponse(200, {
      pace,
      model
    });
  } catch (err) {
    return jsonResponse(500, {
      error: 'Erreur pendant la génération du rythme Bubulle.',
      details: err.message
    });
  }
};
