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

  const states = {
    idle: {
      pose: null,
      html: '<strong>Bloup !</strong><span>Clique si tu veux parler au Projectionniste.</span>'
    },
    thinking: {
      pose: 'thinking',
      html: '<strong>Bloup...</strong><span>Je fouille dans les bobines du bocal.</span>'
    },
    talking: {
      pose: 'talking',
      html: '<strong>Verdict du bocal</strong><span>J’ai quelque chose à te dire.</span>'
    },
    happy: {
      pose: 'talking',
      html: '<strong>Bloup bloup !</strong><span>Le Projectionniste est réveillé.</span>'
    }
  };

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function showPose(poseName) {
    poses.forEach(img => img.classList.toggle('is-active', img.dataset.pose === poseName));
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
      if (Math.random() < .55) {
        widget.classList.add('is-awake');
        setTimeout(() => {
          if (!isHovering && !isChatOpen && mode === 'idle') widget.classList.remove('is-awake');
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
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (error) {}
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

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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

  function normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  let cataloguePromise = null;
  let catalogueCache = null;

  function getCatalogueUrl() {
    const path = window.location.pathname || '';
    const prefix = path.includes('/') && !path.endsWith('/') ? '' : '';
    return `${prefix}data/catalogue.json`;
  }

  async function loadCatalogue() {
    if (Array.isArray(catalogueCache)) return catalogueCache;
    if (!cataloguePromise) {
      cataloguePromise = fetch(getCatalogueUrl(), { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error(`Catalogue introuvable (${response.status})`);
          return response.json();
        })
        .then(data => {
          catalogueCache = Array.isArray(data) ? data : [];
          return catalogueCache;
        });
    }
    return cataloguePromise;
  }

  function getPersonNames(list) {
    if (!Array.isArray(list)) return [];
    return list.map(person => typeof person === 'string' ? person : person?.name).filter(Boolean);
  }

  function getRuntimeMinutes(item) {
    if (Number(item.runtime)) return Number(item.runtime);
    if (typeof item.runtime === 'string') {
      const hours = item.runtime.match(/(\d+)\s*h/);
      const mins = item.runtime.match(/(\d+)\s*min/);
      return (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
    }
    return 0;
  }

  function formatRuntime(minutes) {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
  }

  function mediaLabel(item) {
    const value = normalize(item.type || item.mediaType || item.category || '');
    if (value.includes('serie') || value.includes('tv')) return 'Série';
    if (value.includes('manga') || value.includes('anime')) return 'Manga';
    return 'Film';
  }

  function itemUrl(item) {
    if (!item?.slug) return '';
    const label = normalize(item.type || item.mediaType || item.category || '');
    if (label.includes('serie') || label.includes('tv')) return `saga.html?slug=${encodeURIComponent(item.slug)}`;
    return `detail.html?slug=${encodeURIComponent(item.slug)}`;
  }

  function itemLine(item, index) {
    const bits = [];
    const year = item.year || (item.releaseDate || '').slice(0, 4);
    const runtime = formatRuntime(getRuntimeMinutes(item));
    const rating = Number(item.rating || 0);
    bits.push(mediaLabel(item));
    if (year) bits.push(String(year));
    if (runtime) bits.push(runtime);
    if (rating) bits.push(`⭐ ${rating.toFixed(1).replace('.', ',')}/10`);
    const genres = Array.isArray(item.genres) ? item.genres.slice(0, 2).join(', ') : '';
    const link = itemUrl(item);
    return `${index + 1}. ${item.title || item.originalTitle || 'Titre sans nom'} (${bits.join(' · ')})${genres ? ` — ${genres}` : ''}${link ? `\n   ${link}` : ''}`;
  }

  function parseDurationLimit(message) {
    const less = /(moins de|max(?:imum)?|pas plus de|sous)\s*(\d+)\s*(h|heure|heures|min|minutes)?/i.exec(message);
    if (!less) return null;
    const value = Number(less[2]);
    const unit = less[3] || '';
    return /min/.test(unit) ? value : value * 60;
  }

  function detectIntent(message) {
    const m = normalize(message);
    const durationMax = parseDurationLimit(message);
    const wantsBest = /meilleur|mieux note|bien note|note|top/.test(m);
    const wantsRandom = /surprise|hasard|n importe|je ne sais pas|quoi regarder/.test(m);
    const wantsPremium = /premium|fauteuil rouge|selection premium/.test(m);
    const wantsKids = /enfant|famille|familial|kids|dessin anime|animation/.test(m);
    const wantsShort = /court|rapide|pas trop long/.test(m);
    const requestedType = /\bserie|series\b/.test(m) ? 'serie' : /manga|anime/.test(m) ? 'manga' : /\bfilm|films\b/.test(m) ? 'film' : null;

    const genreMap = [
      ['science-fiction', ['science fiction', 'sf', 'sci fi', 'sci-fi']],
      ['horreur', ['horreur', 'peur', 'gore', 'epouvante']],
      ['thriller', ['thriller', 'suspense']],
      ['action', ['action', 'baston']],
      ['aventure', ['aventure']],
      ['comédie', ['comedie', 'drôle', 'drole', 'humour', 'fun']],
      ['drame', ['drame', 'triste']],
      ['crime', ['crime', 'policier', 'enquete', 'enquête']],
      ['mystère', ['mystere', 'mystère']],
      ['romance', ['romance', 'amour']],
      ['fantastique', ['fantastique', 'fantasy']],
      ['animation', ['animation', 'dessin anime', 'enfant', 'famille', 'familial']]
    ];
    const wantedGenres = genreMap.filter(([, keys]) => keys.some(key => m.includes(key))).map(([genre]) => genre);

    const stop = new Set('je tu il elle on nous vous ils elles un une des de du le la les l d dans avec sans pour sur sous par au aux ce cet cette ces qui que quoi quel quelle quels quelles est suis veux voudrais cherche recherche propose conseille montre moi as tu avez moins plus pas trop tres très film films serie series manga acteur actrice realisateur realisatrice genre duree heure heures min minutes'.split(' '));
    const terms = m.split(/[^a-z0-9]+/).filter(word => word.length > 2 && !stop.has(word));

    return { m, durationMax, wantsBest, wantsRandom, wantsPremium, wantsKids, wantsShort, requestedType, wantedGenres, terms };
  }

  function scoreItem(item, intent) {
    let score = 0;
    const title = normalize(`${item.title || ''} ${item.originalTitle || ''}`);
    const genres = (item.genres || []).map(normalize);
    const director = normalize(item.director || '');
    const cast = normalize(getPersonNames(item.cast).join(' '));
    const overview = normalize(`${item.overview || ''} ${item.tagline || ''}`);
    const type = mediaLabel(item).toLowerCase();
    const haystack = `${title} ${genres.join(' ')} ${director} ${cast} ${overview}`;
    const runtime = getRuntimeMinutes(item);

    if (intent.requestedType) {
      if (type.toLowerCase().includes(intent.requestedType === 'serie' ? 'série' : intent.requestedType)) score += 12;
      else return -999;
    }

    if (intent.durationMax && runtime && runtime > intent.durationMax) return -999;
    if (intent.wantsShort && runtime && runtime <= 110) score += 5;
    if (intent.wantsPremium) item.premium ? score += 14 : score -= 6;

    if (intent.wantsKids) {
      const familyHit = genres.some(g => ['animation', 'familial', 'famille', 'family'].some(key => g.includes(key)));
      if (familyHit) score += 20;
      else score -= 10;
    }

    for (const wanted of intent.wantedGenres) {
      if (genres.some(g => g.includes(normalize(wanted)))) score += 14;
      else score -= 2;
    }

    for (const term of intent.terms) {
      if (title.includes(term)) score += 12;
      else if (cast.includes(term)) score += 9;
      else if (director.includes(term)) score += 8;
      else if (genres.some(g => g.includes(term))) score += 7;
      else if (overview.includes(term)) score += 2;
      else if (haystack.includes(term)) score += 1;
    }

    if (intent.wantsBest) score += Number(item.rating || 0);
    if (item.premium) score += .8;
    return score;
  }

  function pickResults(catalogue, intent) {
    let candidates = catalogue
      .map(item => ({ item, score: scoreItem(item, intent) }))
      .filter(entry => entry.score > 0);

    if (intent.wantsRandom && !candidates.length) {
      candidates = catalogue.map(item => ({ item, score: Math.random() * 10 + Number(item.rating || 0) }));
    }

    if (intent.wantsBest) {
      candidates.sort((a, b) => Number(b.item.rating || 0) - Number(a.item.rating || 0) || b.score - a.score);
    } else if (intent.wantsRandom) {
      candidates.sort(() => Math.random() - .5);
    } else {
      candidates.sort((a, b) => b.score - a.score || String(a.item.title || '').localeCompare(String(b.item.title || ''), 'fr'));
    }

    return candidates.slice(0, 5).map(entry => entry.item);
  }

  function buildCatalogueAnswer(rawMessage, catalogue) {
    const intent = detectIntent(rawMessage);
    const results = pickResults(catalogue, intent);

    if (!catalogue.length) {
      return 'Bloup... je n’arrive pas à lire le catalogue pour le moment. Le bocal est branché, mais les bobines font grève.';
    }

    if (!results.length) {
      if (intent.wantsKids) {
        return 'Bloup... j’ai vérifié dans le catalogue et je ne trouve pas de vrai film enfant/famille correspondant. Je préfère être honnête plutôt que d’inventer un titre qui n’est pas sur Planete Stream.';
      }
      return 'Bloup... j’ai fouillé le catalogue actuel et je ne trouve rien qui corresponde vraiment. Essaie avec un genre, un acteur, une durée ou un titre plus précis.';
    }

    const intro = intent.wantsRandom
      ? 'J’ai secoué le bocal et voilà ce qui remonte du catalogue :'
      : intent.wantsBest
        ? 'Voici les meilleures pistes que je trouve dans le catalogue :'
        : 'J’ai trouvé ça dans le catalogue Planete Stream :';

    return `${intro}\n\n${results.map(itemLine).join('\n\n')}`;
  }

  async function localBrain(rawMessage) {
    const message = normalize(rawMessage.trim());

    if (!message) return 'Bloup ? Même moi j’ai besoin d’au moins une bulle d’information.';

    if (/^(salut|bonjour|hello|coucou|yo|bonsoir)\b/.test(message)) {
      return 'Bloup ! Je suis réveillé. Enfin, autant qu’un poisson rouge peut l’être sans café.';
    }

    if (/merci|thanks/.test(message)) {
      return 'Avec plaisir. Je retourne surveiller les bobines depuis mon bocal.';
    }

    if (/qui es tu|t es qui|tu es qui|projectionniste|poisson|ia/.test(message)) {
      return 'Je suis le Projectionniste de Planete Stream : petit poisson, futur gros cerveau. Je lis maintenant le catalogue JSON, donc je propose uniquement des titres présents dans le site. Zéro hallucination aquatique.';
    }

    if (/aide|help|comment|que peux tu faire/.test(message)) {
      return 'Tu peux me demander un film par genre, durée, acteur, réalisateur, note, Premium, ou même une suggestion au hasard. Exemple : “un film de SF de moins de 2h” ou “un film avec Tom Cruise”.';
    }

    if (/catalogue|json|film|films|serie|series|manga|acteur|actrice|realisateur|realisatrice|genre|duree|moins de|sf|science fiction|comedie|horreur|thriller|action|aventure|premium|enfant|famille|familial|kids|dessin anime|animation|surprise|hasard|quoi regarder|meilleur|mieux note|note|top|court|rapide/.test(message)) {
      const catalogue = await loadCatalogue();
      return buildCatalogueAnswer(rawMessage, catalogue);
    }

    // Dernière tentative : si la phrase contient un titre, un acteur ou un nom propre présent dans le JSON.
    try {
      const catalogue = await loadCatalogue();
      const answer = buildCatalogueAnswer(rawMessage, catalogue);
      if (!answer.startsWith('Bloup... j’ai fouillé')) return answer;
    } catch (error) {}

    return 'Bloup... je sèche un peu. Essaie avec un titre, un acteur, un genre ou une envie de film. Là, mon bocal manque d’indices.';
  }

  async function askFish(message) {
    const clean = message.trim();
    if (!clean) return;

    addMessage('user', clean);
    input.value = '';
    if (brainStatus) brainStatus.textContent = 'Lecture du catalogue...';
    setMode('thinking', { autoReturn: false });

    window.setTimeout(async () => {
      try {
        const answer = await localBrain(clean);
        addMessage('bot', answer);
        if (brainStatus) brainStatus.textContent = catalogueCache ? `Catalogue actif · ${catalogueCache.length} titres` : 'Cerveau local actif';
        setMode('talking', { duration: 3400 });
      } catch (error) {
        console.error(error);
        addMessage('bot', 'Bloup... impossible de lire le catalogue pour le moment. Le poisson garde son calme, mais pas son honneur.');
        if (brainStatus) brainStatus.textContent = 'Catalogue indisponible';
        setMode('talking', { duration: 3400 });
      }
    }, randomBetween(420, 850));
  }

  widget.addEventListener('click', toggleChat);

  if (chatClose) chatClose.addEventListener('click', closeChat);

  form.addEventListener('submit', event => {
    event.preventDefault();
    askFish(input.value);
  });

  suggestions.forEach(button => {
    button.addEventListener('click', () => askFish(button.dataset.psFishSuggestion || ''));
  });

  widget.addEventListener('mouseenter', () => {
    isHovering = true;
    widget.classList.add('is-awake');
  });

  widget.addEventListener('mouseleave', () => {
    isHovering = false;
    if (mode === 'idle' && !isChatOpen) {
      setTimeout(() => {
        if (!isHovering && !isChatOpen && mode === 'idle') widget.classList.remove('is-awake');
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
    if (event.key === 'Escape' && isChatOpen) closeChat();
  });

  function showIntroOnce() {
    let seen = false;
    try { seen = localStorage.getItem(STORAGE_KEY) === '1'; } catch (error) {}
    if (seen) return;

    setTimeout(() => {
      if (isChatOpen) return;
      widget.classList.add('is-intro', 'is-awake');
      if (tooltip) tooltip.innerHTML = '<strong>Bloup !</strong><span>Je suis le Projectionniste. Clique sur moi si tu cherches un film.</span>';
      setTimeout(() => {
        widget.classList.remove('is-intro');
        if (!isHovering && !isChatOpen && mode === 'idle') widget.classList.remove('is-awake');
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (error) {}
      }, 6200);
    }, 1700);
  }

  setMode('idle');
  showIntroOnce();
})();
