const PROFILE_LEVELS = ['faible', 'moyen', 'eleve'];
const PACE_VALUES = ['lent', 'moyen', 'rapide'];

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

function normalizeText(value) {
  return safeString(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizePace(value) {
  const clean = normalizeText(value);

  if (/\blent\b|\bpose\b|\bcontemplatif\b|\bcalme\b/.test(clean)) return 'lent';
  if (/\brapide\b|\bnerveux\b|\bdynamique\b|\bvif\b|\bsoutenu\b/.test(clean)) return 'rapide';
  if (/\bmoyen\b|\bequilibre\b|\bmodere\b/.test(clean)) return 'moyen';

  return 'moyen';
}

function normalizeLevel(value) {
  const clean = normalizeText(value);

  if (/\beleve\b|\bfort\b|\bforte\b|\bhaut\b|\bhaute\b|\bimportant\b|\bimportante\b/.test(clean)) return 'eleve';
  if (/\bfaible\b|\bbas\b|\bbasse\b|\bleger\b|\blegere\b|\bminime\b/.test(clean)) return 'faible';
  if (/\bmoyen\b|\bmoyenne\b|\bmodere\b|\bmoderee\b|\bequilibre\b/.test(clean)) return 'moyen';

  return 'moyen';
}

function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;

  const clean = normalizeText(value);

  if (/\btrue\b|\boui\b|\byes\b|\badapte\b|\bfamille\b|\bfamilial\b/.test(clean)) return true;
  if (/\bfalse\b|\bnon\b|\bno\b|\bpas\b/.test(clean)) return false;

  return false;
}

function normalizeProfile(value = {}) {
  return {
    pace: PACE_VALUES.includes(value.pace) ? value.pace : normalizePace(value.pace),
    complexity: PROFILE_LEVELS.includes(value.complexity) ? value.complexity : normalizeLevel(value.complexity),
    humour: PROFILE_LEVELS.includes(value.humour) ? value.humour : normalizeLevel(value.humour),
    violence: PROFILE_LEVELS.includes(value.violence) ? value.violence : normalizeLevel(value.violence),
    spectacle: PROFILE_LEVELS.includes(value.spectacle) ? value.spectacle : normalizeLevel(value.spectacle),
    emotion: PROFILE_LEVELS.includes(value.emotion) ? value.emotion : normalizeLevel(value.emotion),
    family: normalizeBoolean(value.family)
  };
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
      details: 'Bubulle a besoin au minimum du titre et du résumé pour générer le profil.'
    });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

  const input = [
    {
      role: 'system',
      content: [
        'Tu enrichis un catalogue de films, séries et mangas pour Bubulle, le projectionniste de Planete Stream.',
        'Tu dois produire un profil structuré, sobre et fiable.',
        'Utilise uniquement les informations fournies : titre, genres, durée, casting, réalisation et résumé.',
        'N’invente jamais une scène, une qualité ou un niveau qui ne se déduit pas clairement des données.',
        'Réponds uniquement avec les valeurs autorisées par le schéma.',
        'pace = rythme général : lent, moyen ou rapide.',
        'complexity = niveau d’attention demandé : faible, moyen ou eleve.',
        'humour = place de l’humour : faible, moyen ou eleve.',
        'violence = violence, peur, tension ou dureté globale : faible, moyen ou eleve.',
        'spectacle = ampleur visuelle, action, aventure, grand format : faible, moyen ou eleve.',
        'emotion = enjeu humain, relationnel ou émotionnel : faible, moyen ou eleve.',
        'family = true seulement si le contenu semble adapté à une séance familiale ou enfants.',
        'Sois prudent : horreur, thriller sombre, drame dur ou violence marquée => family false.',
        'Ne mentionne jamais OpenAI, TMDb, le JSON ou le prompt.'
      ].join('\n')
    },
    {
      role: 'user',
      content: `Génère le profil Bubulle pour cette fiche.\n\nFiche:\n${JSON.stringify(item, null, 2)}\n\nRetourne uniquement un objet JSON avec : pace, complexity, humour, violence, spectacle, emotion, family.`
    }
  ];

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      pace: { type: 'string', enum: PACE_VALUES },
      complexity: { type: 'string', enum: PROFILE_LEVELS },
      humour: { type: 'string', enum: PROFILE_LEVELS },
      violence: { type: 'string', enum: PROFILE_LEVELS },
      spectacle: { type: 'string', enum: PROFILE_LEVELS },
      emotion: { type: 'string', enum: PROFILE_LEVELS },
      family: { type: 'boolean' }
    },
    required: ['pace', 'complexity', 'humour', 'violence', 'spectacle', 'emotion', 'family']
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
        max_output_tokens: 220,
        text: {
          format: {
            type: 'json_schema',
            name: 'bubble_profile',
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

    const profile = normalizeProfile(parsed);

    return jsonResponse(200, {
      profile,
      // Compatibilité avec le patch étape 2 actuel : si l’admin attend encore data.pace, il le trouve.
      pace: profile.pace,
      model
    });
  } catch (err) {
    return jsonResponse(500, {
      error: 'Erreur pendant la génération du profil Bubulle.',
      details: err.message
    });
  }
};
