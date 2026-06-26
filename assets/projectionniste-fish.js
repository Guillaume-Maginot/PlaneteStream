(function () {
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
        'rec',
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

  function includesAllTokens(haystack, tokens) {
    if (!tokens.length) return false;
    const h = normalize(haystack);
    return tokens.every(token => h.includes(normalize(token)));
  }

  function includesAnyToken(haystack, tokens) {
    if (!tokens.length) return false;
    const h = normalize(haystack);
    return tokens.some(token => h.includes(normalize(token)));
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

    function isPremiumItem(item) {
    if (!item) return false;

    if (
      item.premium === true ||
      item.isPremium === true ||
      item.is_premium === true ||
      item.featured === true ||
      item.isFeatured === true
    ) {
      return true;
    }

    const fields = [
      item.homeSection,
      item.home_section,
      item.homePlacement,
      item.home_placement,
      item.section,
      item.zone,
      item.badge,
      item.ribbon,
      item.status,
      item.display,
      item.highlight,
      item.homeCategory,
      item.home_category,
      item.category,
      item.categorie,
      item.catégorie,
      item.shelf,
      item.collection
    ];

    if (Array.isArray(item.tags)) {
      fields.push(...item.tags);
    }

    if (Array.isArray(item.labels)) {
      fields.push(...item.labels);
    }

    return fields
      .map(normalize)
      .some(value =>
        value.includes('premium') ||
        value.includes('fauteuil rouge') ||
        value.includes('selection premium') ||
        value.includes('sélection premium')
      );
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
  function formatRuntime(minutes) {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
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
    return `${index + 1}. ${record.title}`;
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

  function isDirectorRequest(message) {
    const m = normalize(message);

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

    return (
      /\bavec\b|\bacteur\b|\bactrice\b|\bcasting\b|\bjoue\b|\bjouent\b/.test(m)
    );
  }

  function findBestTitleMatch(records, query) {
    const q = normalize(query);
    if (!q) return null;

    const queryTokens = tokenize(q);
    if (!queryTokens.length) return null;

    const exact = records.find(record => record.titleNorm === q);
    if (exact) return exact;

    const included = records
      .map(record => {
        let score = 0;

        if (record.titleNorm.includes(q)) score += 100;
        if (q.includes(record.titleNorm) && record.titleNorm.length > 3) score += 80;

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

  function answerDirectorOfTitle(rawMessage, records) {
    const titleQuery = extractTitleQuestion(rawMessage) || removeKnownQuestionWords(rawMessage);
    const record = findBestTitleMatch(records, titleQuery);

    if (!record) {
      return 'Bloup... je ne trouve pas ce titre dans le catalogue, donc je préfère ne pas inventer son réalisateur.';
    }

    if (!record.directors.length) {
      return `Bloup... j’ai bien trouvé ${record.title}, mais le réalisateur n’est pas renseigné dans le JSON.`;
    }

    return `${record.title} a été réalisé par ${record.directors.join(', ')}.`;
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

  function buildIntent(rawMessage, records) {
    const m = normalize(rawMessage);
    const durationMax = parseDurationLimit(rawMessage);
    const requestedType = detectRequestedType(rawMessage);
    const wantedGenres = detectGenres(rawMessage);
    const topics = detectTopics(rawMessage);
    const wantsBest = /meilleur|meilleure|mieux note|bien note|top|note/.test(m);
    const wantsRandom = /surprise|hasard|n importe|nimporte|je ne sais pas|quoi regarder/.test(m);
    const wantsPremium = /premium|fauteuil rouge|selection premium|sélection premium/.test(m);
    const wantsKids = /enfant|famille|familial|kids|dessin anime|dessin animé|animation/.test(m);
    const wantsShort = /court|rapide|pas trop long/.test(m);

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

    return {
      rawMessage,
      m,
      requestedType,
      wantedGenres,
      topics,
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
      freeTerms,
      hasStrongSignal
    };
  }
    function recordHasGenre(record, wantedGenre) {
    const wanted = normalize(wantedGenre);
    const aliasEntry = GENRE_ALIASES.find(([genre]) => normalize(genre) === wanted);
    const variants = unique([
      wantedGenre,
      wanted,
      ...(aliasEntry ? aliasEntry[1] : []),
      wanted === 'familial' ? 'family' : '',
      wanted === 'comedie' ? 'comedy' : '',
      wanted === 'science fiction' ? 'science-fiction' : ''
    ]).map(normalize);

    return variants.some(variant => record.genreNorm.includes(variant));
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

    if (intent.requestedType && record.type !== intent.requestedType) {
      return -999;
    }

    if (intent.durationMax && record.runtime && record.runtime > intent.durationMax) {
      return -999;
    }

    if (intent.wantsPremium && !record.premium) {
      return -999;
    }

    if (intent.wantsKids) {
      const isFamily =
        recordHasGenre(record, 'familial') ||
        recordHasGenre(record, 'animation') ||
        record.genreNorm.includes('family') ||
        record.genreNorm.includes('famille');

      if (!isFamily) return -999;
      score += 35;
    }

    if (intent.matchedDirectors.length) {
      if (!recordHasDirector(record, intent.matchedDirectors)) return -999;
      score += 90;
    }

    if (intent.matchedActors.length) {
      if (!recordHasActor(record, intent.matchedActors)) return -999;
      score += 80;
    }

    if (intent.topics.length) {
      const topicHit = intent.topics.some(topic => recordMatchesTopic(record, topic));

      if (!topicHit) return -999;

      score += 55;
    }

    if (intent.wantedGenres.length) {
      const genreHits = intent.wantedGenres.filter(genre => recordHasGenre(record, genre));

      if (!genreHits.length) return -999;

      score += genreHits.length * 30;
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

    intent.freeTerms.forEach(term => {
      const t = normalize(term);

      if (!t || t.length < 2) return;

      if (record.titleNorm.includes(t)) score += 24;
      else if (record.directorNorm.includes(t)) score += intent.directorRequest ? 18 : 10;
      else if (record.castNorm.includes(t)) score += intent.actorRequest ? 18 : 8;
      else if (record.genreNorm.includes(t)) score += 8;
      else if (record.storyNorm.includes(t)) score += 2;
    });

    return score;
  }

  function pickResults(records, intent) {
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

    if (intent.wantsBest) {
      candidates.sort((a, b) =>
        b.record.rating - a.record.rating ||
        b.score - a.score ||
        a.record.title.localeCompare(b.record.title, 'fr')
      );
    } else if (intent.wantsRandom) {
      candidates.sort(() => Math.random() - 0.5);
    } else {
      candidates.sort((a, b) =>
        b.score - a.score ||
        a.record.title.localeCompare(b.record.title, 'fr')
      );
    }

    return candidates.slice(0, 5).map(entry => entry.record);
  }

  function explainNoResult(intent) {
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
      return 'Bloup... j’ai vérifié les genres du catalogue, mais je ne trouve pas de correspondance assez fiable.';
    }

    return 'Bloup... j’ai fouillé le catalogue actuel et je ne trouve rien qui corresponde vraiment. Essaie avec un genre, un acteur, un réalisateur, une durée ou un titre plus précis.';
  }
  function isZombieRequest(message) {
    return /zombie|zombies|mort vivant|morts vivants|infecte|infectes|infecté|infectés|malnazidos|resident evil|world war z|zombieland|walking dead/i.test(message);
  }

  function isZombieRecord(record) {
    const zombieTerms = [
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
      'rec',
      'overlord'
    ].map(normalize);

    return zombieTerms.some(term =>
      record.titleNorm.includes(term) ||
      record.storyNorm.includes(term)
    );
  }

  function answerZombieRequest(records) {
    const results = records
      .filter(isZombieRecord)
      .sort((a, b) =>
        a.title.localeCompare(b.title, 'fr')
      )
      .slice(0, 5);

    if (!results.length) {
      return 'Bloup... je n’ai pas trouvé de vrai film de zombies dans le JSON. Si le film existe mais que le résumé ne parle pas de zombies, mon bocal ne peut pas le deviner.';
    }

    return `Voici ce que le catalogue indique vraiment côté zombies :\n\n${results.map(itemLine).join('\n')}`;
  }
  function buildCatalogueAnswer(rawMessage, catalogue) {
    if (!catalogue.length) {
      return 'Bloup... je n’arrive pas à lire le catalogue pour le moment. Le bocal est branché, mais les bobines font grève.';
    }

    const records = getRecords(catalogue);
    const normalizedMessage = normalize(rawMessage);

        if (isZombieRequest(rawMessage)) {
      return answerZombieRequest(records);
    }

    if (/qui a realise|realisateur de|realisatrice de|realise par qui|c est qui le realisateur|c est qui la realisatrice|quel est le realisateur|quelle est la realisatrice/.test(normalizedMessage)) {
      return answerDirectorOfTitle(rawMessage, records);
    }

    if (/casting de|acteurs de|actrices de|qui joue dans|avec qui dans/.test(normalizedMessage)) {
      return answerCastOfTitle(rawMessage, records);
    }

        const intent = buildIntent(rawMessage, records);

    if (
      intent.directorRequest &&
      intent.directorQuery &&
      !intent.matchedDirectors.length &&
      !intent.wantedGenres.length &&
      !intent.topics.length
    ) {
      return `Bloup... je n’ai pas trouvé ${intent.directorQuery} comme réalisateur dans le JSON. Je préfère ne rien proposer plutôt que de te ressortir Peter Jackson avec une moustache de Nolan.`;
    }

    const results = pickResults(records, intent);

    if (!results.length) {
      return explainNoResult(intent);
    }

    let intro = 'J’ai trouvé ça dans le catalogue Planete Stream :';

    if (results.length === 1) {
      intro = 'J’ai trouvé une excellente correspondance :';
    } else if (intent.matchedDirectors.length) {
      intro = `Voici ce que le catalogue indique pour ${intent.matchedDirectors.join(', ')} :`;
    } else if (intent.matchedActors.length) {
      intro = `Voici ce que le catalogue indique avec ${intent.matchedActors.join(', ')} :`;
    } else if (intent.wantsBest) {
      intro = 'Voici les titres les mieux placés dans le catalogue :';
    } else if (intent.wantsRandom) {
      intro = 'Le bocal a remué les bobines, voici une suggestion :';
    } else if (results.length <= 5) {
      intro = 'Voici les titres qui correspondent le mieux :';
    }

    return `${intro}\n\n${results.map(itemLine).join('\n')}`;
  }

  async function localBrain(rawMessage) {
    const clean = rawMessage.trim();
    const message = normalize(clean);

    if (!message) {
      return 'Bloup ? Même moi j’ai besoin d’au moins une bulle d’information.';
    }

    if (/^(salut|bonjour|hello|coucou|yo|bonsoir)\b/.test(message)) {
      return 'Bloup ! Je suis réveillé. Enfin, autant qu’un poisson rouge peut l’être sans café.';
    }

    if (/merci|thanks/.test(message)) {
      return 'Avec plaisir. Je retourne surveiller les bobines depuis mon bocal.';
    }

    if (/qui es tu|t es qui|tu es qui|projectionniste|poisson|ia|intelligence artificielle/.test(message)) {
      return 'Je suis le Projectionniste de Planete Stream : petit poisson, cerveau JSON. Je vérifie le catalogue avant de répondre, donc je préfère dire “je ne sais pas” plutôt que d’inventer un film sorti d’une palourde.';
    }

    if (/aide|help|comment|que peux tu faire/.test(message)) {
      return 'Tu peux me demander un film par genre, durée, acteur, réalisateur, note, Premium, ou une suggestion au hasard. Exemple : “un film de SF de moins de 2h”, “un film avec Sigourney Weaver” ou “qui a réalisé Titanic ?”.';
    }

    try {
      const catalogue = await loadCatalogue();
      return buildCatalogueAnswer(clean, catalogue);
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