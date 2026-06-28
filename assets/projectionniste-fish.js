(function () {
  // ======================================
// MODE DEBUG BUBULLE
// false = désactivé
// true  = affiche le raisonnement dans la console
// ======================================
const FISH_DEBUG = false;

function fishDebug(...args) {
  if (FISH_DEBUG) {
    console.log("[🐠 Bubulle]", ...args);
  }
}
  const widget = document.querySelector('#psFishWidget');
  const tooltip = document.querySelector('#psFishTooltip');
  const poses = Array.from(document.querySelectorAll('.ps-fish-pose'));
  const chat = document.querySelector('#psFishChat');
  const chatClose = document.querySelector('#psFishChatClose');
  const form = document.querySelector('#psFishForm');
  const input = document.querySelector('#psFishInput');
  const messages = document.querySelector('#psFishMessages');
  const brainStatus = document.querySelector('#psBrainStatus');
  const suggestions = Array.from(document.querySelectorAll('[data-ps-fish-suggestion]'));

/* =========================================================
   PATCH POISSON - NORMALISATION GENRES / MOTS-CLES
   Objectif : éviter les faux positifs du type "Resurrections"
   quand on demande un film de zombie.
   ========================================================= */

const FISH_GENRE_SYNONYMS = {
  zombie: [
    'zombie',
    'zombies',
    'mort vivant',
    'morts vivants',
    'mort-vivant',
    'morts-vivants',
    'undead',
    'living dead',
    'infecte',
    'infectes',
    'infecté',
    'infectés',
    'mangeur de chair',
    'mangeurs de chair',
    'mangeuse de chair',
    'mangeuses de chair'
  ],

  horreur: [
    'horreur',
    'épouvante',
    'epouvante',
    'horror',
    'film d horreur',
    'film de peur'
  ],

 science_fiction: [
  'science fiction',
  'science-fiction',
  'sciencefiction',
  'sci fi',
  'sci-fi',
  'sf',
  's f',
  'science fic',
  'science ficton',
  'science fiction adventure',
  'sci fi fantasy',
  'anticipation'
],

  comedie: [
    'comedie',
    'comédie',
    'humour',
    'humor',
    'comedy',
    'film drole',
    'film drôle'
  ],

  drame: [
    'drame',
    'dramatique',
    'drama'
  ],

  action: ['action'],
  aventure: ['aventure', 'adventure'],
  thriller: ['thriller', 'suspense'],
  fantastique: ['fantastique', 'fantasy'],
  animation: ['animation', 'anime', 'dessin anime', 'dessin animé'],
  romance: ['romance', 'romantique'],
  guerre: ['guerre', 'war'],
  crime: ['crime', 'policier', 'polar'],
  western: ['western'],
  documentaire: ['documentaire', 'docu', 'documentary']
};

const FISH_GENRE_LABELS = {
  zombie: 'zombie',
  horreur: 'd’horreur',
  science_fiction: 'de science-fiction',
  comedie: 'de comédie',
  drame: 'dramatique',
  action: 'd’action',
  aventure: 'd’aventure',
  thriller: 'thriller',
  fantastique: 'fantastique',
  animation: 'd’animation',
  romance: 'romantique',
  guerre: 'de guerre',
  crime: 'policier',
  western: 'western',
  documentaire: 'documentaire'
};


/*
  Traducteur de genres TMDb.
  Les films, séries et mangas n'utilisent pas toujours les mêmes libellés.
  Exemple : "Action" côté films, "Action & Adventure" côté séries/mangas.
*/
const FISH_GENRE_TMDB_EQUIVALENTS = {
  zombie: ['zombie', 'zombies'],
  horreur: ['horreur', 'epouvante', 'épouvante', 'horror'],
  science_fiction: [
    'science fiction',
    'science-fiction',
    'science fiction fantastique',
    'science-fiction fantastique',
    'science fiction and fantasy',
    'sci fi fantasy',
    'sci-fi fantasy'
  ],
  comedie: ['comedie', 'comédie', 'comedy'],
  drame: ['drame', 'drama'],
  action: ['action', 'action adventure', 'action & adventure'],
  aventure: ['aventure', 'adventure', 'action adventure', 'action & adventure'],
  thriller: ['thriller', 'suspense'],
  fantastique: [
    'fantastique',
    'fantasy',
    'science fiction fantastique',
    'science-fiction fantastique',
    'science fiction and fantasy',
    'sci fi fantasy',
    'sci-fi fantasy'
  ],
  animation: ['animation', 'anime', 'animé'],
  romance: ['romance', 'romantique'],
  guerre: ['guerre', 'war'],
  crime: ['crime', 'policier', 'polar'],
  western: ['western'],
  documentaire: ['documentaire', 'documentary', 'docu'],
  familial: ['familial', 'famille', 'family', 'kids']
};

function fishCanonicalGenreKey(value) {
  const wanted = fishNormalize(value);

  if (!wanted) return '';

  for (const [genreKey, variants] of Object.entries(FISH_GENRE_TMDB_EQUIVALENTS)) {
    const normalizedVariants = [genreKey, ...variants].map(fishNormalize);

    if (normalizedVariants.includes(wanted)) {
      return genreKey;
    }
  }

  return wanted.replace(/-/g, '_');
}

function fishGenreMatchesKey(recordGenre, genreKey) {
  const current = fishNormalize(recordGenre);
  const canonicalKey = fishCanonicalGenreKey(genreKey);
  const variants = FISH_GENRE_TMDB_EQUIVALENTS[canonicalKey] || [genreKey, canonicalKey];

  return variants.map(fishNormalize).some(variant => {
    if (!variant) return false;
    return current === variant;
  });
}

function fishRecordHasGenreKey(record, genreKey) {
  if (!record || !genreKey) return false;

  return (record.genres || []).some(genre => fishGenreMatchesKey(genre, genreKey));
}

/*
  Corrections connues sans toucher au JSON.
  Utile pour les sous-genres que TMDb ne range pas toujours proprement,
  comme "zombie".
*/
const FISH_FORCE_GENRES_BY_TITLE = {
  zombie: [
    'malnazidos',
    'world war z',
    'zombieland',
    'shaun of the dead',
    'army of the dead',
    'train to busan',
    'dernier train pour busan',
    '28 jours plus tard',
    '28 semaines plus tard'
  ]
};

function fishNormalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function fishEscapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fishHasPhrase(haystack, phrase) {
  const cleanHaystack = ` ${fishNormalize(haystack)} `;
  const cleanPhrase = fishNormalize(phrase);

  if (!cleanPhrase) return false;

  /*
    Cas spécial zombie :
    on accepte "zombie", "zombies", "zombieland",
    mais PAS "résurrection", "resurrections", etc.
  */
  if (cleanPhrase === 'zombie' || cleanPhrase === 'zombies') {
    return /(^|\s)zombies?[a-z0-9]*(\s|$)/.test(cleanHaystack);
  }

  const regex = new RegExp(`(^|\\s)${fishEscapeRegExp(cleanPhrase)}(\\s|$)`);
  return regex.test(cleanHaystack);
}

function fishToArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap(fishToArray);
  }

  if (typeof value === 'object') {
    return [
      value.name,
      value.title,
      value.label,
      value.value
    ].filter(Boolean).map(String);
  }

  return String(value)
    .split(/[;,|]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function fishMovieTitle(movie) {
   return movie.title ||
    movie.titre ||
    movie.name ||
    movie.originalTitle ||
    movie.original_title ||
    'Titre inconnu';
}

function fishDisplayTitle(movie) {

  const title = fishMovieTitle(movie);

  const aliases = {
    "Alien, le huitième passager": "Alien 1 : Le huitième passager",
    "Aliens, le retour": "Alien 2 : Le retour",
    "Alien³": "Alien 3",
    "Alien : Résurrection": "Alien 4 : Résurrection",

    "Dune: Première partie": "Dune 1",
    "Dune : Deuxième partie": "Dune 2",

    "Avatar": "Avatar 1",
    "Avatar : La Voie de l'eau": "Avatar 2",
    "Avatar : De feu et de cendres": "Avatar 3"
  };

  return aliases[title] || title;
}

function fishMovieTextForGenre(movie) {
  const parts = [
    movie.title,
    movie.titre,
    movie.name,
    movie.originalTitle,
    movie.original_title,
    movie.overview,
    movie.synopsis,
    movie.description,

    ...fishToArray(movie.genres),
    ...fishToArray(movie.genre),
    ...fishToArray(movie.keywords),
    ...fishToArray(movie.tags),
    ...fishToArray(movie.themes),
    ...fishToArray(movie.thematiques)
  ];

  return parts.filter(Boolean).join(' ');
}

function fishDetectRequestedGenre(message) {
  for (const [genreKey, aliases] of Object.entries(FISH_GENRE_SYNONYMS)) {
    if (aliases.some(alias => fishHasPhrase(message, alias))) {
      return genreKey;
    }
  }

  return null;
}

function fishMovieHasForcedGenre(movie, genreKey) {
  const forcedTitles = FISH_FORCE_GENRES_BY_TITLE[genreKey] || [];
  const title = fishNormalize(fishMovieTitle(movie));

  return forcedTitles.some(forcedTitle => {
    return title === fishNormalize(forcedTitle);
  });
}

function fishMovieMatchesRequestedGenre(movie, genreKey) {
  if (!movie || !genreKey) return false;

  if (fishMovieHasForcedGenre(movie, genreKey)) {
    return true;
  }

  const aliases = FISH_GENRE_SYNONYMS[genreKey] || [];
  const movieText = fishMovieTextForGenre(movie);

  return aliases.some(alias => fishHasPhrase(movieText, alias));
}
function fishFormatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m} min`;
}

function fishDetectDurationFilter(message) {
  const m = fishNormalize(message);

  const lessHour = /(moins(?: de| d)?|maximum|max|pas plus de|sous|inferieur a)\s*(\d+)\s*h\s*(\d{1,2})?/.exec(m);

  if (lessHour) {
    const hours = Number(lessHour[2]) || 0;
    const minutes = Number(lessHour[3]) || 0;
    const max = hours * 60 + minutes;

    return {
      max,
      label: `de moins de ${fishFormatDuration(max)}`
    };
  }

  const lessSimple = /(moins(?: de| d)?|maximum|max|pas plus de|sous|inferieur a)\s*(\d+)\s*(h|heure|heures|min|minute|minutes)?/.exec(m);

  if (lessSimple) {
    const value = Number(lessSimple[2]) || 0;
    const unit = lessSimple[3] || 'h';
    const max = unit.includes('min') ? value : value * 60;

    return {
      max,
      label: `de moins de ${fishFormatDuration(max)}`
    };
  }

  if (/court|rapide|pas trop long/.test(m)) {
    return {
      max: 110,
      label: 'pas trop long'
    };
  }

  const moreSimple = /(plus(?: de| d)?|au moins|minimum|min)\s*(\d+)\s*(h|heure|heures|min|minute|minutes)?/.exec(m);

  if (moreSimple) {
    const value = Number(moreSimple[2]) || 0;
    const unit = moreSimple[3] || 'h';
    const min = unit.includes('min') ? value : value * 60;

    return {
      min,
      label: `de plus de ${fishFormatDuration(min)}`
    };
  }

  const moreReversed = /(\d+)\s*(h|heure|heures|min|minute|minutes)\s*(au moins|minimum|min)/.exec(m);

  if (moreReversed) {
    const value = Number(moreReversed[1]) || 0;
    const unit = moreReversed[2] || 'h';
    const min = unit.includes('min') ? value : value * 60;

    return {
      min,
      label: `de plus de ${fishFormatDuration(min)}`
    };
  }

  return null;
}

function fishMovieMatchesDuration(movie, durationFilter) {
  if (!durationFilter) return true;

  const runtime = getRuntimeMinutes(movie);

  if (!runtime) return false;

  if (durationFilter.max && runtime > durationFilter.max) {
    return false;
  }

  if (durationFilter.min && runtime < durationFilter.min) {
    return false;
  }

  return true;
}

function fishCleanActorQuery(query) {
  return fishNormalize(query)
    .replace(/\b(de|d)?\s*(moins|maximum|max|pas plus de|sous|inferieur a|plus|au moins|minimum|min)\s*\d+\s*(h|heure|heures|min|minute|minutes)?\b/g, ' ')
    .replace(/\b\d+\s*(h|heure|heures|min|minute|minutes)\s*(au moins|minimum|min|maximum|max)?\b/g, ' ')
    .replace(/\b(film|films|serie|series|série|séries|manga|acteur|actrice|avec)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function fishExtractActorQuery(message) {
  const m = fishNormalize(message);
  const match = m.match(/\bavec\s+(.+)$/);

  if (!match || !match[1]) {
    return '';
  }

  return fishCleanActorQuery(match[1]);
}

function fishDisplayActorQuery(query) {
  const value = String(query || '').trim();

  if (!value) {
    return '';
  }

  return value
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function fishMovieMatchesActor(movie, actorQuery) {
  const query = fishNormalize(actorQuery);
  const tokens = query.split(' ').filter(Boolean);

  if (!query || !tokens.length) {
    return false;
  }

  return getCastNames(movie).some(name => {
    const actor = fishNormalize(name);

    return (
      actor === query ||
      actor.includes(query) ||
      tokens.every(token => actor.includes(token))
    );
  });
}

function fishDetectActorFilter(message, catalogue) {
  const m = fishNormalize(message);

  const hasActorIntent =
    !fishIsCompanionContext(message) && (
      /\bavec\b/.test(m) ||
      /\bacteur\b/.test(m) ||
      /\bactrice\b/.test(m) ||
      /\bcasting\b/.test(m) ||
      /\bjoue\b/.test(m) ||
      /\bjouent\b/.test(m)
    );

  if (!hasActorIntent) {
    return '';
  }

  const movies = Array.isArray(catalogue) ? catalogue : [];
  const wantsPremium = /premium|fauteuil rouge|selection premium|sélection premium/.test(fishNormalize(message));

  const actorNames = Array.from(
    new Set(
      movies
        .flatMap(movie => getCastNames(movie))
        .filter(Boolean)
    )
  ).sort((a, b) => b.length - a.length);

  const found = actorNames.find(name => {
    const actor = fishNormalize(name);
    const tokens = actor.split(' ').filter(Boolean);

    if (!actor || actor.length < 3) {
      return false;
    }

    if (fishHasPhrase(m, actor)) {
      return true;
    }

    if (tokens.length >= 2 && tokens.every(token => m.includes(token))) {
      return true;
    }

    return false;
  });

  return found || '';
}

function fishSortDurationAlternatives(movies, durationFilter) {
  const list = Array.isArray(movies) ? movies.filter(Boolean) : [];

  const withRuntime = list.filter(movie => {
    return fishMovieRuntimeForDisplay(movie) > 0;
  });

  if (!durationFilter) {
    return withRuntime;
  }

  if (durationFilter.max) {
    return withRuntime.sort((a, b) => {
      return fishMovieRuntimeForDisplay(a) - fishMovieRuntimeForDisplay(b);
    });
  }

  if (durationFilter.min) {
    return withRuntime.sort((a, b) => {
      return fishMovieRuntimeForDisplay(b) - fishMovieRuntimeForDisplay(a);
    });
  }

  return withRuntime;
}

function fishDurationFallbackAnswer(genreResults, label, durationFilter) {
  const alternatives = fishSortDurationAlternatives(genreResults, durationFilter).slice(0, 5);

  if (!alternatives.length) {
    return `J’ai trouvé des titres ${label}, mais aucune durée fiable dans le JSON. Le poisson refuse le chronomètre au doigt mouillé.`;
  }

  const intro = durationFilter.max
    ? `Je n’ai pas trouvé de film ${label} ${durationFilter.label}. Les plus proches côté durée sont :`
    : `Je n’ai pas trouvé de film ${label} ${durationFilter.label}. Les plus longs disponibles sont :`;

  const comment = durationFilter.max
    ? '\n\nCe n’est pas exactement la durée demandée, mais ce sont les options les plus courtes que le catalogue propose dans ce genre. Le poisson négocie avec le réel, pas avec Netflix.'
    : '\n\nCe n’est pas exactement la durée demandée, mais ce sont les options les plus longues disponibles dans ce genre. Prévois le plaid diplomatique.';

  return `${intro}\n${alternatives.map(fishMovieLine).join('\n')}${comment}`;
}

function fishDisplayLabel(value) {
  const label = String(value || '').trim();

  if (!label) return '';

  const specialLabels = {
    'science fiction': 'Science-fiction',
    'science-fiction': 'Science-fiction',
    'comedie': 'Comédie',
    'comédie': 'Comédie',
    'epouvante': 'Épouvante',
    'épouvante': 'Épouvante'
  };

  const normalized = fishNormalize(label);

  if (specialLabels[normalized]) {
    return specialLabels[normalized];
  }

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fishMovieGenresForDisplay(movie) {
  if (!movie) return [];

  const source = movie.item
    ? movie.genres || movie.item.genres || movie.item.genre
    : movie.genres || movie.genre;

  return Array.from(
    new Set(
      fishToArray(source)
        .map(fishDisplayLabel)
        .filter(Boolean)
    )
  );
}

function fishMovieRuntimeForDisplay(movie) {
  if (!movie) return 0;

  if (movie.runtime) {
    return Number(movie.runtime) || getRuntimeMinutes({ runtime: movie.runtime });
  }

  if (movie.item) {
    return getRuntimeMinutes(movie.item);
  }

  return getRuntimeMinutes(movie);
}

function fishMovieDetailsForDisplay(movie) {
  const details = [];
  const genres = fishMovieGenresForDisplay(movie).slice(0, 2);
  const runtime = fishMovieRuntimeForDisplay(movie);

  if (genres.length) {
    details.push(genres.join(', '));
  }

  if (runtime) {
    details.push(fishFormatDuration(runtime));
  }

  return details.length ? ` — ${details.join(' — ')}` : '';
}

function fishMovieLine(movie, index) {
 return `${index + 1}. ${fishDisplayTitle(movie)}${fishMovieDetailsForDisplay(movie)}`;
}


function fishPickText(list) {
  const values = Array.isArray(list) ? list.filter(Boolean) : [];

  if (!values.length) {
    return '';
  }

  return values[Math.floor(Math.random() * values.length)];
}


function fishShuffle(list) {
  const copy = Array.isArray(list) ? [...list] : [];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function fishDescribeMediaFromIntent(intent) {
  const type = intent && intent.requestedType ? normalize(intent.requestedType) : '';

  if (type === 'serie') return 'série';
  if (type === 'manga') return 'manga';
  if (type === 'film') return 'film';

  return 'titre';
}


function fishIsOpenAdvicePrompt(rawMessage) {
  const m = normalize(rawMessage);

  return (
    /^(qu est ce qu on regarde|qu est ce qu on regarde ici|on regarde quoi|on se met quoi|on lance quoi|on regarde quoi ce soir|on se fait quoi|tu proposes quoi|tu me proposes quoi|tu conseilles quoi|tu me conseilles quoi|que me conseilles tu|que me conseilles tu ce soir|t as quoi|t as quoi en stock|tu as quoi en stock|qu est ce que t as|qu est ce que tu as|il y a quoi de bien|y a quoi de bien|il y a quoi a voir|y a quoi a voir|une idee|donne moi une idee|trouve moi quelque chose|sors moi un truc|sors une bobine|fais moi une proposition|balance un film|balance une serie|balance un manga|balance quelque chose|envoie quelque chose|vas y choisis|choisis pour moi|comme tu veux|debrouille toi|je sais pas|je ne sais pas|j en sais rien|aucune idee|aucune idee en tete|peu importe|surprends moi|surprend moi|impressionne moi|etonne moi|fais moi rever|fais chauffer le projecteur)\??$/.test(m)
  );
}

function fishOpenAdviceAnswer() {
  return fishPickText([
    "🐠 D’accord, on ouvre le bocal. Tu veux plutôt un film, une série ou un manga ?",
    "Je peux choisir, mais donne-moi juste une petite nageoire de contexte : film, série ou manga ?",
    "Le projecteur est prêt. Tu préfères que je parte sur un film, une série, un manga... ou je te surprends vraiment ?",
    "Je peux te proposer quelque chose. Donne-moi juste le rayon : film, série ou manga.",
    "Très bien, je prends la barre du canapé. Tu veux une bobine courte, un truc drôle, de l’action, ou je pioche au hasard ?",
    "Je peux faire simple : film, série ou manga ? Ensuite je fouille le JSON sans faire tomber les bobines.",
    "Si tu veux, je peux choisir totalement au hasard. Sinon, donne-moi juste une humeur : rire, frissonner, réfléchir, voyager.",
    "Le bocal demande une micro-consigne : film, série, manga, ou mode surprise ?",
    "Je peux m’en charger. Tu veux une valeur sûre, un truc léger, ou une vraie surprise sortie du fond du bocal ?",
    "On peut partir au feeling. Dis-moi juste : ce soir tu veux te détendre, te faire peur, rire, ou voir du grand spectacle ?"
  ]);
}


function fishResolveOpenAdviceFollowUp(rawMessage) {
  const m = normalize(rawMessage);

  if (!m) return '';

  if (/^(film|films|un film|balance un film|une bobine)$/.test(m)) {
    return 'un film au hasard';
  }

  if (/^(serie|series|série|séries|une serie|une série|balance une serie|balance une série)$/.test(m)) {
    return 'une série au hasard';
  }

  if (/^(manga|mangas|anime|animé|un manga|un anime|un animé|balance un manga)$/.test(m)) {
    return 'un manga au hasard';
  }

  if (/^(rire|rigoler|drole|drôle|humour|comedie|comédie|marrant|fun|me faire rire)$/.test(m)) {
    return 'un film drôle';
  }

  if (/^(frissonner|frisson|frissons|peur|horreur|faire peur|me faire peur|sursauter|flipper)$/.test(m)) {
    return 'un film qui fait peur';
  }

  if (/^(reflechir|réfléchir|reflexion|réflexion|intelligent|cerveau|prise de tete|prise de tête|scenario tordu|scénario tordu)$/.test(m)) {
    return 'un film intelligent';
  }

  if (/^(leger|léger|chill|detente|détente|simple|tranquille|sans prise de tete|sans prise de tête|poser le cerveau)$/.test(m)) {
    return 'un film léger sans prise de tête';
  }

  if (/^(action|aventure|sf|science fiction|science-fiction|thriller|romance|drame|fantastique|animation)$/.test(m)) {
    return `un film ${rawMessage}`;
  }

  if (/^(surprise|au hasard|hasard|surprends moi|surprend moi|choisis|comme tu veux|peu importe)$/.test(m)) {
    return 'surprends moi';
  }

  if (/^(voyager|voyage|evasion|évasion|ailleurs|grand spectacle|spectacle|du lourd|epique|épique)$/.test(m)) {
    return 'un film grand spectacle pour voyager';
  }

  return '';
}

function fishRandomIntro(intent, results) {
  const count = Array.isArray(results) ? results.length : 0;
  const media = fishDescribeMediaFromIntent(intent);
  const plural = media === 'série' ? 'séries' : media === 'manga' ? 'mangas' : media === 'film' ? 'films' : 'titres';

  const intros = {
    default: [
      "J’ai fouillé les étagères du bocal et voici ce qui remonte :",
      "Le projecteur a arrêté de tousser, j’ai trouvé ceci :",
      "Après inspection des bobines, je te propose :",
      "J’ai passé le catalogue au tamis à nageoires, verdict :",
      "Le catalogue a répondu présent avec ces titres :",
      "J’ai quelques candidats sérieux pour ta séance :",
      "Voilà ce qui colle le mieux à ta demande :",
      "Le bocal a parlé, et pour une fois il articule :",
      "Je t’ai sorti les meilleurs candidats du catalogue :",
      "J’ai vérifié sans inventer de sardine, voici le résultat :",
      "Les bobines les plus pertinentes sont celles-ci :",
      "Le projecteur pointe plutôt vers ça :",
      "Je garde le hasard en laisse, voici les correspondances fiables :",
      "J’ai plongé dans le JSON et je suis remonté avec ça :",
      "Voici la petite pêche du catalogue :"
    ],

    single: [
      "J’ai trouvé un candidat qui ressort nettement :",
      "Une bobine se détache très clairement :",
      "Le catalogue ne m’en sort qu’un vraiment solide :",
      "Un seul titre nage devant les autres :",
      "Je ne vais pas gonfler la liste au chalumeau, le meilleur résultat est :"
    ],

    actor: [
      "J’ai recoupé le casting et voici ce que je trouve :",
      "Son nom apparaît dans ces bobines :",
      "Le catalogue l’a repéré au casting de :",
      "J’ai suivi la piste de l’acteur, elle mène ici :",
      "Côté casting, le poisson coche ces titres :",
      "La nageoire sur le générique, je trouve :",
      "J’ai vérifié les noms dans le JSON, pas de doublure en mousse :"
    ],

    director: [
      "J’ai suivi la piste du réalisateur, elle mène ici :",
      "Côté réalisation, le catalogue indique :",
      "J’ai fouillé les crédits, voici les titres associés :",
      "Le clap de réalisation pointe vers :",
      "Le JSON sort sa petite casquette de metteur en scène avec :",
      "J’ai retrouvé cette filmographie dans le catalogue :"
    ],

    premium: [
      "Direction les fauteuils rouges :",
      "J’ai ouvert la petite salle Premium, voici ce qu’elle contient :",
      "Le coin Premium propose ceci :",
      "Les fauteuils rouges sont prêts pour :",
      "J’ai filtré le Premium sans confondre avec la vitrine :",
      "La sélection à coussin moelleux donne :"
    ],

    random: [
      "J’ai laissé une bulle choisir dans le bocal :",
      "Le hasard a tapé contre la vitre et propose :",
      "Je mélange les bobines, j’en attrape une :",
      "Le bocal a remué les titres, voici la prise :",
      "Une bobine vient de remonter toute seule :",
      "Le poisson ferme les yeux, ouvre une nageoire, et tombe sur :"
    ],

    duration: [
      "J’ai sorti le chronomètre du tiroir humide, voici les options :",
      "Côté durée, ces titres rentrent dans le filet :",
      "J’ai vérifié les minutes avant de parler, voilà ce qui passe :",
      "Le poisson a compté les minutes sur ses nageoires, résultat :",
      "Pour une séance calibrée sans marathon, je trouve :"
    ],

    best: [
      "J’ai laissé les mieux placés remonter en surface :",
      "Côté valeurs sûres du catalogue, je vois :",
      "Les titres les plus solides semblent être :",
      "Le haut du panier du bocal donne :",
      "Je privilégie les titres qui ressortent le mieux :"
    ],

    mood: [
      "Pour cette ambiance, le bocal me souffle :",
      "J’ai cherché une couleur de séance, et ça donne :",
      "Côté atmosphère, je partirais plutôt sur :",
      "Pour cette humeur de canapé, je propose :",
      "J’ai trié par sensation plus que par étiquette, voici :"
    ],

    session: [
      "Pour ce type de séance, je mettrais ça sur le projecteur :",
      "Vu le contexte, je te proposerais plutôt :",
      "Pour cette configuration de canapé, voici ma sélection :",
      "J’ai ajusté la pêche à la soirée, résultat :",
      "Le bocal adapte la séance et sort :"
    ]
  };

  if (count === 1) return fishPickText(intros.single);
  if (intent?.matchedActors?.length) return fishPickText(intros.actor);
  if (intent?.matchedDirectors?.length) return fishPickText(intros.director);
  if (intent?.wantsPremium) return fishPickText(intros.premium);
  if (intent?.wantsRandom) return fishPickText(intros.random);
  if (intent?.durationMax || intent?.wantsShort) return fishPickText(intros.duration);
  if (intent?.wantsBest) return fishPickText(intros.best);
  if (intent?.matchedSessionProfiles?.length) return fishPickText(intros.session);
  if (intent?.matchedMoods?.length) return fishPickText(intros.mood);

  if (media !== 'titre') {
    return fishPickText([
      `J’ai trouvé quelques ${plural} qui collent bien :`,
      `Côté ${media}, le catalogue me donne :`,
      `Pour ce rayon ${media}, je remonte avec :`,
      `J’ai filtré les ${plural} sans salir l’aquarium, résultat :`,
      `Dans la zone ${media}, les meilleurs candidats sont :`
    ]);
  }

  return fishPickText(intros.default);
}

function fishCommentForResults(results, context = {}) {
  const list = Array.isArray(results) ? results.filter(Boolean) : [];

  if (!list.length) {
    return '';
  }

  const first = list[0];
  const firstTitle = fishMovieTitle(first);
  const firstRuntime = fishMovieRuntimeForDisplay(first);
  const firstGenres = fishMovieGenresForDisplay(first).map(fishNormalize);
  const message = fishNormalize(context.rawMessage || context.m || '');

  const runtimeText = firstRuntime ? ` (${fishFormatDuration(firstRuntime)})` : '';

  if (/premium|fauteuil rouge|selection premium/.test(message)) {
    return '\n\n' + fishPickText([
      'La sélection Premium est filtrée proprement : ici, le poisson ne confond pas “Premium” avec “simplement mis en avant”.',
      'J’ai vérifié le vrai statut Premium. Pas de fauteuil rouge peint au feutre.',
      'Ce sont bien des titres Premium d’après le JSON, pas juste des bobines qui font les importantes.',
      'Le bocal valide le badge Premium. Les sardines ordinaires restent dans le couloir.',
      'J’ai gardé uniquement les vrais Premium. Le poisson aime le velours, mais il aime surtout les données propres.'
    ]);
  }

  if (/plus long|le plus long|longue duree|longue durée/.test(message)) {
    return '\n\n' + fishPickText([
      `Le plus costaud du lot semble être ${firstTitle}${runtimeText}. Prévois le canapé réglementaire.`,
      `${firstTitle}${runtimeText} prend la tête côté endurance. Là, on n’est plus sur une séance, on signe presque un bail.`,
      `Si tu veux du long, ${firstTitle}${runtimeText} a les nageoires larges.`,
      `${firstTitle}${runtimeText} sort du lot pour une soirée qui assume son côté tunnel de pop-corn.`,
      `Le chronomètre pointe vers ${firstTitle}${runtimeText}. Le poisson conseille une boisson avec autonomie étendue.`
    ]);
  }

  if (/plus court|court|rapide|pas trop long|moins de|moins d|sous|max|maximum/.test(message)) {
    return '\n\n' + fishPickText([
      `Le premier choix, ${firstTitle}${runtimeText}, colle bien à une envie de séance qui ne transforme pas la soirée en randonnée administrative.`,
      `${firstTitle}${runtimeText} semble le plus pratique si tu veux regarder quelque chose sans demander un congé au canapé.`,
      `Je mets ${firstTitle}${runtimeText} devant : durée raisonnable, bocal content, soirée encore vivante après le générique.`,
      `${firstTitle}${runtimeText} passe bien pour une séance calibrée. Le poisson a rangé le mètre ruban.`,
      `Côté durée, ${firstTitle}${runtimeText} a le bon format : assez pour s’installer, pas assez pour fusionner avec le plaid.`
    ]);
  }

  if (firstGenres.includes('zombie') || /zombie|zombies|mort vivant|morts vivants/.test(message)) {
    return '\n\n' + fishPickText([
      'Le bocal valide : on est bien sur du mort-vivant, pas sur une simple résurrection de planning foireux.',
      'J’ai bien cherché du zombie. Pas juste un titre avec “résurrection” qui essaie de passer en douce.',
      'Ça sent le mort-vivant réglementaire. Le poisson garde quand même une distance sanitaire.',
      'Le filtre zombie est strict : pas de cadavre administratif dans la liste.',
      'On reste dans le domaine des mâchoires qui claquent et des couloirs mal éclairés.'
    ]);
  }

  if (firstGenres.includes('horreur') || firstGenres.includes('epouvante') || /horreur|epouvante|épouvante|peur/.test(message)) {
    return '\n\n' + fishPickText([
      'Côté ambiance, ça devrait grincer juste ce qu’il faut dans les couloirs du canapé.',
      'Le bocal conseille de vérifier derrière le rideau. Pure procédure qualité.',
      'On est sur une sélection qui peut faire travailler les coussins en défense rapprochée.',
      'L’ambiance devrait être suffisamment sombre pour que le pop-corn se sente observé.',
      'Le poisson ne garantit pas le sommeil après, il ne gère que le catalogue.'
    ]);
  }

  if (firstGenres.includes('science fiction') || firstGenres.includes('science-fiction') || /sf|science fiction|science-fiction|sci fi|sci-fi/.test(message)) {
    return '\n\n' + fishPickText([
      'Bon choix pour décoller sans quitter le canapé. Le carburant officiel reste le pop-corn.',
      'Le bocal a capté un signal venu du futur. Il grésille un peu, mais il répond.',
      'Ça devrait satisfaire l’envie de vaisseaux, de mondes étranges ou de concepts qui portent des lunettes.',
      'Le poisson a mis son casque spatial. Il est ridicule, mais concentré.',
      'On part sur de la science-fiction avec assez de matière pour faire vibrer les néons du salon.'
    ]);
  }

  if (firstGenres.includes('comedie') || firstGenres.includes('comédie') || /comedie|comédie|humour|drole|drôle/.test(message)) {
    return '\n\n' + fishPickText([
      'Ça sent la séance détente. Pas forcément un prix Nobel, mais parfois le cerveau demande juste une couverture et une bêtise bien cadrée.',
      'Le bocal classe ça dans la zone sourire potentiel. Pas une science exacte, mais le poisson y croit.',
      'Bonne piste pour laisser le cerveau en chaussons.',
      'On part sur une sélection qui devrait éviter les dissertations à 23h47.',
      'Le poisson approuve : parfois le rire est plus utile qu’un tableau Excel.'
    ]);
  }

  if (/manga|anime|animé/.test(message)) {
    return '\n\n' + fishPickText([
      'Côté manga, le catalogue est encore petit, donc je préfère viser juste plutôt que remplir le bocal avec des algues.',
      'Le rayon manga n’est pas immense, mais les correspondances sont propres.',
      'Le poisson a parlé japonais approximatif au JSON. Étonnamment, ça passe.',
      'Je reste prudent sur les mangas : peu de titres, donc pas de remplissage décoratif.',
      'La sélection manga est courte, mais elle ne triche pas.'
    ]);
  }

  if (/serie|série|series|séries/.test(message)) {
    return '\n\n' + fishPickText([
      'Côté série, je filtre strictement le type pour éviter les films déguisés avec une moustache.',
      'Le bocal reste dans le rayon série. Aucun film clandestin dans la nasse.',
      'La sélection reste cohérente avec ta demande de série.',
      'J’ai gardé le filtre série allumé. Il fait un petit bruit, mais il travaille.',
      'Pas de mélange de rayons : ici, le poisson garde les séries entre elles.'
    ]);
  }

  if (list.length === 1) {
    return '\n\n' + fishPickText([
      'Un seul candidat ressort vraiment. Le poisson évite de gonfler la liste avec des titres au chausse-pied.',
      'Je pourrais remplir avec du tiède, mais le bocal a encore un peu de dignité.',
      'Un seul titre tient franchement la route. Le reste serait de la décoration humide.',
      'Je préfère une réponse courte et honnête à une fanfare de faux positifs.',
      'Le catalogue n’a qu’un vrai candidat solide pour cette demande.'
    ]);
  }

  return '\n\n' + fishPickText([
    'Le premier titre est celui qui ressort le mieux pour ta demande. Le reste suit, comme une petite file d’attente de bobines bien élevées.',
    'J’ai classé les réponses par pertinence. Enfin, autant qu’un poisson avec un JSON peut le faire.',
    'Le haut de la liste semble le plus solide. Ensuite, on descend doucement dans les bonnes possibilités.',
    'Je mets les meilleurs candidats devant, les figurants suivent derrière.',
    'La première proposition est celle qui coche le plus de cases. Les autres restent dans le bon courant.',
    'J’ai évité les résultats décoratifs. Si c’est dans la liste, c’est que le catalogue donne un vrai signal.',
    'Les titres sont rangés par affinité avec ta demande, pas par humeur de bulle.',
    'Le poisson a trié sans trop éclabousser.'
  ]);
}

let fishLastResults = [];
let fishLastOffset = 0;
function fishContinueLastResults() {
  if (!fishLastResults.length) {
    return "Bloup... je n'ai aucune recherche en mémoire. Demande-moi d'abord un film.";
  }

  if (fishLastOffset >= fishLastResults.length) {
    return "Bloup... le bocal est vide. Je t'ai déjà montré tous les films correspondant à cette recherche.";
  }

  const next = fishLastResults.slice(fishLastOffset, fishLastOffset + 5);

  fishLastOffset += next.length;

  let answer = "Voici la suite :\n\n";
  answer += next.map((movie, index) =>
    fishMovieLine(movie, fishLastOffset - next.length + index)
  ).join("\n");

  if (fishLastOffset < fishLastResults.length) {
    answer += "\n\nTu peux simplement écrire « encore » pour continuer.";
  } else {
    answer += "\n\nBloup ! Cette fois, tu as vu toute la sélection.";
  }

  return answer;
}
function fishFormatTitleResults(results, intro) {
  fishLastResults = [...results];
fishLastOffset = Math.min(5, results.length);
  const visibleResults = results.slice(0, 5);
  const remaining = results.length - visibleResults.length;

  let answer = `${intro}\n`;

  answer += visibleResults
    .map(fishMovieLine)
    .join('\n');

  if (remaining > 0) {
    answer += `\n... et ${remaining} autre${remaining > 1 ? 's' : ''} titre${remaining > 1 ? 's' : ''}.`;
  }

  answer += fishCommentForResults(visibleResults);

  return answer;
}

function fishAnswerGenreRequest(message, catalogue) {
  

  // Petit neurone : conseil multi-support (film / série / manga)
  if (fishIsOpenAdvicePrompt(message)) {
    return fishOpenAdviceAnswer();
  }

  if (/\b(quel conseil|tu me conseilles quoi|que me conseilles tu|que me conseilles-tu|tu choisirais quoi|ton conseil)\b/i.test(message)) {
    return `🐠 Avec plaisir !

Avant de te conseiller quelque chose, donne-moi deux indices.

Tu cherches plutôt :
• 🎬 Un film
• 📺 Une série
• 📚 Un manga

Puis indique simplement un genre.
Exemples :
• Série de science-fiction
• Manga d'action
• Film d'horreur`;
  }


const genreKey = fishDetectRequestedGenre(message);

  if (!genreKey) {
    return null;
  }

  const genreMap = {
    science_fiction: 'science-fiction',
    comedie: 'comédie',
    zombie: 'zombie',
    horreur: 'horreur',
    drame: 'drame',
    action: 'action',
    aventure: 'aventure',
    thriller: 'thriller',
    fantastique: 'fantastique',
    animation: 'animation',
    romance: 'romance',
    guerre: 'guerre',
    crime: 'crime',
    western: 'western',
    documentaire: 'documentaire'
  };

  const records = getRecords(catalogue);
  const requestedType = detectRequestedType(message);
  const wantedGenre = genreMap[genreKey] || genreKey;
  const durationFilter = fishDetectDurationFilter(message);
  const wantsPremium = /premium|fauteuil rouge|selection premium|sélection premium/.test(fishNormalize(message));
  const actorQuery = fishDetectActorFilter(message, catalogue);
  const actorLabel = actorQuery ? fishDisplayActorQuery(actorQuery) : '';
  const hasActorIntent =
  !fishIsCompanionContext(message) &&
  /\bavec\b|\bacteur\b|\bactrice\b|\bcasting\b|\bjoue\b|\bjouent\b/.test(fishNormalize(message));

if (hasActorIntent && !actorQuery) {
  return 'Bloup... je n’ai trouvé aucun acteur ou actrice correspondant dans le JSON. Je préfère ne pas remplacer la personne demandée par un film vaguement proche.';
}


  const label = FISH_GENRE_LABELS[genreKey] || genreKey;
  const labelWithActor = actorLabel ? `${label} avec ${actorLabel}` : label;

  const results = records.filter(record => {
    if (genreKey === 'zombie') {
      if (!recordMatchesTopic(record, TOPIC_RULES.find(topic => topic.label === 'zombies'))) {
        return false;
      }
    } else {
  if (!fishRecordHasGenreKey(record, genreKey)) {
    return false;
  }
}

    if (requestedType && normalize(record.type) !== normalize(requestedType)) {
      return false;
    }

    if (wantsPremium) {
  const rawPremium = record.item && record.item.premium;

  const isStrictPremium =
    rawPremium === true ||
    rawPremium === 1 ||
    String(rawPremium || '').toLowerCase() === 'true' ||
    String(rawPremium || '').toLowerCase() === 'oui' ||
    String(rawPremium || '').toLowerCase() === 'yes';

  if (!isStrictPremium) {
    return false;
  }
}

    if (actorQuery && !fishMovieMatchesActor(record.item, actorQuery)) {
      return false;
    }

    if (durationFilter && !fishRecordMatchesDurationFilter(record, durationFilter)) {
      return false;
    }
    if (actorQuery && !fishMovieMatchesActor(record.item, actorQuery)) {
    return false;
    }
    return true;
  });

  const mediaWord = requestedType
    ? (normalize(requestedType) === 'serie' ? 'une série' :
       normalize(requestedType) === 'manga' ? 'un manga' :
       'un film')
    : 'un titre';

  if (!results.length) {
    return `Je ne trouve pas ${mediaWord} ${labelWithActor}${wantsPremium ? ' Premium' : ''} dans le catalogue. Le poisson préfère ne pas inventer une sardine en smoking.`;
  }

  const intro = durationFilter
    ? `Pour ${mediaWord} ${labelWithActor}${wantsPremium ? ' Premium' : ''} ${durationFilter.label}, j’ai trouvé :`
    : `Pour ${mediaWord} ${labelWithActor}${wantsPremium ? ' Premium' : ''}, j’ai trouvé :`;

  return fishFormatTitleResults(results, intro);
}

  if (!widget || !chat || !form || !input || !messages) return;

  const STORAGE_KEY = 'planeteStreamProjectionnisteIntroSeen';

  let mode = 'idle';
  let idleIndex = 0;
  let idleLoop = null;
  let microLifeLoop = null;
  let autoReturnTimer = null;
  let isHovering = false;
  let isChatOpen = false;

  let cataloguePromise = null;
  let catalogueCache = null;
  let recordsCache = null;
  let fishLastSearchMessage = '';
  let fishBaseSearchMessage = '';
  let fishOpenAdvicePending = false;
  
  const states = {
    idle: {
      pose: null,
      html: '<strong>Bloup !</strong><span>Clique si tu veux parler au Projectionniste.</span>'
    },
    thinking: {
      pose: 'thinking',
      html: '<strong>Bloup...</strong><span>Je vérifie dans le catalogue avant de parler.</span>'
    },
    talking: {
      pose: 'talking',
      html: '<strong>Verdict du bocal</strong><span>J’ai comparé avec les bobines disponibles.</span>'
    },
    happy: {
      pose: 'talking',
      html: '<strong>Bloup bloup !</strong><span>Le Projectionniste est réveillé.</span>'
    }
  };

  const STOP_WORDS = new Set(
    [
      'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
      'un', 'une', 'des', 'de', 'du', 'd', 'le', 'la', 'les', 'l',
      'au', 'aux', 'ce', 'cet', 'cette', 'ces', 'mon', 'ma', 'mes',
      'ton', 'ta', 'tes', 'son', 'sa', 'ses',
      'dans', 'avec', 'sans', 'pour', 'sur', 'sous', 'par', 'entre',
      'qui', 'que', 'quoi', 'quel', 'quelle', 'quels', 'quelles',
      'est', 'sont', 'suis', 'es', 'a', 'as', 'avez', 'ont', 'fait',
      'veux', 'voudrais', 'cherche', 'recherche', 'propose', 'conseille',
      'montre', 'donne', 'trouve', 'moi', 'peux', 'peut',
      'film', 'films', 'serie', 'series', 'série', 'séries', 'manga',
      'acteur', 'acteurs', 'actrice', 'actrices', 'casting', 'cast',
      'realisateur', 'realisatrice', 'réalisateur', 'réalisatrice',
      'realise', 'réalisé', 'realisee', 'réalisée', 'realises', 'réalisés',
      'genre', 'genres', 'type', 'duree', 'durée', 'heure', 'heures',
      'minute', 'minutes', 'min', 'moins', 'plus', 'trop', 'tres', 'très',
      'meilleur', 'meilleure', 'top', 'note', 'noté', 'notée',
      'catalogue', 'planete', 'stream', 'planetestream'
    ].map(normalize)
  );

  const GENRE_ALIASES = [
    ['science-fiction', ['science fiction', 'sf', 'sci fi', 'sci-fi', 'futuriste', 'espace', 'spatial']],
    ['horreur', ['horreur', 'horrifique', 'peur', 'gore', 'epouvante', 'épouvante']],
    ['thriller', ['thriller', 'suspense']],
    ['action', ['action', 'baston', 'combat']],
    ['aventure', ['aventure']],
    ['comédie', ['comedie', 'comédie', 'comique', 'humour', 'humoristique', 'drole', 'drôle', 'fun']],
    ['drame', ['drame', 'dramatique', 'triste', 'emouvant', 'émouvant']],
    ['crime', ['crime', 'criminel', 'policier', 'enquete', 'enquête']],
    ['mystère', ['mystere', 'mystère']],
    ['romance', ['romance', 'romantique', 'amour']],
    ['fantastique', ['fantastique', 'fantasy', 'magique', 'magie']],
    ['animation', ['animation', 'dessin anime', 'dessin animé', 'anime', 'animé']],
    ['familial', ['famille', 'familial', 'enfant', 'kids']]
  ];

  const TOPIC_RULES = [
    {
      label: 'super-héros',
      pattern: /super ?heros|super ?héros|superhero|marvel|dc comics|batman|superman|spider ?man|avengers|venom|joker|deadpool|x-?men/,
      terms: [
        'batman', 'superman', 'spider', 'spiderman', 'spider man',
        'avengers', 'venom', 'joker', 'deadpool', 'x-men', 'x men',
        'marvel', 'gotham', 'justice league', 'iron man', 'thor',
        'captain america', 'hulk', 'black panther', 'doctor strange',
        'gardiens de la galaxie', 'guardians of the galaxy'
      ],
      genres: ['action', 'aventure', 'fantastique', 'science-fiction', 'crime']
    },
         {
      label: 'zombies',
      strict: true,
      pattern: /zombie|zombies|mort vivant|morts vivants|infecte|infectes|infecté|infectés|malnazidos|resident evil|world war z|zombieland|walking dead/,
      terms: [
        'zombie',
        'zombies',
        'mort vivant',
        'morts vivants',
        'infecte',
        'infecté',
        'infectés',
        'malnazidos',
        'resident evil',
        'world war z',
        'zombieland',
        'walking dead',
        'train to busan',
        'army of the dead',
        'shaun of the dead',
        '28 jours plus tard',
        '28 semaines plus tard',
        'overlord'
      ],
      genres: ['horreur', 'action', 'thriller']
    },
    {
      label: 'dinosaures',
      pattern: /dinosaure|dinosaures|jurassic/,
      terms: ['jurassic', 'dinosaure', 'dinosaures'],
      genres: ['aventure', 'science-fiction', 'action']
    },
    {
      label: 'espace',
      pattern: /espace|spatial|galaxie|vaisseau|planete|planète|extraterrestre|alien/,
      terms: ['espace', 'galaxie', 'vaisseau', 'alien', 'extraterrestre', 'avatar', 'prometheus'],
      genres: ['science-fiction', 'aventure']
    },
    {
      label: 'robots',
      pattern: /robot|robots|androide|androïde|intelligence artificielle|\bia\b/,
      terms: ['robot', 'androide', 'androïde', 'intelligence artificielle'],
      genres: ['science-fiction', 'action']
    },
    {
      label: 'magie',
      pattern: /magie|sorcier|sorciere|sorcière|magicien|magicienne/,
      terms: ['magie', 'sorcier', 'sorciere', 'sorcière', 'fantastique'],
      genres: ['fantastique', 'aventure']
    },
    {
      label: 'vampires',
      pattern: /vampire|vampires|dracula/,
      terms: ['vampire', 'dracula'],
      genres: ['horreur', 'fantastique']
    },
    {
      label: 'pirates',
      pattern: /pirate|pirates|corsaire|corsaires/,
      terms: ['pirate', 'corsaire'],
      genres: ['aventure', 'action']
    },
    {
      label: 'guerre',
      pattern: /guerre|militaire|soldat|soldats|armee|armée/,
      terms: ['guerre', 'militaire', 'soldat', 'armée'],
      genres: ['action', 'drame', 'thriller']
    },
    {
      label: 'espionnage',
      pattern: /espion|espionnage|agent secret|mission secrete|mission secrète/,
      terms: ['espion', 'agent secret', 'mission'],
      genres: ['action', 'thriller', 'aventure']
    }
  ];

  const MOOD_RULES = [
  {
    label: 'intelligent',
    pattern: /intelligent|profond|psychologique|cerebral|reflechir|reflexion|scenario malin|scenario complexe|scenario tordu|film tordu|truc tordu|retourne le cerveau|prise de tete utile|cerveau qui travaille|twist|mindfuck|enquete complexe|histoire complexe/,
    genres: ['drame', 'science-fiction', 'mystère', 'thriller'],
    terms: ['psychologique', 'enquete', 'dystopie', 'temps', 'ia', 'mystere', 'complot']
  },
  {
    label: 'flippant',
    pattern: /flippant|angoissant|angoisse|peur|terrifiant|glauque|cauchemar|frisson|frissonner|fais moi peur|faire peur|sursauter|ambiance sombre|ambiance malsaine|tension|stress|stressant|horreur|creepy/,
    genres: ['horreur', 'thriller'],
    terms: ['zombie', 'vampire', 'monstre', 'fantome', 'gore', 'meurtre']
  },
  {
    label: 'chill',
    pattern: /chill|facile|reposant|sans prise de tete|calme|detente|tranquille|leger|pas prise de tete|marrant|simple|debrancher|deconnecter|poser le cerveau|cerveau en chaussons|film doudou|film confortable|un truc doux/,
    genres: ['comédie', 'animation', 'familial', 'romance', 'aventure'],
    maxRuntime: 115
  },
  {
    label: 'spectaculaire',
    pattern: /spectaculaire|qui envoie du lourd|gros spectacle|plein les yeux|explosif|epoustouflant|impressionnant|epique|grand spectacle|blockbuster|visuel|ca explose|explosions|grosse claque|grandiose|du lourd|gros film|film qui claque/,
    genres: ['action', 'aventure', 'science-fiction'],
    terms: ['espace', 'guerre', 'vaisseau', 'monstre', 'catastrophe']
  },
  {
    label: 'emotion',
    pattern: /emouvant|touchant|triste|pleurer|faire pleurer|larme|larmes|belle histoire|histoire touchante|histoire humaine|emotion|emotions|bouleversant|poignant|coeur serre|remuer le coeur/,
    genres: ['drame', 'romance'],
    terms: ['famille', 'amour', 'deuil', 'vie']
  },
  {
    label: 'bonne humeur',
    pattern: /bonne humeur|remonte moi le moral|remonter le moral|besoin de rire|envie de rire|fais moi rire|rigoler|sourire|joyeux|positif|feel good|feelgood|anti depression|moral dans les chaussettes/,
    genres: ['comédie', 'animation', 'familial', 'romance'],
    maxRuntime: 125
  },
  {
    label: 'adrénaline',
    pattern: /adrenaline|tension|nerveux|rythme|ca bouge|qui bouge|action pure|course poursuite|bagarre|baston|combat|poursuite|sous pression|pas de temps mort|nerfs/,
    genres: ['action', 'thriller', 'aventure'],
    terms: ['mission', 'course', 'combat', 'agent']
  },
  {
    label: 'evasif',
    pattern: /voyager|evasion|evader|ailleurs|emmene moi ailleurs|partir loin|depaysement|grand univers|univers immense|monde immense|autre monde|aventure depaysante|besoin d air/,
    genres: ['aventure', 'science-fiction', 'fantastique'],
    terms: ['monde', 'espace', 'royaume', 'planete']
  }
];

const SESSION_PROFILE_RULES = [
  {
    label: 'pour ce soir',
    pattern: /ce soir|pour ce soir|quoi regarder|je regarde quoi|ce soir je regarde quoi|un truc pour ce soir|quoi voir ce soir|un film a voir|un film sympa|un bon film|une serie pour ce soir|un manga pour ce soir/,
    genres: ['aventure', 'science-fiction', 'comedie'],
    maxRuntime: 150,
    preferRating: true
  },
  {
    label: 'fatigue',
    pattern: /fatigue|fatiguee|creve|crevee|rince|rincee|lessive|lessivee|eclate|eclatee|epuise|epuisee|ko|hs|j en peux plus|plus de batterie|plus d energie|journee interminable|grosse journee|journee de dingue|journee pourrie|cerveau off|cerveau eteint|plus de cerveau|plus un neurone|je suis mort|je suis cuite|je suis cuit|yeux qui piquent/,
    genres: ['comedie', 'animation', 'aventure', 'familial'],
    maxRuntime: 120,
    preferLight: true
  },
  {
    label: 'sans prise de tete',
    pattern: /pas trop complique|pas trop compliquee|pas envie de reflechir|sans reflechir|sans prise de tete|pas prise de tete|truc simple|film simple|un truc facile|je veux debrancher|je veux deconnecter|poser le cerveau|cerveau en pause|cerveau en chaussons|rien de lourd|pas lourd|leger/,
    genres: ['comedie', 'animation', 'aventure', 'familial'],
    maxRuntime: 125,
    preferLight: true
  },
  {
    label: 'besoin de rire',
    pattern: /besoin de rire|envie de rire|fais moi rire|faire rire|rigoler|marrant|drole|humour|comedie|remonte moi le moral|moral bas|moral dans les chaussettes|bonne humeur|un truc fun|film fun|je veux sourire/,
    genres: ['comedie', 'animation', 'familial'],
    maxRuntime: 130,
    preferLight: true
  },
  {
    label: 'se faire peur',
    pattern: /fais moi peur|je veux avoir peur|envie d avoir peur|faire peur|frissonner|frissons|sursauter|film qui fait peur|ambiance sombre|truc glauque|glauque|angoissant|angoisse|cauchemar|halloween|soiree horreur/,
    genres: ['horreur', 'thriller'],
    maxRuntime: 130
  },
  {
    label: 'stress et tension',
    pattern: /je veux stresser|mets moi sous tension|sous tension|tendu|tension|suspense|thriller nerveux|haletant|pas respirer|tenir en haleine|stress|stressant|angoisse mais pas horreur/,
    genres: ['thriller', 'crime', 'action'],
    maxRuntime: 140
  },
  {
    label: 'grand spectacle',
    pattern: /grand spectacle|gros spectacle|plein les yeux|blockbuster|epique|epique|film epique|grosse claque|qui envoie du lourd|du lourd|spectaculaire|explosif|ca explose|explosions|grandiose|film qui claque/,
    genres: ['action', 'aventure', 'science-fiction'],
    preferSpectacle: true
  },
  {
    label: 'action pure',
    pattern: /action pure|ca bouge|qui bouge|baston|combat|bagarre|course poursuite|poursuite|armes|explosions|film nerveux|rythme rapide|pas de temps mort|adrénaline|adrenaline/,
    genres: ['action', 'thriller', 'aventure'],
    preferSpectacle: true
  },
  {
    label: 'envie de reflechir',
    pattern: /envie de reflechir|faire reflechir|qui fait reflechir|film intelligent|truc intelligent|scenario complexe|scenario tordu|film tordu|retourne le cerveau|twist|mindfuck|histoire originale|concept fort|cerveau qui travaille/,
    genres: ['science-fiction', 'thriller', 'mystère', 'drame'],
    maxRuntime: 160,
    preferRating: true
  },
  {
    label: 'enquete',
    pattern: /enquete|enquête|detective|policier|polar|crime|criminel|meurtre|mystere|mystere a resoudre|qui a fait le coup|investigation|flic|police/,
    genres: ['crime', 'thriller', 'mystère', 'drame'],
    maxRuntime: 150
  },
  {
    label: 'emotion',
    pattern: /envie d emotion|emouvant|touchant|je veux pleurer|faire pleurer|belle histoire|histoire touchante|histoire humaine|triste|poignant|romantique triste|film sensible|coeur serre/,
    genres: ['drame', 'romance'],
    maxRuntime: 150,
    preferRating: true
  },
  {
    label: 'romantique',
    pattern: /romantique|histoire d amour|film d amour|romance|en amoureux|avec ma copine|avec mon copain|avec ma femme|avec mon mari|date night|soirée couple|soiree couple|a deux|à deux/,
    genres: ['romance', 'comedie', 'drame'],
    maxRuntime: 140
  },
  {
    label: 'famille',
    pattern: /en famille|familial|famille|avec les enfants|pour enfant|pour les enfants|avec mon fils|avec ma fille|avec les petits|tout public|pas trop violent|pas violent|film familial|kids|goûter|gouter/,
    genres: ['animation', 'familial', 'aventure', 'comedie'],
    maxRuntime: 130
  },
  {
    label: 'entre amis',
    pattern: /entre amis|entre potes|avec des amis|avec les potes|soiree film|soirée film|a plusieurs|à plusieurs|film de groupe|soiree entre amis|soirée entre amis|on est plusieurs|on est quatre|on est 4|pizza|soiree pizza|soirée pizza/,
    genres: ['action', 'aventure', 'comedie', 'science-fiction'],
    preferSpectacle: true
  },
  {
    label: 'parents presents',
    pattern: /avec mes parents|mes parents sont la|parents sont la|avec la famille|repas de famille|film avec parents|pas trop gore|pas de gore|pas trop trash|rien de trop violent|soft mais bien/,
    genres: ['drame', 'aventure', 'comedie', 'familial'],
    maxRuntime: 140,
    preferRating: true
  },
  {
    label: 'enfants couches',
    pattern: /enfants couches|enfants sont couches|les petits dorment|maintenant que les enfants dorment|adultes seulement|enfin tranquille|soirée adulte|soiree adulte/,
    genres: ['thriller', 'science-fiction', 'drame', 'action'],
    maxRuntime: 150
  },
  {
    label: 'il est tard',
    pattern: /il est tard|tard|trop tard|pas trop long|petit film|film court|une heure devant moi|1h devant moi|pas le temps|vite fait|avant de dormir|avant dodo|je dors bientot/,
    genres: ['comedie', 'animation', 'thriller', 'aventure'],
    maxRuntime: 105,
    preferLight: true
  },
  {
    label: 'dimanche tranquille',
    pattern: /dimanche|dimanche soir|dimanche apres midi|apres midi tranquille|aprem tranquille|cocooning|plaid|canape|canapé|the et plaid|cafe et plaid|film du dimanche/,
    genres: ['comedie', 'aventure', 'familial', 'romance'],
    maxRuntime: 130,
    preferLight: true
  },
  {
    label: 'jour de pluie',
    pattern: /pluie|il pleut|jour de pluie|temps pourri|temps gris|meteo pourrie|meteo nulle|plaid obligatoire|ambiance pluie|reste a la maison/,
    genres: ['drame', 'thriller', 'fantastique', 'aventure'],
    maxRuntime: 150
  },
  {
    label: 'canicule',
    pattern: /canicule|trop chaud|il fait chaud|chaleur|je fonds|ventilo|ventilateur|film frais|besoin de frais|soirée d ete|soiree d ete/,
    genres: ['comedie', 'aventure', 'animation'],
    maxRuntime: 120,
    preferLight: true
  },
  {
    label: 'nostalgie',
    pattern: /nostalgie|nostalgique|vieux film|ancien film|classique|film culte|culte|retour en enfance|annees 80|années 80|annees 90|années 90|souvenir|madeleine/,
    genres: ['aventure', 'science-fiction', 'comedie', 'action'],
    preferRating: true
  },
  {
    label: 'science fiction',
    pattern: /envie de sf|envie de science fiction|futur|futuriste|espace|vaisseau|planete|planète|alien|extraterrestre|robot|ia|intelligence artificielle|cyberpunk|dystopie/,
    genres: ['science-fiction', 'aventure', 'action'],
    preferSpectacle: true
  },
  {
    label: 'fantastique magie',
    pattern: /magie|magique|fantastique|fantasy|sorcier|sorciere|royaume|dragon|creature|monde magique|quete|quête|sortilege|sortilège/,
    genres: ['fantastique', 'aventure', 'familial'],
    maxRuntime: 150
  },
  {
    label: 'voyage evasion',
    pattern: /voyager|evasion|evader|ailleurs|emmene moi ailleurs|partir loin|depaysement|grand univers|autre monde|aventure depaysante|besoin d air|changer d air|horizon/,
    genres: ['aventure', 'science-fiction', 'fantastique'],
    maxRuntime: 160,
    preferSpectacle: true
  },
  {
    label: 'apres le boulot',
    pattern: /apres le boulot|apres le travail|sortie du boulot|journee de boulot|journee travail|boulot termine|je rentre du travail|je rentre du taf|apres le taf|grosse journee de taf/,
    genres: ['comedie', 'aventure', 'action'],
    maxRuntime: 125,
    preferLight: true
  },
  {
    label: 'pause courte',
    pattern: /pause courte|petite pause|j ai pas longtemps|pas longtemps|pas beaucoup de temps|une petite heure|moins de deux heures|moins de 2h|format court|court mais bien/,
    genres: ['comedie', 'thriller', 'animation', 'action'],
    maxRuntime: 110,
    preferRating: true
  },
  {
    label: 'nuit blanche',
    pattern: /nuit blanche|je ne dors pas|impossible de dormir|insomnie|je suis reveille|je suis réveillé|milieu de la nuit|3h du matin|trois heures du matin/,
    genres: ['thriller', 'horreur', 'science-fiction', 'mystère'],
    maxRuntime: 140
  },
  {
    label: 'repas plateau',
    pattern: /plateau repas|je mange devant|devant le repas|pizza devant|burger devant|sushi devant|film avec repas|diner devant|dîner devant|manger devant/,
    genres: ['comedie', 'aventure', 'action'],
    maxRuntime: 130,
    preferLight: true
  },
  {
    label: 'premiere serie',
    pattern: /commencer une serie|nouvelle serie|premier episode|premiere episode|une serie a commencer|je veux une serie|lancer une serie|debuter une serie/,
    genres: ['drame', 'science-fiction', 'crime', 'action'],
    maxRuntime: 70,
    preferRating: true
  },
  {
    label: 'manga anime',
    pattern: /un anime|un animé|un manga|manga sympa|anime sympa|animé sympa|japonais|japanimation|shonen|isekai|animation japonaise/,
    genres: ['animation', 'action', 'aventure', 'fantastique'],
    maxRuntime: 60
  },
  {
    label: 'super heros',
    pattern: /super heros|super héros|marvel|dc|batman|superman|spider man|spiderman|avengers|venom|joker|deadpool|x men|x-men|cape|costume/,
    genres: ['action', 'aventure', 'science-fiction', 'fantastique'],
    preferSpectacle: true
  },
  {
    label: 'catastrophe',
    pattern: /catastrophe|fin du monde|apocalypse|survie|survivre|monde qui s ecroule|monde qui s effondre|tempete|tremblement|meteorite|asteroide|danger global/,
    genres: ['action', 'thriller', 'science-fiction', 'aventure'],
    preferSpectacle: true
  },
  {
    label: 'zombies',
    pattern: /zombie|zombies|mort vivant|morts vivants|infecte|infectes|walking dead|resident evil|survie zombie|apocalypse zombie/,
    genres: ['horreur', 'action', 'thriller'],
    maxRuntime: 130
  },
  {
    label: 'vampires',
    pattern: /vampire|vampires|dracula|sang|gothique|creature de la nuit|nuit gothique/,
    genres: ['horreur', 'fantastique', 'thriller'],
    maxRuntime: 140
  },
  {
    label: 'guerre',
    pattern: /guerre|militaire|soldat|soldats|armee|armée|combat militaire|mission militaire|front|bataille|commando/,
    genres: ['action', 'drame', 'thriller', 'guerre'],
    maxRuntime: 160
  },
  {
    label: 'espionnage',
    pattern: /espion|espionnage|agent secret|mission secrete|mission secrète|infiltration|cia|mi6|agent double|complot|mission impossible/,
    genres: ['action', 'thriller', 'aventure'],
    maxRuntime: 150
  },
  {
    label: 'cyber sombre',
    pattern: /cyberpunk|neon|néon|futur noir|ville futuriste|dystopie|techno sombre|ia dangereuse|monde controle|monde contrôlé|piratage|hacker/,
    genres: ['science-fiction', 'thriller', 'action'],
    maxRuntime: 150
  },
  {
    label: 'animation douce',
    pattern: /dessin anime|dessin animé|animation douce|animation familiale|film mignon|truc mignon|pour se poser|animation calme|mignon mais pas bebe/,
    genres: ['animation', 'familial', 'aventure', 'comedie'],
    maxRuntime: 115,
    preferLight: true
  },
  {
    label: 'choix au hasard',
    pattern: /surprends moi|surprend moi|surprise|au hasard|choisis pour moi|je te laisse choisir|n importe quoi|je sais pas quoi regarder|je ne sais pas quoi regarder|peu importe/,
    genres: ['aventure', 'science-fiction', 'comedie', 'thriller', 'action'],
    maxRuntime: 150,
    preferRating: true
  },
  {
    label: 'selection premium',
    pattern: /premium|fauteuil rouge|selection premium|sélection premium|un truc premium|film premium|meilleur fauteuil/,
    genres: ['action', 'aventure', 'science-fiction', 'drame'],
    maxRuntime: 170,
    preferRating: true
  },
  {
    label: 'bonne note',
    pattern: /bien note|bien noté|bonne note|meilleur|meilleure|top|valeur sure|valeur sûre|incontournable|un bon truc|quelque chose de solide/,
    genres: ['drame', 'science-fiction', 'aventure', 'thriller'],
    maxRuntime: 160,
    preferRating: true
  },
  {
    label: 'decouverte',
    pattern: /decouverte|découverte|surprenant|original|pas connu|moins connu|truc original|change moi|je veux changer|hors des sentiers|curiosite|curiosité/,
    genres: ['science-fiction', 'thriller', 'fantastique', 'drame'],
    maxRuntime: 150
  }
];


  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function tokenize(text) {
    return normalize(text)
      .split(' ')
      .filter(word => word.length > 1 && !STOP_WORDS.has(word));
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function compactText(values) {
    return values.filter(Boolean).join(' ');
  }

  
  function showPose(poseName) {
    poses.forEach(img => {
      img.classList.toggle('is-active', img.dataset.pose === poseName);
    });
  }

  function clearLoops() {
    clearInterval(idleLoop);
    clearTimeout(microLifeLoop);
    clearTimeout(autoReturnTimer);
  }

  function setMode(nextMode, options = {}) {
    const state = states[nextMode] || states.idle;
    mode = nextMode;

    widget.classList.toggle('is-thinking', mode === 'thinking');
    widget.classList.toggle('is-talking', mode === 'talking');
    widget.classList.toggle('is-happy', mode === 'happy');
    widget.classList.toggle('is-awake', mode !== 'idle' || isHovering || isChatOpen);

    if (tooltip) tooltip.innerHTML = state.html;

    clearLoops();

    if (state.pose) showPose(state.pose);
    else startIdleLoop();

    if (mode !== 'idle' && options.autoReturn !== false) {
      autoReturnTimer = setTimeout(() => setMode('idle'), options.duration || 3600);
    }
  }

  function startIdleLoop() {
    const idlePoses = ['idle-1', 'idle-2'];
    showPose(idlePoses[idleIndex]);

    idleLoop = setInterval(() => {
      idleIndex = (idleIndex + 1) % idlePoses.length;
      showPose(idlePoses[idleIndex]);
    }, 5200);

    scheduleMicroLife();
  }

  function scheduleMicroLife() {
    microLifeLoop = setTimeout(() => {
      if (mode !== 'idle') return;

      if (Math.random() < 0.55) {
        widget.classList.add('is-awake');

        setTimeout(() => {
          if (!isHovering && !isChatOpen && mode === 'idle') {
            widget.classList.remove('is-awake');
          }
        }, 1500);
      } else {
        showPose('idle-2');

        setTimeout(() => {
          if (mode === 'idle') showPose('idle-1');
        }, 1200);
      }

      scheduleMicroLife();
    }, randomBetween(7000, 14500));
  }

  function openChat() {
    isChatOpen = true;
    chat.classList.add('is-open');
    chat.setAttribute('aria-hidden', 'false');
    widget.setAttribute('aria-expanded', 'true');
    widget.classList.add('is-awake');
    widget.classList.remove('is-intro');

    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (error) {}

    setMode('happy', { duration: 1600 });
    setTimeout(() => input.focus(), 120);
  }

  function closeChat() {
    isChatOpen = false;
    chat.classList.remove('is-open');
    chat.setAttribute('aria-hidden', 'true');
    widget.setAttribute('aria-expanded', 'false');
    setMode('idle');
  }

  function toggleChat() {
    if (isChatOpen) closeChat();
    else openChat();
  }

  function addMessage(author, text) {
    const article = document.createElement('article');
    article.className = `ps-fish-message ps-fish-message-${author}`;
    article.innerHTML = `
      <strong>${author === 'bot' ? '🐠 Projectionniste' : 'Toi'}</strong>
      <p>${escapeHtml(text)}</p>
    `;
    messages.appendChild(article);
    messages.scrollTop = messages.scrollHeight;
  }

  function getCatalogueUrl() {
    return 'data/catalogue.json';
  }

  async function loadCatalogue() {
    if (Array.isArray(catalogueCache)) return catalogueCache;

    if (!cataloguePromise) {
      cataloguePromise = fetch(getCatalogueUrl(), { cache: 'no-store' })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Catalogue introuvable (${response.status})`);
          }
          return response.json();
        })
        .then(data => {
          catalogueCache = Array.isArray(data) ? data : [];
          recordsCache = null;
          return catalogueCache;
        });
    }

    return cataloguePromise;
  }
    function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function getName(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.name || value.title || value.original_name || '';
  }

  function getPersonNames(list) {
    return asArray(list)
      .map(getName)
      .filter(Boolean);
  }

  function getDirectorNames(item) {
    const names = [];

    function addNames(value) {
      getPersonNames(value).forEach(name => {
        if (name) names.push(name);
      });
    }

    addNames(item.director);
    addNames(item.directors);
    addNames(item.realisateur);
    addNames(item.realisateurs);
    addNames(item.réalisateur);
    addNames(item.réalisateurs);
    addNames(item.directedBy);
    addNames(item.directed_by);
    addNames(item.createdBy);
    addNames(item.created_by);

    const crewSources = [
      item.crew,
      item.credits && item.credits.crew,
      item.tmdb && item.tmdb.crew,
      item.tmdb && item.tmdb.credits && item.tmdb.credits.crew
    ];

    crewSources.forEach(source => {
      if (!Array.isArray(source)) return;

      source.forEach(person => {
        const job = normalize(`${person.job || ''} ${person.department || ''} ${person.known_for_department || ''}`);

        if (
          job.includes('director') ||
          job.includes('directing') ||
          job.includes('realisation') ||
          job.includes('realisateur')
        ) {
          const name = getName(person);
          if (name) names.push(name);
        }
      });
    });

    return unique(names);
  }

  function getCastNames(item) {
    return unique([
      ...getPersonNames(item.cast),
      ...getPersonNames(item.actors),
      ...getPersonNames(item.actor),
      ...getPersonNames(item.acteurs),
      ...getPersonNames(item.actrices)
    ]);
  }

  function getGenres(item) {
    return unique(asArray(item.genres || item.genre).map(getName));
  }

  function getRuntimeMinutes(item) {
    const value = item.runtime || item.duration || item.duree || item.durée;

    if (Number(value)) return Number(value);

    if (typeof value === 'string') {
      const hours = value.match(/(\d+)\s*h/);
      const mins = value.match(/(\d+)\s*(min|mn|minutes?)/);
      return (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
    }

    return 0;
  }

  function getRating(item) {
    const value =
      item.rating ||
      item.note ||
      item.vote_average ||
      item.tmdbRating ||
      item.planeteRating ||
      0;

    return Number(value) || 0;
  }

   
  function isPremiumItemV2(item) {
    if (!item) return false;

    const premiumKeys = [
      'premium',
      'isPremium',
      'is_premium',
      'featured',
      'isFeatured',
      'is_featured',
      'highlighted',
      'isHighlighted',
      'homePremium',
      'home_premium'
    ];

    for (const key of premiumKeys) {
      const value = item[key];

      if (value === true) return true;
      if (Number(value) === 1) return true;

      if (typeof value === 'string') {
        const v = normalize(value);
        if (v === 'true' || v === 'yes' || v === 'oui' || v.includes('premium')) {
          return true;
        }
      }
    }

    function scan(value, depth = 0) {
      if (depth > 4 || value == null) return false;

      if (typeof value === 'string') {
        const v = normalize(value);

        return (
          v.includes('premium') ||
          v.includes('fauteuil rouge') ||
          v.includes('selection premium') ||
          v.includes('selection du bocal')
        );
      }

      if (Array.isArray(value)) {
        return value.some(entry => scan(entry, depth + 1));
      }

      if (typeof value === 'object') {
        return Object.entries(value).some(([key, entry]) => {
          const k = normalize(key);

          if (
            k.includes('premium') &&
            (entry === true || entry === 'true' || entry === 1 || entry === '1')
          ) {
            return true;
          }

          return scan(entry, depth + 1);
        });
      }

      return false;
    }

    return scan(item);
  }
 
  function mediaLabel(item) {
    const value = normalize(
      item.type ||
      item.mediaType ||
      item.media_type ||
      item.category ||
      item.categorie ||
      ''
    );

    if (value.includes('serie') || value.includes('tv')) return 'Série';
    if (value.includes('manga') || value.includes('anime')) return 'Manga';
    return 'Film';
  }

  function createRecord(item, index) {
    const title = item.title || item.name || item.originalTitle || item.original_title || 'Titre sans nom';
    const originalTitle = item.originalTitle || item.original_title || '';
    const directors = getDirectorNames(item);
    const cast = getCastNames(item);
    const genres = getGenres(item);
    const runtime = getRuntimeMinutes(item);
    const rating = getRating(item);
    const type = mediaLabel(item);

    const titleText = compactText([title, originalTitle]);
    const directorText = directors.join(' ');
    const castText = cast.join(' ');
    const genreText = genres.join(' ');
    const storyText = compactText([item.overview, item.description, item.synopsis, item.tagline]);

    return {
      item,
      index,
      title,
      originalTitle,
      directors,
      cast,
      genres,
      runtime,
      rating,
      type,
            premium: isPremiumItemV2(item),
      titleNorm: normalize(titleText),
      directorNorm: normalize(directorText),
      castNorm: normalize(castText),
      genreNorm: normalize(genreText),
      storyNorm: normalize(storyText),
      allNorm: normalize(compactText([titleText, directorText, castText, genreText, storyText, type]))
    };
  }

  function getRecords(catalogue) {
    if (recordsCache) return recordsCache;
    recordsCache = catalogue.map(createRecord);
    return recordsCache;
  }

 function itemLine(record, index) {
  return fishMovieLine(record, index);
}

  function personLine(name, index) {
    return `${index + 1}. ${name}`;
  }

  function parseDurationLimit(message) {
    const m = normalize(message);

    const less = /(moins de|max(?:imum)?|pas plus de|sous|inferieur a|inférieur à)\s*(\d+)\s*(h|heure|heures|min|minute|minutes)?/.exec(m);
    if (!less) return null;

    const value = Number(less[2]);
    const unit = less[3] || '';

    return unit.includes('min') ? value : value * 60;
  }

  function detectRequestedType(message) {
    const m = normalize(message);

    if (/\bseries?\b/.test(m)) return 'Série';
    if (/\bmangas?\b|\banimes?\b/.test(m)) return 'Manga';
    if (/\bfilms?\b/.test(m)) return 'Film';

    return null;
  }

  function detectGenres(message) {
    const m = normalize(message);
    const found = [];

    GENRE_ALIASES.forEach(([genre, aliases]) => {
      const hit = aliases.some(alias => m.includes(normalize(alias)));
      if (hit) found.push(genre);
    });

    return unique(found);
  }

  function detectTopics(message) {
    const m = normalize(message);
    return TOPIC_RULES.filter(rule => rule.pattern.test(m));
  }

  function removeKnownQuestionWords(message) {
    return tokenize(message)
      .filter(word => !STOP_WORDS.has(word))
      .join(' ');
  }

  function extractTitleQuestion(message) {
    const m = normalize(message);

    const patterns = [
      /^(qui a realise|qui a realise le film|qui a realise la serie|realisateur de|realisatrice de|realise par qui|c est qui le realisateur de|c est qui la realisatrice de)\s+/,
      /^(donne moi le realisateur de|dis moi le realisateur de|quel est le realisateur de|quelle est la realisatrice de)\s+/
    ];

    for (const pattern of patterns) {
      const cleaned = m.replace(pattern, '').trim();
      if (cleaned !== m && cleaned.length > 1) return cleaned;
    }

    return '';
  }

  function extractPersonRequest(message) {
    const m = normalize(message);

    const patterns = [
      /\bavec\s+(.+)$/,
      /\bfilms?\s+avec\s+(.+)$/,
      /\bseries?\s+avec\s+(.+)$/,
      /\bmangas?\s+avec\s+(.+)$/,
      /\bde\s+(.+)$/,
      /\bpar\s+(.+)$/,
      /\brealise(?:s|es|e)?\s+par\s+(.+)$/,
      /\brealisateur\s+(.+)$/,
      /\brealisatrice\s+(.+)$/
    ];

    for (const pattern of patterns) {
      const match = m.match(pattern);
      if (match && match[1]) {
        return match[1]
          .replace(/\b(film|films|serie|series|manga|acteur|actrice|realisateur|realisatrice)\b/g, '')
          .trim();
      }
    }

    return '';
  }


function fishIsCompanionContext(message) {
  const m = normalize(message);

  return (
    /\bavec\s+(mes\s+)?parents\b/.test(m) ||
    /\bavec\s+(les\s+)?enfants\b/.test(m) ||
    /\bavec\s+(mon\s+)?fils\b/.test(m) ||
    /\bavec\s+(ma\s+)?fille\b/.test(m) ||
    /\bavec\s+(ma\s+)?famille\b/.test(m) ||
    /\ben\s+famille\b/.test(m) ||
    /\bavec\s+(des\s+)?amis\b/.test(m) ||
    /\bavec\s+(les\s+)?potes\b/.test(m) ||
    /\bentre\s+amis\b/.test(m) ||
    /\bentre\s+potes\b/.test(m) ||
    /\bavec\s+ma\s+copine\b/.test(m) ||
    /\bavec\s+mon\s+copain\b/.test(m) ||
    /\bavec\s+ma\s+femme\b/.test(m) ||
    /\bavec\s+mon\s+mari\b/.test(m) ||
    /\bon\s+est\s+plusieurs\b/.test(m) ||
    /\bon\s+est\s+(deux|trois|quatre|cinq|2|3|4|5)\b/.test(m)
  );
}

  function isDirectorRequest(message) {
    const m = normalize(message);

    if (/^(un\s+|une\s+)?(film|films|serie|series|série|séries)\s+de\s+(moins|plus|maximum|max|minimum|min|sous|pas plus|au moins|inferieur|inférieur)\b/.test(m)) {
      return false;
    }

    return (
      /\brealisateur\b|\brealisatrice\b|\brealise par\b|\brealises par\b|\brealisee par\b/.test(m) ||
      /^films?\s+de\s+/.test(m) ||
      /^un\s+film\s+de\s+/.test(m) ||
      /^une\s+serie\s+de\s+/.test(m) ||
      /\bde\s+(christopher|james|peter|ridley|steven|quentin|david|denis|guillermo|george|martin|luc|tim|alfonso|michael|robert|francis|stanley|clint|sam|zack)\b/.test(m)
    );
  }

  function isActorRequest(message) {
    const m = normalize(message);

    if (fishIsCompanionContext(message)) {
      return false;
    }

    return (
      /\bavec\b|\bacteur\b|\bactrice\b|\bcasting\b|\bjoue\b|\bjouent\b/.test(m)
    );
  }
const FISH_CANONICAL_TITLES = {
  "alien": "Alien, le huitième passager",
  "dune": "Dune",
  "avatar": "Avatar",
  "matrix": "Matrix",
  "rocky": "Rocky",
  "rambo": "Rambo",
  "terminator": "Terminator",
  "predator": "Predator",
  "john wick": "John Wick",
  "mission impossible": "Mission: Impossible"
};
  function findBestTitleMatch(records, query) {
    let q = normalize(query);

if (FISH_CANONICAL_TITLES[q]) {
    q = normalize(FISH_CANONICAL_TITLES[q]);
}
    if (!q) return null;

    const queryTokens = tokenize(q);
    if (!queryTokens.length) return null;

    const exact = records.find(record => record.titleNorm === q);
    if (exact) return exact;

    const included = records
      .map(record => {
        let score = 0;

// Titre exactement identique
if (record.titleNorm === q) score += 1000;

// Le titre commence par la requête
if (record.titleNorm.startsWith(q + " ")) score += 400;

// Le titre contient la requête
if (record.titleNorm.includes(q)) score += 100;

// La requête contient tout le titre
if (q.includes(record.titleNorm) && record.titleNorm.length > 3) score += 80;

// Bonus si le premier mot correspond
const firstWord = record.titleNorm.split(" ")[0];
if (firstWord === q) score += 250;

queryTokens.forEach(token => {
  if (record.titleNorm.includes(token)) score += 18;
});

        return { record, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) =>
        b.score - a.score ||
        a.record.title.length - b.record.title.length
      );

    const best = included[0];
    if (!best || best.score < Math.max(18, queryTokens.length * 14)) return null;

    return best.record;
  }

  function findMatchingDirectors(records, query) {
    const q = normalize(query);
    const tokens = tokenize(q);

    if (!tokens.length) return [];

    const found = [];

    records.forEach(record => {
      record.directors.forEach(name => {
        const n = normalize(name);
        const hit =
          n === q ||
          n.includes(q) ||
          tokens.every(token => n.includes(token));

        if (hit) found.push(name);
      });
    });

    return unique(found);
  }

  function findMatchingActors(records, query) {
    const q = normalize(query);
    const tokens = tokenize(q);

    if (!tokens.length) return [];

    const found = [];

    records.forEach(record => {
      record.cast.forEach(name => {
        const n = normalize(name);
        const hit =
          n === q ||
          n.includes(q) ||
          tokens.every(token => n.includes(token));

        if (hit) found.push(name);
      });
    });

    return unique(found);
  }
function findTitleFamilyMatches(records, query) {
  const q = normalize(query);
  if (!q) return [];

  return records.filter(record => {
    return record.titleNorm.includes(q) && record.titleNorm !== q;
  });
}
 function answerDirectorOfTitle(rawMessage, records) {
  const titleQuery = extractTitleQuestion(rawMessage) || removeKnownQuestionWords(rawMessage);
  const record = findBestTitleMatch(records, titleQuery);

  if (record && record.titleNorm === normalize(titleQuery)) {
    if (!record.directors.length) {
      return `Bloup... j’ai bien trouvé ${record.title}, mais le réalisateur n’est pas renseigné dans le JSON.`;
    }

    return `${record.title} a été réalisé par ${record.directors.join(', ')}.`;
  }

  const familyMatches = findTitleFamilyMatches(records, titleQuery);

  if (familyMatches.length > 1) {
    const directors = unique(
      familyMatches.flatMap(item => item.directors)
    );

    if (directors.length === 1) {
      return `J’ai trouvé plusieurs titres correspondant à "${titleQuery}" dans le catalogue, et ils sont tous réalisés par ${directors[0]} :\n\n${familyMatches.slice(0, 8).map(itemLine).join('\n')}`;
    }

    return `J’ai trouvé plusieurs titres correspondant à "${titleQuery}" dans le catalogue, avec des réalisateurs différents. Peux-tu préciser lequel tu cherches ?\n\n${familyMatches.slice(0, 8).map(record => {
      const director = record.directors.length ? record.directors.join(', ') : 'réalisateur non renseigné';
      return `- ${record.title} — ${director}`;
    }).join('\n')}`;
  }

  if (record) {
    if (!record.directors.length) {
      return `Bloup... j’ai bien trouvé ${record.title}, mais le réalisateur n’est pas renseigné dans le JSON.`;
    }

    return `${record.title} a été réalisé par ${record.directors.join(', ')}.`;
  }

  return 'Bloup... je ne trouve pas ce titre dans le catalogue, donc je préfère ne pas inventer son réalisateur.';
}

  function answerCastOfTitle(rawMessage, records) {
    const titleQuery = normalize(rawMessage)
      .replace(/casting de|acteurs de|actrices de|qui joue dans|avec qui dans/g, '')
      .trim();

    const record = findBestTitleMatch(records, titleQuery);

    if (!record) {
      return 'Bloup... je ne trouve pas ce titre dans le catalogue, donc je ne peux pas sortir le casting proprement.';
    }

    if (!record.cast.length) {
      return `Bloup... j’ai trouvé ${record.title}, mais le casting n’est pas renseigné dans le JSON.`;
    }

    return `Dans ${record.title}, le catalogue indique notamment :\n\n${record.cast.slice(0, 8).map(personLine).join('\n')}`;
  }

    function fishIsSimilarityRequest(message) {
    const m = normalize(message);

    return (
      /\bcomme\b/.test(m) ||
      /\bmeme genre que\b/.test(m) ||
      /\bmeme style que\b/.test(m) ||
      /\bdans le meme genre que\b/.test(m) ||
      /\bdans le style de\b/.test(m) ||
      /\bsimilaire a\b/.test(m) ||
      /\bressemble a\b/.test(m) ||
      /\bj ai aime\b/.test(m) ||
      /\bj ai bien aime\b/.test(m) ||
      /\bj ai adore\b/.test(m) ||
      /\bj adore\b/.test(m) ||
      /\bj aime\b/.test(m)
    );
  }

  function fishCleanSimilarityTitleQuery(query) {
    return normalize(query)
      .replace(/\b(tu me proposes quoi|tu proposes quoi|quoi regarder ensuite|je regarde quoi ensuite|tu as quoi|qu est ce que tu proposes|que proposes tu)\b/g, ' ')
      .replace(/\b(dans le meme style|dans le meme genre|du meme genre|similaire|semblable|proche)\b/g, ' ')
      .replace(/\b(de|d)?\s*(moins|maximum|max|pas plus de|sous|inferieur a|plus|au moins|minimum|min)\s*\d+\s*(h|heure|heures|min|minute|minutes)?\b/g, ' ')
      .replace(/\b\d+\s*(h|heure|heures|min|minute|minutes)\s*(au moins|minimum|min|maximum|max)?\b/g, ' ')
      .replace(/\b(pas trop long|court|rapide|long|longue duree|longue durée)\b/g, ' ')
      .replace(/\b(un|une|des|le|la|les|film|films|serie|series|série|séries|manga|anime|truc|quelque chose)\b/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function fishExtractSimilarityTitleQuery(rawMessage) {
    const m = normalize(rawMessage);

    const patterns = [
      /\b(?:dans le meme genre que|meme genre que|dans le meme style que|meme style que|dans le style de|similaire a|semblable a|ressemble a|un truc comme|quelque chose comme|comme)\s+(.+)$/,
      /\b(?:j ai bien aime|j ai aime|j ai adore|j adore|j aime)\s+(.+)$/
    ];

    for (const pattern of patterns) {
      const match = m.match(pattern);

      if (match && match[1]) {
        const cleaned = fishCleanSimilarityTitleQuery(match[1]);

        if (cleaned.length > 1) {
          return cleaned;
        }
      }
    }

    return '';
  }

  function fishNormalizeList(values) {
    return unique(asArray(values).map(normalize).filter(Boolean));
  }

  function fishSharedCount(a, b) {
    const left = fishNormalizeList(a);
    const right = new Set(fishNormalizeList(b));

    return left.filter(value => right.has(value)).length;
  }

  function fishImportantTitleTokens(record) {
    return tokenize(record.titleNorm)
      .filter(token =>
        token.length > 3 &&
        ![
          'film',
          'retour',
          'partie',
          'chapitre',
          'episode',
          'final',
          'version'
        ].includes(token)
      );
  }

  function fishScoreSimilarRecord(candidate, source) {
    if (!candidate || !source || candidate.index === source.index) {
      return -999;
    }

    let score = 0;

    const sharedGenres = fishSharedCount(candidate.genres, source.genres);
    const sharedDirectors = fishSharedCount(candidate.directors, source.directors);
    const sharedCast = fishSharedCount(candidate.cast, source.cast);

    if (candidate.type === source.type) {
      score += 12;
    }

    if (sharedGenres) {
      score += sharedGenres * 45;
    }

    if (sharedDirectors) {
      score += sharedDirectors * 22;
    }

    if (sharedCast) {
      score += Math.min(sharedCast * 7, 35);
    }

    fishImportantTitleTokens(source).forEach(token => {
      if (candidate.titleNorm.includes(token)) {
        score += 24;
      }
    });

    if (candidate.runtime && source.runtime) {
      const diff = Math.abs(candidate.runtime - source.runtime);

      if (diff <= 20) score += 8;
      else if (diff <= 45) score += 4;
    }

    if (candidate.rating) {
      score += candidate.rating * 2;
    }

    if (candidate.premium) {
      score += 1;
    }

    if (score < 25) {
      return -999;
    }

    return score;
  }

  function fishPickSimilarRecords(records, source) {
    return records
      .map(record => ({
        record,
        score: fishScoreSimilarRecord(record, source)
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) =>
        b.score - a.score ||
        b.record.rating - a.record.rating ||
        a.record.title.localeCompare(b.record.title, 'fr')
      )
      .map(entry => entry.record);
  }

  function fishRecordMatchesDurationFilter(record, durationFilter) {
    if (!durationFilter) {
      return true;
    }

    const runtime = fishMovieRuntimeForDisplay(record);

    if (!runtime) {
      return false;
    }

    if (durationFilter.max && runtime > durationFilter.max) {
      return false;
    }

    if (durationFilter.min && runtime < durationFilter.min) {
      return false;
    }

    return true;
  }

  function answerSimilarRequest(rawMessage, records) {
    if (!fishIsSimilarityRequest(rawMessage)) {
      return null;
    }

    const titleQuery = fishExtractSimilarityTitleQuery(rawMessage);

    if (!titleQuery) {
      return null;
    }

    const source = findBestTitleMatch(records, titleQuery);

    if (!source) {
      return `Bloup... je ne trouve pas "${titleQuery}" dans le catalogue, donc je ne peux pas proposer un voisin fiable.`;
    }

    const durationFilter = fishDetectDurationFilter(rawMessage);
    const similarRecords = fishPickSimilarRecords(records, source);

    if (!similarRecords.length) {
      return `J’ai bien trouvé ${source.title}, mais pas assez de titres proches dans le catalogue pour faire une recommandation honnête. Le poisson refuse le cousinage au hasard.`;
    }

    const filteredRecords = durationFilter
      ? similarRecords.filter(record => fishRecordMatchesDurationFilter(record, durationFilter))
      : similarRecords;

    const results = (filteredRecords.length ? filteredRecords : similarRecords).slice(0, 5);

    const intro = durationFilter && filteredRecords.length
      ? `Si tu as aimé ${source.title}, voici des titres proches ${durationFilter.label} :`
      : durationFilter
        ? `J’ai trouvé des titres proches de ${source.title}, mais aucun ${durationFilter.label}. Voici les plus proches malgré tout :`
        : `Si tu as aimé ${source.title}, je te propose :`;

    const comment = durationFilter && !filteredRecords.length
      ? '\n\nJe n’ai pas forcé la durée demandée : mieux vaut une recommandation honnête qu’un poisson qui maquille une baleine en sardine.'
      : '\n\nJe me base surtout sur les genres, le type, et quand le JSON le permet, les proximités de casting ou de réalisation.';

    return `${intro}\n\n${results.map(itemLine).join('\n')}${comment}`;
  }

  function buildIntent(rawMessage, records) {
    const m = normalize(rawMessage);
    const durationMax = parseDurationLimit(rawMessage);
    const requestedType = detectRequestedType(rawMessage);
    const wantedGenres = detectGenres(rawMessage);
    const topics = detectTopics(rawMessage);
    const wantsBest = /meilleur|meilleure|mieux note|bien note|top|note/.test(m);
    const wantsRandom = /surprise|surprend|surprends|surprends moi|surprend moi|hasard|n importe|nimporte|je ne sais pas|quoi regarder/.test(m);
    const wantsPremium = /premium|fauteuil rouge|selection premium|sélection premium/.test(m);
    const wantsKids = /enfant|famille|familial|kids|dessin anime|dessin animé|animation/.test(m);
    const wantsShort = /court|rapide|pas trop long/.test(m);
    const matchedMoods = MOOD_RULES.filter(rule => rule.pattern.test(m));
    const matchedSessionProfiles = SESSION_PROFILE_RULES.filter(rule => rule.pattern.test(m));

matchedSessionProfiles.forEach(profile => {
  if (profile.genres) {
    profile.genres.forEach(genre => {
      if (!wantedGenres.includes(genre)) wantedGenres.push(genre);
    });
  }
});

matchedMoods.forEach(mood => {
  if (mood.genres) {
    mood.genres.forEach(genre => {
      if (!wantedGenres.includes(genre)) wantedGenres.push(genre);
    });
  }
});

        topics.forEach(topic => {
      if (topic.strict) return;

      topic.genres.forEach(genre => {
        if (!wantedGenres.includes(genre)) wantedGenres.push(genre);
      });
    });

    const personQuery = extractPersonRequest(rawMessage);
    const directorRequest = isDirectorRequest(rawMessage);
    const actorRequest = isActorRequest(rawMessage);

        const directorQuery = directorRequest ? (personQuery || '') : '';
    const actorQuery = actorRequest ? (personQuery || '') : '';

    const matchedDirectors = directorRequest ? findMatchingDirectors(records, directorQuery || rawMessage) : [];
    const matchedActors = actorRequest ? findMatchingActors(records, actorQuery || rawMessage) : [];
    const missingActor = actorRequest && !matchedActors.length;
const missingDirector = directorRequest && !matchedDirectors.length;
    const freeTerms = unique([
      ...tokenize(rawMessage),
      ...topics.flatMap(topic => topic.terms).map(normalize)
    ]);

    const hasStrongSignal =
      Boolean(requestedType) ||
      wantedGenres.length > 0 ||
      topics.length > 0 ||
      matchedDirectors.length > 0 ||
      matchedActors.length > 0 ||
      durationMax ||
      wantsBest ||
      wantsRandom ||
      wantsPremium ||
      wantsKids ||
      wantsShort ||
      freeTerms.length > 0;
      fishDebug("Intent détecté", {
  requestedType,
  wantedGenres,
  topics: topics.map(t => t.label),
  matchedActors,
  matchedDirectors,
  wantsPremium,
  wantsBest,
  wantsRandom,
  wantsKids,
  wantsShort,
  durationMax,
  freeTerms
});

    return {
      rawMessage,
      m,
      requestedType,
      wantedGenres,
      topics,
      matchedMoods,
      matchedSessionProfiles,
      durationMax,
      wantsBest,
      wantsRandom,
      wantsPremium,
      wantsKids,
      wantsShort,
      directorQuery,
      actorQuery,
      directorRequest,
      actorRequest,
      
      matchedDirectors,
      matchedActors,
      missingActor,
      missingDirector,
      freeTerms,
      hasStrongSignal
    };
  }
    function recordHasGenre(record, wantedGenre) {
    const wanted = normalize(wantedGenre);
    const aliasEntry = GENRE_ALIASES.find(([genre]) => normalize(genre) === wanted);
    const candidates = unique([
      wantedGenre,
      wanted,
      fishCanonicalGenreKey(wantedGenre),
      ...(aliasEntry ? aliasEntry[1] : [])
    ]);

    return candidates.some(candidate => fishRecordHasGenreKey(record, candidate));
  }

    function recordMatchesTopic(record, topic) {
    const topicTerms = topic.terms.map(normalize);

    if (topic.label === 'zombies') {
      return topicTerms.some(term =>
        record.titleNorm.includes(term) ||
        record.storyNorm.includes(term)
      );
    }

    return topicTerms.some(term =>
      record.titleNorm.includes(term) ||
      record.storyNorm.includes(term) ||
      record.allNorm.includes(term)
    );
  }

  function recordHasDirector(record, names) {
    if (!names.length) return false;

    return names.some(name => {
      const n = normalize(name);
      return record.directorNorm.includes(n);
    });
  }

  function recordHasActor(record, names) {
    if (!names.length) return false;

    return names.some(name => {
      const n = normalize(name);
      return record.castNorm.includes(n);
    });
  }

  function scoreRecord(record, intent) {
    let score = 0;
    const debugReasons = [];

    if (intent.requestedType && record.type !== intent.requestedType) {
      return -999;
    }

    if (intent.requestedType && record.type === intent.requestedType) {
      score += 25;
      debugReasons.push('+25 Type');
    }

    if (intent.durationMax && record.runtime && record.runtime > intent.durationMax) {
      return -999;
    }

    if (intent.durationMax && record.runtime && record.runtime <= intent.durationMax) {
      score += 30;
      debugReasons.push('+30 Durée');
    }

        if (intent.wantsPremium) {
      if (!record.premium) return -999;
      score += 80;
debugReasons.push("+80 Premium");
    }

    if (intent.wantsKids) {
      const hasFamilySignal =
        recordHasGenre(record, 'familial') ||
        recordHasGenre(record, 'comedie') ||
        record.genreNorm.includes('family') ||
        record.genreNorm.includes('famille');

      const hasSoftAnimation =
        recordHasGenre(record, 'animation') &&
        (!record.runtime || record.runtime <= 115) &&
        !recordHasGenre(record, 'thriller') &&
        !recordHasGenre(record, 'horreur') &&
        !recordHasGenre(record, 'crime') &&
        !recordHasGenre(record, 'guerre');

      const hasSoftAdventure =
        recordHasGenre(record, 'aventure') &&
        !recordHasGenre(record, 'thriller') &&
        !recordHasGenre(record, 'horreur') &&
        !recordHasGenre(record, 'crime') &&
        !recordHasGenre(record, 'guerre');

      const isFamily = hasFamilySignal || hasSoftAnimation || hasSoftAdventure;

      if (!isFamily) return -999;
      score += 35;
    }

    if (intent.matchedDirectors.length) {
      if (!recordHasDirector(record, intent.matchedDirectors)) return -999;
      score += 90;
debugReasons.push("+90 Réalisateur");
    }

    if (intent.matchedActors.length) {
      if (!recordHasActor(record, intent.matchedActors)) return -999;
      score += 80;
debugReasons.push("+80 Acteur");
    }

    if (intent.topics.length) {
      const topicHit = intent.topics.some(topic => recordMatchesTopic(record, topic));

      if (!topicHit) return -999;

      score += 55;
    }

    if (intent.wantedGenres.length) {
      const genreHits = intent.wantedGenres.filter(genre => recordHasGenre(record, genre));

      if (!genreHits.length) return -999;

      const bonusGenre = genreHits.length * 30;
score += bonusGenre;
debugReasons.push("+" + bonusGenre + " Genre");
    }
    if (intent.matchedSessionProfiles && intent.matchedSessionProfiles.length) {
  let profileHit = false;

  intent.matchedSessionProfiles.forEach(profile => {
    const profileLabel = normalize(profile.label || '');
    const isFamilyLikeProfile =
      profileLabel.includes('famille') ||
      profileLabel.includes('enfant') ||
      profileLabel.includes('parents');

    if (isFamilyLikeProfile) {
      const hasHardGenre =
        recordHasGenre(record, 'horreur') ||
        recordHasGenre(record, 'thriller') ||
        recordHasGenre(record, 'crime') ||
        recordHasGenre(record, 'guerre');

      const isLongAnimationOnly =
        recordHasGenre(record, 'animation') &&
        !recordHasGenre(record, 'familial') &&
        !recordHasGenre(record, 'comedie') &&
        record.runtime &&
        record.runtime > 115;

      if (hasHardGenre || isLongAnimationOnly) {
        return;
      }
    }

    if (profile.genres && profile.genres.some(genre => recordHasGenre(record, genre))) {
      score += 30;
      profileHit = true;
    }

    if (profile.maxRuntime && record.runtime && record.runtime <= profile.maxRuntime) {
      score += 10;
      profileHit = true;
    }

    if (profile.preferRating && record.rating) {
      score += record.rating * 2;
      profileHit = true;
    }

    if (profile.preferSpectacle) {
      if (
        recordHasGenre(record, 'action') ||
        recordHasGenre(record, 'aventure') ||
        recordHasGenre(record, 'science-fiction')
      ) {
        score += 12;
        profileHit = true;
      }
    }
  });

  if (!profileHit) {
    return -999;
  }
}
if (intent.matchedMoods && intent.matchedMoods.length) {
  let moodHit = false;

  intent.matchedMoods.forEach(mood => {
    if (mood.genres && mood.genres.some(genre => recordHasGenre(record, genre))) {
      score += 35;
      moodHit = true;
    }

    if (mood.terms) {
      mood.terms.forEach(term => {
        if (record.allNorm.includes(normalize(term))) {
          score += 10;
          moodHit = true;
        }
      });
    }

    if (mood.maxRuntime && record.runtime && record.runtime <= mood.maxRuntime) {
      score += 8;
      moodHit = true;
    }
  });

  if (!moodHit) {
    return -999;
  }
}
    const wantsBrainyMood =
      (intent.matchedMoods || []).some(mood => normalize(mood.label || '').includes('intelligent')) ||
      (intent.matchedSessionProfiles || []).some(profile => normalize(profile.label || '').includes('reflechir'));

    if (wantsBrainyMood && recordHasGenre(record, 'horreur')) {
      score -= 45;
      debugReasons.push('-45 Horreur hors réflexion');
    }

    if (intent.wantsShort && record.runtime && record.runtime <= 110) {
      score += 12;
    }

    if (intent.wantsBest) {
      score += record.rating * 4;
    }

    if (record.premium) {
      score += 1;
    }
if (intent.wantedGenres.length) {
  const strictGenreOk = intent.wantedGenres.some(genre => recordHasGenre(record, genre));

  if (!strictGenreOk) {
    return -999;
  }
}
    intent.freeTerms.forEach(term => {
      const t = normalize(term);

      if (!t || t.length < 2) return;

      if (record.titleNorm.includes(t)) score += 24;
      else if (record.directorNorm.includes(t)) score += intent.directorRequest ? 18 : 10;
      else if (record.castNorm.includes(t)) score += intent.actorRequest ? 18 : 8;
      else if (record.genreNorm.includes(t)) score += 8;
      else if (record.storyNorm.includes(t)) score += 2;
    });
    fishDebug(record.title, score, debugReasons.join(" | "));
    return score;
  }

  function pickResults(records, intent) {
      if (intent.missingActor || intent.missingDirector) {
    return [];
  }
    let candidates = records
      .map(record => ({
        record,
        score: scoreRecord(record, intent)
      }))
      .filter(entry => entry.score >= 18);

    if (intent.hasStrongSignal && !intent.wantsRandom) {
      candidates = candidates.filter(entry => entry.score >= 25);
    }

    if (intent.wantsRandom && !candidates.length) {
      candidates = records.map(record => ({
        record,
        score: Math.random() * 20 + record.rating
      }));
    }

    const isPlainDurationRequest =
      Boolean(intent.durationMax || intent.wantsShort) &&
      !intent.wantedGenres.length &&
      !intent.topics.length &&
      !intent.matchedActors.length &&
      !intent.matchedDirectors.length &&
      !intent.wantsPremium &&
      !intent.wantsBest &&
      !intent.matchedMoods.length &&
      !intent.matchedSessionProfiles.length;

    if (intent.wantsBest) {
      candidates.sort((a, b) =>
        b.record.rating - a.record.rating ||
        b.score - a.score ||
        a.record.title.localeCompare(b.record.title, 'fr')
      );
    } else if (intent.wantsRandom || isPlainDurationRequest) {
      candidates = fishShuffle(candidates);
    } else {
      candidates.sort((a, b) =>
        b.score - a.score ||
        a.record.title.localeCompare(b.record.title, 'fr')
      );
    }

    return candidates.slice(0, 5).map(entry => entry.record);
  }

  function explainNoResult(intent) {
        if (intent.missingActor) {
      return 'Bloup... je n’ai trouvé aucun acteur ou actrice correspondant dans le JSON. Je préfère ne pas remplacer la personne demandée par un film vaguement proche.';
    }

    if (intent.missingDirector) {
      return 'Bloup... je n’ai trouvé aucun réalisateur correspondant dans le JSON. Le poisson refuse la filmographie au doigt mouillé.';
    }
    if (intent.directorRequest && intent.freeTerms.length && !intent.matchedDirectors.length && !intent.wantedGenres.length && !intent.topics.length) {
      return 'Bloup... je n’ai trouvé aucun réalisateur correspondant dans le JSON. Je préfère garder mes bulles plutôt que d’inventer une filmographie.';
    }

    if (intent.actorRequest && intent.freeTerms.length && !intent.matchedActors.length) {
      return 'Bloup... je n’ai trouvé aucun acteur ou actrice correspondant dans le JSON.';
    }

    if (intent.wantsKids) {
      return 'Bloup... j’ai vérifié dans le catalogue et je ne trouve pas de vrai titre enfant/famille correspondant.';
    }

    if (intent.wantsPremium) {
      return 'Bloup... je ne trouve pas de titre Premium correspondant à cette demande.';
    }

    if (intent.wantedGenres.length) {
      if (intent.requestedType) {
        const mediaWord = normalize(intent.requestedType) === 'serie' ? 'série' :
          normalize(intent.requestedType) === 'manga' ? 'manga' :
          'film';
        return `Bloup... j’ai vérifié les genres du catalogue, mais je ne trouve pas de ${mediaWord} correspondant assez fiable.`;
      }

      return 'Bloup... j’ai vérifié les genres du catalogue, mais je ne trouve pas de correspondance assez fiable.';
    }

    return 'Bloup... j’ai fouillé le catalogue actuel et je ne trouve rien qui corresponde vraiment. Essaie avec un genre, un acteur, un réalisateur, une durée ou un titre plus précis.';
  }
 
     function buildCatalogueAnswer(rawMessage, catalogue) {
  if (!catalogue.length) {
    return 'Bloup... je n’arrive pas à lire le catalogue pour le moment. Le bocal est branché, mais les bobines font grève.';
  }

    const message = normalize(rawMessage);
  const records = getRecords(catalogue);

  const similarAnswer = answerSimilarRequest(rawMessage, records);
  if (similarAnswer) {
    return similarAnswer;
  }

 // ======================================================
// NOUVEAUTÉS (30 derniers ajouts du JSON)
// ======================================================
if (
  /(quelles?\s+sont\s+les\s+nouveaut[eé]s|nouveaut[eé]s|derniers?\s+ajouts?|quoi\s+de\s+neuf|quoi\s+de\s+nouveau)/.test(message)
) {

  const NB_NOUVEAUTES = 30;
  const NB_REPONSE = 10;

  const derniers = catalogue
  .slice(-NB_NOUVEAUTES)
  .reverse();

if (!derniers.length) {
  return "Bloup... je ne trouve aucune nouveauté dans le catalogue.";
}

// Réutilise le système "Encore"
fishLastResults = [...derniers];
fishLastOffset = Math.min(5, derniers.length);

const visibles = derniers.slice(0, 5);

let reponse = fishPickText([
  "🐠 Bloup ! Les dernières bobines arrivées dans le bocal :\n\n",
  "J’ai regardé les ajouts récents, voici ce qui vient d’arriver :\n\n",
  "Le rayon nouveautés frétille un peu, regarde :\n\n",
  "Voici les derniers titres posés sur l’étagère Planete Stream :\n\n"
]);

reponse += visibles
  .map((film, index) => `${index + 1}. ${film.title}`)
  .join("\n");

const restant = derniers.length - visibles.length;

if (restant > 0) {
  reponse += `\n\n... et ${restant} autre${restant > 1 ? "s" : ""} nouveauté${restant > 1 ? "s" : ""}.`;
  reponse += "\nÉcris simplement « Encore » pour voir la suite.";
}

return reponse;
}
  
    // PRIORITÉ ABSOLUE : Premium
    // On ne regarde QUE item.premium. Surtout pas featured, qui signifie seulement "à la une".
    if (
  /premium|fauteuil rouge|selection premium|sélection premium/.test(message) &&
  !fishDetectRequestedGenre(rawMessage) &&
  !detectGenres(rawMessage).length &&
  !detectTopics(rawMessage).length &&
  !isActorRequest(rawMessage) &&
  !isDirectorRequest(rawMessage)
) {
      const results = catalogue
        .filter(item => {
          if (item.premium === true) return true;

          if (typeof item.premium === 'string') {
            const value = normalize(item.premium);
            return value === 'true' || value === 'oui' || value === 'yes';
          }

          return false;
        })
        .sort((a, b) =>
          String(a.title || '').localeCompare(String(b.title || ''), 'fr')
        )
        .slice(0, 5);

      if (!results.length) {
        return fishPickText([
          'Bloup... je n’ai trouvé aucun film Premium dans le JSON. Et je ne compte pas les titres “à la une” comme Premium.',
          'La salle Premium est vide pour l’instant. Le poisson a même regardé sous les fauteuils.',
          'Aucun vrai Premium dans le JSON. Je ne vais pas confondre tapis rouge et post-it brillant.'
        ]);
      }

      return `${fishPickText(['Direction les fauteuils rouges :', 'La sélection Premium du bocal donne :', 'J’ai ouvert la salle Premium, voici les titres :'])}\n\n${results.map(itemLine).join('\n')}${fishCommentForResults(results, { rawMessage })}`;
    }
    // Questions réalisateur d’un titre
    if (/qui a realise|realisateur de|realisatrice de|realise par qui|c est qui le realisateur|c est qui la realisatrice|quel est le realisateur|quelle est la realisatrice/.test(message)) {
      return answerDirectorOfTitle(rawMessage, records);
    }

    // Questions casting d’un titre
    if (/casting de|acteurs de|actrices de|qui joue dans|avec qui dans/.test(message)) {
      return answerCastOfTitle(rawMessage, records);
    }
    
     const genreAnswer = fishAnswerGenreRequest(rawMessage, catalogue);
  if (genreAnswer) {
    return genreAnswer;
  }

    // Moteur général pour tout le reste
    const intent = buildIntent(rawMessage, records);
    const results = pickResults(records, intent);

    if (!results.length) {
      return explainNoResult(intent);
    }

    let intro = fishRandomIntro(intent, results);

    if (intent.matchedSessionProfiles && intent.matchedSessionProfiles.length && Math.random() < 0.5) {
      intro = `Pour une séance ${intent.matchedSessionProfiles.map(profile => profile.label).join(', ')}, ${fishPickText([
        'je mettrais ça sur le projecteur :',
        'le bocal propose :',
        'voici ma petite sélection :',
        'je partirais plutôt sur :'
      ])}`;
    } else if (intent.matchedMoods && intent.matchedMoods.length && Math.random() < 0.5) {
      intro = `Pour une ambiance ${intent.matchedMoods.map(mood => mood.label).join(', ')}, ${fishPickText([
        'je te propose :',
        'le catalogue remonte :',
        'je sortirais plutôt :',
        'voici ce qui colle le mieux :'
      ])}`;
    } else if (intent.matchedDirectors.length && Math.random() < 0.5) {
      intro = `Pour ${intent.matchedDirectors.join(', ')}, ${fishPickText([
        'le catalogue indique :',
        'j’ai retrouvé :',
        'je trouve :',
        'les bobines disponibles sont :'
      ])}`;
    } else if (intent.matchedActors.length && Math.random() < 0.5) {
      intro = `Avec ${intent.matchedActors.join(', ')}, ${fishPickText([
        'je trouve :',
        'le catalogue me donne :',
        'j’ai repéré :',
        'voici ce qui ressort :'
      ])}`;
    }

    return `${intro}\n\n${results.map(itemLine).join('\n')}${fishCommentForResults(results, { ...intent, rawMessage })}`;
  }
function fishIsFollowUpMessage(rawMessage) {
  const m = normalize(rawMessage);

  return (
    /^(et|puis|sinon|alors)\b/.test(m) ||
    /^(en premium|premium|avec|sans|moins de|plus de|court|rapide|pas trop long|bien note|mieux note|meilleur)/.test(m)
  );
}

function fishShouldRememberMessage(rawMessage) {
  const m = normalize(rawMessage);

  if (!m) return false;

  if (/^(salut|bonjour|hello|coucou|yo|bonsoir)\b/.test(m)) return false;
  if (/merci|thanks/.test(m)) return false;
  if (/qui es tu|t es qui|tu es qui|comment tu t appelles|ton nom|tu t appelles|bubulle/.test(m)) return false;
  if (/aide|help|comment|que peux tu faire/.test(m)) return false;
  if (fishIsOpenAdvicePrompt(rawMessage)) return false;

  return true;
}

function fishApplyConversationMemory(rawMessage) {
  if (!fishLastSearchMessage) {
    return rawMessage;
  }

  if (!fishIsFollowUpMessage(rawMessage)) {
    return rawMessage;
  }

  const m = normalize(rawMessage);

  /*
    "avec Sigourney Weaver" peut être un complément d'une recherche précédente.
    Mais "avec mes parents", "avec les enfants", etc. sont des contextes de séance,
    pas des castings. Et après un contexte de séance, "avec Keanu Reeves" doit repartir
    comme une vraie recherche acteur, pas hériter du canapé précédent.
  */
  if (/^avec\b/.test(m)) {
    if (fishIsCompanionContext(rawMessage)) {
      return rawMessage;
    }

    if (fishBaseSearchMessage && fishIsCompanionContext(fishBaseSearchMessage)) {
      return rawMessage;
    }

    if (fishBaseSearchMessage) {
      return `${fishBaseSearchMessage} ${rawMessage}`;
    }
  }

  return `${fishLastSearchMessage} ${rawMessage}`;
}


  async function localBrain(rawMessage) {
    let clean = rawMessage.trim();
    let message = normalize(clean);
    if (/^(encore|la suite|continue|autre|d'autres|encore !?)$/.test(message)) {
    return fishContinueLastResults();
    }

    if (!message) {
      return 'Bloup ? Même moi j’ai besoin d’au moins une bulle d’information.';
    }

    if (fishIsOpenAdvicePrompt(clean)) {
      fishOpenAdvicePending = true;
      return fishOpenAdviceAnswer();
    }

    if (fishOpenAdvicePending) {
      const resolvedOpenAdvice = fishResolveOpenAdviceFollowUp(clean);

      if (resolvedOpenAdvice) {
        clean = resolvedOpenAdvice;
        message = normalize(clean);
        fishOpenAdvicePending = false;
      } else if (!fishIsOpenAdvicePrompt(clean)) {
        fishOpenAdvicePending = false;
      }
    }

    if (/^(salut|bonjour|hello|coucou|yo|bonsoir)\b/.test(message)) {
      return fishPickText([
        'Bloup ! Je suis réveillé. Enfin, autant qu’un poisson rouge peut l’être sans café.',
        'Salut ! Le projecteur chauffe, le bocal aussi. Qu’est-ce qu’on cherche ?',
        'Bloup ! J’étais en train de compter les bulles, mais je peux travailler.',
        'Bonjour ! Le poisson est en poste, les bobines n’ont qu’à bien se tenir.',
        'Coucou ! Donne-moi un genre, un acteur, une durée ou une envie de séance, et je plonge.'
      ]);
    }

    if (/merci|thanks/.test(message)) {
      return fishPickText([
        'Avec plaisir. Je retourne surveiller les bobines depuis mon bocal.',
        'Toujours partant pour une fouille de catalogue. Bloup de service.',
        'Avec plaisir ! Le poisson range l’épuisette, mais il reste dans le coin.',
        'De rien. J’ajoute une bulle de satisfaction au rapport.',
        'Service rendu, nageoire propre.'
      ]);
    }

    if (/comment tu t appelles|ton nom|tu t appelles|bubulle/.test(message)) {
  return 'Je m’appelle Bubulle. Officiellement, je suis le Projectionniste de Planete Stream : petit poisson, grand catalogue.';
}

if (/qui es tu|t es qui|tu es qui|projectionniste|poisson|ia|intelligence artificielle/.test(message)) {
      return fishPickText([
        'Je suis le Projectionniste de Planete Stream : petit poisson, cerveau JSON. Je vérifie le catalogue avant de répondre, donc je préfère dire “je ne sais pas” plutôt que d’inventer un film sorti d’une palourde.',
        'Je suis Bubulle, le projectionniste local : je fouille le catalogue, je trie les bobines et je refuse les réponses au pif.',
        'Officiellement, je suis un poisson. Officieusement, je suis un moteur de recherche avec des nageoires et un avis sur le pop-corn.',
        'Je suis le gardien du bocal : je lis le JSON, je compare les titres, et quand je ne sais pas, je bloupe honnêtement.',
        'Je suis une petite IA de catalogue déguisée en poisson. C’est absurde, donc forcément assez fiable.'
      ]);
    }

    if (/aide|help|comment|que peux tu faire/.test(message)) {
      return fishPickText([
        'Tu peux me demander un film, une série ou un manga par genre, durée, acteur, réalisateur, Premium, ou une suggestion au hasard. Exemple : “un film de SF de moins de 2h”, “un manga action” ou “qui a réalisé Titanic ?”.',
        'Donne-moi une envie simple : “film d’horreur”, “série drame”, “manga aventure”, “avec Sigourney Weaver”, “moins de 2h”, ou même “surprends-moi”. Je compare avec le catalogue avant de parler.',
        'Je peux filtrer par genre, durée, acteur, réalisateur, Premium, type de média, ambiance de soirée et hasard contrôlé. Le hasard incontrôlé, c’est pour les mouettes.',
        'Essaie une phrase naturelle : “un film pour ce soir”, “un truc pas trop long”, “une série de science-fiction”, “un manga d’action”, “un film avec Keanu Reeves”. Je trie ensuite dans le bocal.',
        'Je suis utile pour trouver quoi regarder sans fouiller tout le catalogue : genre, durée, casting, réalisateur, Premium, nouveautés, ou simple envie de canapé.'
      ]);
    }

    try {
      const catalogue = await loadCatalogue();
const contextualMessage = fishApplyConversationMemory(clean);
const answer = buildCatalogueAnswer(contextualMessage, catalogue);

if (fishShouldRememberMessage(contextualMessage)) {
  const isFollowUp = fishIsFollowUpMessage(clean);
  const isPremiumFollowUp = /^(et\s+)?(en\s+)?premium\b/.test(normalize(clean));

  if (!isFollowUp) {
    fishBaseSearchMessage = clean;
    fishLastSearchMessage = clean;
  } else if (!isPremiumFollowUp) {
    fishLastSearchMessage = contextualMessage;
  }
}

return answer;
    } catch (error) {
      console.error(error);
      return 'Bloup... impossible de lire le catalogue pour le moment. Le poisson garde son calme, mais pas son honneur.';
    }
  }
  async function askFish(message) {
    const clean = message.trim();

    if (!clean) return;

    addMessage('user', clean);
    input.value = '';

    if (brainStatus) {
      brainStatus.textContent = 'Lecture du catalogue...';
    }

    setMode('thinking', { autoReturn: false });

    window.setTimeout(async () => {
      try {
        const answer = await localBrain(clean);

        addMessage('bot', answer);

        if (brainStatus) {
          brainStatus.textContent = catalogueCache
            ? `Catalogue actif · ${catalogueCache.length} titres`
            : 'Cerveau local actif';
        }

        setMode('talking', { duration: 3400 });
      } catch (error) {
        console.error(error);

        addMessage('bot', 'Bloup... impossible de lire le catalogue pour le moment. Le poisson garde son calme, mais pas son honneur.');

        if (brainStatus) {
          brainStatus.textContent = 'Catalogue indisponible';
        }

        setMode('talking', { duration: 3400 });
      }
    }, randomBetween(420, 850));
  }

  widget.addEventListener('click', toggleChat);

  if (chatClose) {
    chatClose.addEventListener('click', closeChat);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    askFish(input.value);
  });

  suggestions.forEach(button => {
    button.addEventListener('click', () => {
      askFish(button.dataset.psFishSuggestion || '');
    });
  });

  widget.addEventListener('mouseenter', () => {
    isHovering = true;
    widget.classList.add('is-awake');
  });

  widget.addEventListener('mouseleave', () => {
    isHovering = false;

    if (mode === 'idle' && !isChatOpen) {
      setTimeout(() => {
        if (!isHovering && !isChatOpen && mode === 'idle') {
          widget.classList.remove('is-awake');
        }
      }, 700);
    }
  });

  widget.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      widget.click();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isChatOpen) {
      closeChat();
    }
  });

  function showIntroOnce() {
    let seen = false;

    try {
      seen = localStorage.getItem(STORAGE_KEY) === '1';
    } catch (error) {}

    if (seen) return;

    setTimeout(() => {
      if (isChatOpen) return;

      widget.classList.add('is-intro', 'is-awake');

      if (tooltip) {
        tooltip.innerHTML = '<strong>Bloup !</strong><span>Je suis le Projectionniste. Clique sur moi si tu cherches un film.</span>';
      }

      setTimeout(() => {
        widget.classList.remove('is-intro');

        if (!isHovering && !isChatOpen && mode === 'idle') {
          widget.classList.remove('is-awake');
        }

        try {
          localStorage.setItem(STORAGE_KEY, '1');
        } catch (error) {}
      }, 6200);
    }, 1700);
  }

  setMode('idle');
  showIntroOnce();
})();