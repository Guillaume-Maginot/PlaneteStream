let draft = [];
let selectedItem = null;
let editingIndex = -1;
let catalogueMissingMode = false;
let catalogueBubbleMissingMode = false;
let bubbleBatchShouldStop = false;
let bubbleBatchRunning = false;

const output = document.querySelector('#jsonOutput');
const results = document.querySelector('#results');
const preview = document.querySelector('#selectedPreview');

const queryInput = document.querySelector('#query');
const mediaTypeSelect = document.querySelector('#mediaType');
const searchBtn = document.querySelector('#searchBtn');
const downloadBtn = document.querySelector('#downloadBtn');
const copyBtn = document.querySelector('#copyBtn');
const resetBtn = document.querySelector('#resetBtn');
const clearBtn = document.querySelector('#clearBtn');
const sectionSelect = document.querySelector('#sectionSelect');
const featuredSelect = document.querySelector('#featuredSelect');
const premiumSelect = document.querySelector('#premiumSelect');
const homeFeaturedSelect = document.querySelector('#homeFeaturedSelect');
const cinemaReleaseSelect = document.querySelector('#cinemaReleaseSelect');
const cinemaReleaseOrderInput = document.querySelector('#cinemaReleaseOrderInput');
const cinemaReleaseFeaturedSelect = document.querySelector('#cinemaReleaseFeaturedSelect');
const genreSelect = document.querySelector('#genreSelect');
const catalogueSearch = document.querySelector('#catalogueSearch');
const catalogueTypeFilter = document.querySelector('#catalogueTypeFilter');
const catalogueSort = document.querySelector('#catalogueSort');
const showAllEmbedsBtn = document.querySelector('#showAllEmbedsBtn');
const showMissingEmbedsBtn = document.querySelector('#showMissingEmbedsBtn');
const showMissingBubbleBtn = document.querySelector('#showMissingBubbleBtn');
const generateBubbleReasonsBtn = document.querySelector('#generateBubbleReasonsBtn');
const generateBubbleAdviceBtn = document.querySelector('#generateBubbleAdviceBtn');
const generateBubblePaceBtn = document.querySelector('#generateBubblePaceBtn');
const generateAllBubbleReasonsBtn = document.querySelector('#generateAllBubbleReasonsBtn');
const stopBubbleBatchBtn = document.querySelector('#stopBubbleBatchBtn');
const catalogueEmbedStatus = document.querySelector('#catalogueEmbedStatus');
const catalogueBubbleStatus = document.querySelector('#catalogueBubbleStatus');
const catalogueList = document.querySelector('#catalogueList');
const catalogueEditorGrid = document.querySelector('.catalogue-editor-grid');
const catalogueCount = document.querySelector('#catalogueCount');
const editPanel = document.querySelector('#editPanel');
const seriesEpisodeManager = document.querySelector('#seriesEpisodeManager');
const seriesEpisodeList = document.querySelector('#seriesEpisodeList');
const collapseSeasonsBtn = document.querySelector('#collapseSeasonsBtn');
const saveEditBtn = document.querySelector('#saveEditBtn');
const cancelEditBtn = document.querySelector('#cancelEditBtn');
const topCancelEditBtn = document.querySelector('#topCancelEditBtn');
const editFields = {
  title: document.querySelector('#editTitle'),
  year: document.querySelector('#editYear'),
  category: document.querySelector('#editCategory'),
  featured: document.querySelector('#editFeatured'),
  premium: document.querySelector('#editPremium'),
  homeFeatured: document.querySelector('#editHomeFeatured'),
  cinemaRelease: document.querySelector('#editCinemaRelease'),
  cinemaReleaseOrder: document.querySelector('#editCinemaReleaseOrder'),
  cinemaReleaseFeatured: document.querySelector('#editCinemaReleaseFeatured'),
  genres: document.querySelector('#editGenres'),
  rating: document.querySelector('#editRating'),
  poster: document.querySelector('#editPoster'),
  backdrop: document.querySelector('#editBackdrop'),
  trailer: document.querySelector('#editTrailer'),
  videoEmbed: document.querySelector('#editVideoEmbed'),
  slug: document.querySelector('#editSlug'),
  overview: document.querySelector('#editOverview'),
  reasonVoyager: document.querySelector('#editReasonVoyager'),
  reasonFrissonner: document.querySelector('#editReasonFrissonner'),
  reasonRire: document.querySelector('#editReasonRire'),
  reasonFatigue: document.querySelector('#editReasonFatigue'),
  reasonReflechir: document.querySelector('#editReasonReflechir'),
  reasonSpectacle: document.querySelector('#editReasonSpectacle'),
  reasonEmotion: document.querySelector('#editReasonEmotion'),
  reasonFamille: document.querySelector('#editReasonFamille'),
  projectionnisteAdvice: document.querySelector('#editProjectionnisteAdvice'),
  bubblePace: document.querySelector('#editBubblePace'),
  bubbleComplexity: document.querySelector('#editBubbleComplexity'),
  bubbleSpectacle: document.querySelector('#editBubbleSpectacle'),
  bubbleViolence: document.querySelector('#editBubbleViolence'),
  bubbleHumour: document.querySelector('#editBubbleHumour'),
  bubbleEmotion: document.querySelector('#editBubbleEmotion'),
  bubbleFamily: document.querySelector('#editBubbleFamily')
};

if (document.body?.classList.contains('admin-locked')) {
  window.addEventListener('ps:admin-access-granted', init, {once:true});
} else {
  init();
}

async function init() {
  try {
    const saved = localStorage.getItem('catalogueDraft');

    if (saved) {
      draft = JSON.parse(saved);
    } else {
      const res = await fetch('data/catalogue.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('catalogue.json introuvable');
      draft = await res.json();
    }
  } catch (err) {
    console.error(err);
    draft = [];
  }

  syncOutput();
  resetGenreSelect();

  searchBtn?.addEventListener('click', searchTmdb);
  queryInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchTmdb();
  });
  mediaTypeSelect?.addEventListener('change', () => {
    if (mediaTypeSelect.value === 'manga' && sectionSelect) sectionSelect.value = 'manga';
  });
  downloadBtn?.addEventListener('click', downloadJson);
  copyBtn?.addEventListener('click', copyJson);
  resetBtn?.addEventListener('click', resetDraft);
  clearBtn?.addEventListener('click', clearSelection);
  catalogueSearch?.addEventListener('input', () => {
    catalogueMissingMode = false;
    catalogueBubbleMissingMode = false;
    updateCatalogueFilterButtons();
    renderCatalogueList();
  });
  catalogueTypeFilter?.addEventListener('change', renderCatalogueList);
  catalogueSort?.addEventListener('change', renderCatalogueList);
  showAllEmbedsBtn?.addEventListener('click', () => {
    catalogueMissingMode = false;
    catalogueBubbleMissingMode = false;
    updateCatalogueFilterButtons();
    renderCatalogueList();
  });
  showMissingEmbedsBtn?.addEventListener('click', () => {
    catalogueMissingMode = true;
    catalogueBubbleMissingMode = false;
    if (catalogueSearch) catalogueSearch.value = '';
    updateCatalogueFilterButtons();
    renderCatalogueList();
  });
  showMissingBubbleBtn?.addEventListener('click', () => {
    catalogueMissingMode = false;
    catalogueBubbleMissingMode = true;
    if (catalogueSearch) catalogueSearch.value = '';
    updateCatalogueFilterButtons();
    renderCatalogueList();
  });
  generateBubbleReasonsBtn?.addEventListener('click', generateBubbleReasonsForCurrentEntry);
  generateBubbleAdviceBtn?.addEventListener('click', generateBubbleAdviceForCurrentEntry);
  generateBubblePaceBtn?.addEventListener('click', generateBubblePaceForCurrentEntry);
  generateAllBubbleReasonsBtn?.addEventListener('click', generateMissingBubbleReasonsBatch);
  stopBubbleBatchBtn?.addEventListener('click', () => {
    bubbleBatchShouldStop = true;
    showMessage('Arrêt demandé. Bubulle termine la fiche en cours puis range les bobines.');
  });
  saveEditBtn?.addEventListener('click', saveEditedItem);
  cancelEditBtn?.addEventListener('click', closeEditor);
  topCancelEditBtn?.addEventListener('click', closeEditor);
  collapseSeasonsBtn?.addEventListener('click', toggleAllSeasons);

  renderCatalogueList();
}

function getCatalogueMediaType(entry = {}) {
  const rawMediaType = String(entry.mediaType || entry.media_type || '').toLowerCase();
  const rawType = String(entry.type || '').toLowerCase();
  const rawCategory = String(entry.category || '').toLowerCase();

  if (rawMediaType === 'manga' || rawType === 'manga' || rawCategory === 'manga') return 'manga';
  if (rawMediaType === 'tv' || rawType === 'serie') return 'tv';
  if (rawMediaType === 'movie' || rawType === 'film') return 'movie';
  return rawMediaType || 'movie';
}

function getTmdbSearchType(mediaType) {
  return mediaType === 'manga' ? 'tv' : mediaType;
}

function getMediaLabel(entry = {}) {
  const type = getCatalogueMediaType(entry);
  if (type === 'manga') return 'Manga';
  if (type === 'tv') return 'Série';
  return 'Film';
}

function prepareItemForSelectedMediaType(item, selectedMediaType) {
  const normalized = normalizeTmdbItem(item);

  if (selectedMediaType === 'manga') {
    return {
      ...normalized,
      type: 'manga',
      mediaType: 'manga'
    };
  }

  return normalized;
}

async function searchTmdb() {
  const query = queryInput?.value.trim() || '';
  const mediaType = mediaTypeSelect?.value || 'all';
  const tmdbSearchType = getTmdbSearchType(mediaType);

  if (!query) {
    showMessage('Entre un titre avant de lancer la recherche.');
    queryInput?.focus();
    return;
  }

  results.innerHTML = '<div class="admin-empty">Recherche en cours… Exploration du catalogue.</div>';

  try {
    const res = await fetch(
      `/.netlify/functions/tmdb-search?query=${encodeURIComponent(query)}&type=${encodeURIComponent(mediaType)}`
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || data.details || 'Réponse TMDb invalide');
    }

    const filteredResults = filterByMediaType(data.results || [], mediaType);
    results.innerHTML = '';

    if (!filteredResults.length) {
      results.innerHTML = '<div class="admin-empty">Aucun résultat trouvé. Essaie avec un autre titre ou une orthographe différente.</div>';
      return;
    }

    filteredResults
      .slice(0, 8)
      .forEach(item => results.appendChild(resultCard(prepareItemForSelectedMediaType(item, mediaType))));
  } catch (err) {
    console.error(err);
    results.innerHTML = `
      <div class="admin-empty">
        <strong>La recherche n’a pas répondu.</strong><br>
        Vérifie la configuration de la recherche côté hébergement, puis réessaie.<br>
        <small>${escapeHtml(err.message)}</small>
      </div>
    `;
  }
}

function filterByMediaType(items, mediaType) {
  if (mediaType === 'movie') return items.filter(item => item.mediaType === 'movie' || item.type === 'film');
  if (mediaType === 'tv' || mediaType === 'manga') return items.filter(item => item.mediaType === 'tv' || item.type === 'serie');
  return items;
}

function resultCard(item) {
  const el = document.createElement('article');
  el.className = 'tmdb-result';

  const exists = isDuplicate(item);
  const poster = item.poster || '';
  const overview = item.overview ? `${item.overview.slice(0, 145)}${item.overview.length > 145 ? '…' : ''}` : 'Résumé absent';

  el.innerHTML = `
    ${poster ? `<img src="${escapeAttr(poster)}" alt="Affiche ${escapeAttr(item.title)}">` : '<div class="tmdb-poster-placeholder">Sans affiche</div>'}
    <div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.year || 'Année inconnue')} · ${escapeHtml(item.genres.join(', ') || 'Genres à compléter')}</p>
      <p>${escapeHtml(overview)}</p>
      <div class="tmdb-actions">
        <button class="ghost" type="button" data-action="preview">Aperçu</button>
        <button class="primary" type="button" data-action="add">${exists ? 'Déjà présent' : 'Ajouter au catalogue'}</button>
      </div>
    </div>
  `;

  el.querySelector('[data-action="preview"]')?.addEventListener('click', () => selectItem(item));
  el.querySelector('[data-action="add"]')?.addEventListener('click', () => addItem(item));
  el.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    selectItem(item);
  });

  if (exists) el.classList.add('is-duplicate');
  return el;
}

function selectItem(item) {
  selectedItem = normalizeTmdbItem(item);
  updateGenreSelect(selectedItem);
  updatePreview(selectedItem);
}

function addItem(item) {
  const normalized = normalizeTmdbItem(item);
  selectItem(normalized);

  const duplicate = findDuplicate(normalized);
  if (duplicate) {
    const confirmAdd = confirm(
      `“${normalized.title}” semble déjà exister dans le catalogue.\n\nTu veux quand même l’ajouter ?`
    );
    if (!confirmAdd) return;
  }

  const entry = buildCatalogueEntry(normalized);
  draft.push(entry);
  sortDraft();
  syncOutput();
  renderCatalogueList();
  showMessage(`“${entry.title}” ajouté au catalogue.`);
  refreshVisibleResults();
}

function buildCatalogueEntry(item) {
  const selectedGenre = genreSelect?.value || '';
  const genres = selectedGenre
    ? [selectedGenre, ...item.genres.filter(genre => genre !== selectedGenre)]
    : item.genres;

  return {
    title: item.title,
    slug: uniqueSlug(item.slug),
    originalTitle: item.originalTitle || '',
    year: item.year || '',
    releaseDate: item.releaseDate || '',
    type: item.type,
    mediaType: item.mediaType,
    category: item.mediaType === 'manga' ? 'manga' : (sectionSelect?.value || (item.mediaType === 'tv' ? 'series' : 'films')),
    genres,
    director: item.director || 'À compléter',
    cast: normalizeCast(item.cast),
    runtime: item.runtime || 0,
    seasons: Number(item.seasons || 0),
    episodes: Number(item.episodes || 0),
    ...(Array.isArray(item.seasonsData) ? { seasonsData: item.seasonsData } : {}),
    country: item.country || '',
    language: item.language || '',
    rating: Number(item.rating || 0),
    popularity: Number(item.popularity || 0),
    trailer: item.trailer || '',
    videoEmbed: item.videoEmbed || item.video_embed || '',
    tagline: item.tagline || '',
    status: item.status || '',
    homepage: item.homepage || '',
    collection: item.collection || '',
    studios: item.studios || [],
    tmdbId: item.tmdbId,
    poster: item.poster || '',
    backdrop: item.backdrop || '',
    overview: item.overview || '',
    featured: featuredSelect?.value === 'true',
    premium: premiumSelect?.value === 'true',
    homeFeatured: homeFeaturedSelect?.value === 'true',
    cinemaRelease: cinemaReleaseSelect?.value === 'true',
    cinemaReleaseOrder: Math.max(1, Number(cinemaReleaseOrderInput?.value || 1)),
    cinemaReleaseFeatured: cinemaReleaseFeaturedSelect?.value === 'true'
  };
}

function normalizeTmdbItem(item) {
  const title = item.title || item.name || 'Titre inconnu';
  const mediaType = item.mediaType || item.media_type || (item.type === 'serie' ? 'tv' : 'movie');
  const type = item.type || (mediaType === 'tv' ? 'serie' : 'film');
  const releaseDate = item.releaseDate || item.release_date || item.first_air_date || '';
  const year = item.year || (releaseDate ? releaseDate.slice(0, 4) : '');

  return {
    title,
    slug: slugify(title),
    originalTitle: item.originalTitle || item.original_title || item.original_name || '',
    year,
    releaseDate,
    type,
    mediaType,
    genres: Array.isArray(item.genres) ? item.genres.filter(Boolean) : [],
    director: item.director || 'À compléter',
    cast: normalizeCast(item.cast),
    runtime: Number(item.runtime || 0),
    seasons: Number(item.seasons || 0),
    episodes: Number(item.episodes || 0),
    ...(Array.isArray(item.seasonsData) ? { seasonsData: item.seasonsData } : {}),
    country: item.country || '',
    language: item.language || '',
    rating: Number(item.rating || 0),
    popularity: Number(item.popularity || 0),
    trailer: item.trailer || '',
    videoEmbed: item.videoEmbed || item.video_embed || '',
    tagline: item.tagline || '',
    status: item.status || '',
    homepage: item.homepage || '',
    collection: item.collection || '',
    studios: Array.isArray(item.studios) ? item.studios.filter(Boolean) : [],
    tmdbId: item.tmdbId || item.id || '',
    poster: item.poster || '',
    backdrop: item.backdrop || '',
    overview: item.overview || ''
  };
}

function updatePreview(item) {
  if (!preview) return;

  const isEpisodeBased = item.mediaType === 'tv' || item.mediaType === 'manga';
  const runtimeLabel = isEpisodeBased
    ? `${item.seasons || 0} saison(s) · ${item.episodes || 0} épisode(s)`
    : `${item.runtime || 0} min`;

  preview.innerHTML = `
    <div class="preview-poster">
      ${item.poster ? `<img src="${escapeAttr(item.poster)}" alt="Affiche ${escapeAttr(item.title)}">` : 'Aucune affiche'}
    </div>
    <div class="preview-body">
      <h3>${escapeHtml(item.title)}</h3>
      <div class="preview-meta">
        <span>${escapeHtml(getMediaLabel(item))}</span>
        <span>${escapeHtml(item.year || 'Année inconnue')}</span>
        <span>${escapeHtml(runtimeLabel)}</span>
        <span>${escapeHtml(item.genres[0] || 'Genre auto')}</span>
      </div>
      <p>${escapeHtml(item.overview || 'Résumé absent')}</p>
      <p><strong>Réalisation / création :</strong> ${escapeHtml(item.director || 'À compléter')}</p>
      <p><strong>TMDb ID :</strong> ${escapeHtml(String(item.tmdbId || 'absent'))}</p>
    </div>
  `;
}




const BUBBLE_REASON_KEYS = [
  'voyager',
  'frissonner',
  'rire',
  'fatigue',
  'reflechir',
  'spectacle',
  'emotion',
  'famille'
];

function getBubbleReasons(entry = {}) {
  const reasons = entry.bubbleReasons;
  return reasons && typeof reasons === 'object' && !Array.isArray(reasons) ? reasons : {};
}

function hasBubbleReasons(entry = {}) {
  const reasons = getBubbleReasons(entry);
  return BUBBLE_REASON_KEYS.some(key => String(reasons[key] || '').trim());
}

function needsBubbleReasons(entry = {}) {
  return !hasBubbleReasons(entry);
}

const BUBULLE_PROFILE_REQUIRED_KEYS = [
  'pace',
  'complexity',
  'spectacle',
  'violence',
  'humour',
  'emotion'
];

function hasProjectionnisteAdvice(entry = {}) {
  return String(entry.projectionnisteAdvice || '').trim().length > 0;
}

function hasCompleteBubulleProfile(entry = {}) {
  const profile = getBubulleProfile(entry);

  const hasTextFields = BUBULLE_PROFILE_REQUIRED_KEYS.every(key => {
    return String(profile[key] || '').trim().length > 0;
  });

  return hasTextFields && typeof profile.family === 'boolean';
}

function getBubulleCompletionStatus(entry = {}) {
  const reasons = hasBubbleReasons(entry);
  const advice = hasProjectionnisteAdvice(entry);
  const profile = hasCompleteBubulleProfile(entry);

  return {
    reasons,
    advice,
    profile,
    complete: reasons && advice && profile
  };
}

function needsBubulleCompletion(entry = {}) {
  return !getBubulleCompletionStatus(entry).complete;
}

function getBubulleMissingLabels(entry = {}) {
  const status = getBubulleCompletionStatus(entry);
  const labels = [];

  if (!status.reasons) labels.push('justifs');
  if (!status.advice) labels.push('avis');
  if (!status.profile) labels.push('profil');

  return labels;
}

function getBubbleReasonBadge(entry = {}) {
  const status = getBubulleCompletionStatus(entry);

  if (status.complete) {
    return '<span class="catalogue-badge bubulle-ready">🐠 Bubulle complet</span>';
  }

  const missing = getBubulleMissingLabels(entry).join(', ');
  return `<span class="catalogue-badge bubulle-missing">🐠 Incomplet : ${escapeHtml(missing)}</span>`;
}


function getCurrentEditorBubblePayload() {
  const current = editingIndex >= 0 ? draft[editingIndex] : null;
  const isSeries = current ? isSeriesEntry(current) : false;

  return {
    title: editFields.title?.value.trim() || current?.title || '',
    originalTitle: current?.originalTitle || '',
    year: editFields.year?.value.trim() || current?.year || '',
    type: current ? getMediaLabel(current) : '',
    mediaType: current ? getCatalogueMediaType(current) : '',
    category: editFields.category?.value || current?.category || '',
    genres: editFields.genres?.value
      .split(',')
      .map(genre => genre.trim())
      .filter(Boolean) || [],
    runtime: Number(current?.runtime || 0),
    seasons: Number(current?.seasons || 0),
    episodes: Number(current?.episodes || 0),
    director: current?.director || '',
    cast: getCastSearchTerms(current?.cast || []).slice(0, 10),
    overview: editFields.overview?.value.trim() || current?.overview || '',
    isSeries
  };
}

function applyBubbleReasonsToEditor(reasons = {}) {
  if (editFields.reasonVoyager) editFields.reasonVoyager.value = reasons.voyager || '';
  if (editFields.reasonFrissonner) editFields.reasonFrissonner.value = reasons.frissonner || '';
  if (editFields.reasonRire) editFields.reasonRire.value = reasons.rire || '';
  if (editFields.reasonFatigue) editFields.reasonFatigue.value = reasons.fatigue || '';
  if (editFields.reasonReflechir) editFields.reasonReflechir.value = reasons.reflechir || '';
  if (editFields.reasonSpectacle) editFields.reasonSpectacle.value = reasons.spectacle || '';
  if (editFields.reasonEmotion) editFields.reasonEmotion.value = reasons.emotion || '';
  if (editFields.reasonFamille) editFields.reasonFamille.value = reasons.famille || '';
}

async function generateBubbleReasonsForCurrentEntry() {
  if (editingIndex < 0 || !draft[editingIndex]) {
    showMessage('Ouvre une fiche avant de lancer Bubulle.');
    return;
  }

  const payload = getCurrentEditorBubblePayload();

  if (!payload.title || !payload.overview) {
    showMessage('Il faut au moins un titre et un résumé pour générer des justifications propres.');
    return;
  }

  const existingReasons = collectBubbleReasonsFromEditor();

  if (Object.keys(existingReasons).length) {
    const replace = confirm('Cette fiche contient déjà des justifications Bubulle. Tu veux les remplacer par une génération OpenAI ?');
    if (!replace) return;
  }

  const originalLabel = generateBubbleReasonsBtn?.textContent || '✨ Générer Bubulle';

  try {
    if (generateBubbleReasonsBtn) {
      generateBubbleReasonsBtn.disabled = true;
      generateBubbleReasonsBtn.textContent = '🐠 Génération...';
    }

    showMessage(`Bubulle interroge OpenAI pour “${payload.title}”…`);

    const reasons = await requestBubbleReasons(payload);

    applyBubbleReasonsToEditor(reasons);

    const generatedCount = Object.values(reasons).filter(value => String(value || '').trim()).length;
    showMessage(
      generatedCount
        ? `Bubulle a généré ${generatedCount} justification${generatedCount > 1 ? 's' : ''}. Relis, puis clique sur Enregistrer.`
        : 'OpenAI n’a rien rempli de pertinent. La fiche reste à enrichir manuellement.'
    );
  } catch (err) {
    console.error(err);
    showMessage(`Génération Bubulle impossible : ${err.message}`);
  } finally {
    if (generateBubbleReasonsBtn) {
      generateBubbleReasonsBtn.disabled = false;
      generateBubbleReasonsBtn.textContent = originalLabel;
    }
  }
}



function waitBubbleBatch(ms = 900) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBubblePayloadFromEntry(entry = {}) {
  return {
    title: String(entry.title || '').trim(),
    originalTitle: entry.originalTitle || '',
    year: entry.year || '',
    type: getMediaLabel(entry),
    mediaType: getCatalogueMediaType(entry),
    category: entry.category || '',
    genres: Array.isArray(entry.genres) ? entry.genres.filter(Boolean) : [],
    runtime: Number(entry.runtime || 0),
    seasons: Number(entry.seasons || 0),
    episodes: Number(entry.episodes || 0),
    director: entry.director || '',
    cast: getCastSearchTerms(entry.cast || []).slice(0, 10),
    overview: String(entry.overview || '').trim(),
    isSeries: isSeriesEntry(entry)
  };
}

async function requestBubbleReasons(payload) {
  const res = await fetch('/.netlify/functions/generate-bubble-reasons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.details || 'Réponse OpenAI invalide');
  }

  return data.bubbleReasons || data.reasons || {};
}


async function requestBubbleAdvice(payload) {
  const res = await fetch('/.netlify/functions/generate-bubble-advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.details || 'Réponse OpenAI invalide');
  }

  return String(data.projectionnisteAdvice || data.advice || '').trim();
}


function getBubulleData(entry = {}) {
  const source = entry && typeof entry.bubulle === 'object' && !Array.isArray(entry.bubulle)
    ? entry.bubulle
    : {};

  return source;
}

function getBubulleProfile(entry = {}) {
  const bubulle = getBubulleData(entry);
  return bubulle.profile && typeof bubulle.profile === 'object' && !Array.isArray(bubulle.profile)
    ? bubulle.profile
    : {};
}

async function requestBubbleProfile(payload) {
  const res = await fetch('/.netlify/functions/generate-bubble-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.details || 'Réponse OpenAI invalide');
  }

  const profile = data.profile && typeof data.profile === 'object' && !Array.isArray(data.profile)
    ? data.profile
    : {};

  return {
    pace: String(profile.pace || data.pace || data.bubblePace || '').trim(),
    complexity: String(profile.complexity || data.complexity || '').trim(),
    humour: String(profile.humour || data.humour || '').trim(),
    violence: String(profile.violence || data.violence || '').trim(),
    spectacle: String(profile.spectacle || data.spectacle || '').trim(),
    emotion: String(profile.emotion || data.emotion || '').trim(),
    family: typeof profile.family === 'boolean' ? profile.family : Boolean(data.family)
  };
}

async function generateBubblePaceForCurrentEntry() {
  if (editingIndex < 0 || !draft[editingIndex]) {
    showMessage('Ouvre une fiche avant de demander le rythme Bubulle.');
    return;
  }

  const payload = getCurrentEditorBubblePayload();

  if (!payload.title || !payload.overview) {
    showMessage('Il faut au moins un titre et un résumé pour générer le rythme.');
    return;
  }

  const existingPace = editFields.bubblePace?.value.trim() || '';
  const existingComplexity = editFields.bubbleComplexity?.value.trim() || '';
  const existingSpectacle = editFields.bubbleSpectacle?.value.trim() || '';
  const existingViolence = editFields.bubbleViolence?.value.trim() || '';
  const existingHumour = editFields.bubbleHumour?.value.trim() || '';
  const existingEmotion = editFields.bubbleEmotion?.value.trim() || '';
  const existingFamily = editFields.bubbleFamily?.value.trim() || '';

  const visibleProfileFields = [
    existingPace,
    existingComplexity,
    existingSpectacle,
    existingViolence,
    existingHumour,
    existingEmotion,
    existingFamily
  ];

  if (visibleProfileFields.every(Boolean)) {
    showMessage('Le profil visible est déjà rempli. Modifie un champ à la main si tu veux l’ajuster.');
    return;
  }

  const originalLabel = generateBubblePaceBtn?.textContent || '✨ Générer le profil';

  try {
    if (generateBubblePaceBtn) {
      generateBubblePaceBtn.disabled = true;
      generateBubblePaceBtn.textContent = '🐠 Profil...';
    }

    showMessage(`Bubulle évalue le profil de “${payload.title}”…`);

    const profile = await requestBubbleProfile(payload);

    const filledFields = [];
    const keptFields = [];

    if (editFields.bubblePace) {
      if (!existingPace && profile.pace) {
        editFields.bubblePace.value = profile.pace;
        filledFields.push('rythme');
      } else if (existingPace) {
        keptFields.push('rythme');
      }
    }

    if (editFields.bubbleComplexity) {
      if (!existingComplexity && profile.complexity) {
        editFields.bubbleComplexity.value = profile.complexity;
        filledFields.push('complexité');
      } else if (existingComplexity) {
        keptFields.push('complexité');
      }
    }

    if (editFields.bubbleSpectacle) {
      if (!existingSpectacle && profile.spectacle) {
        editFields.bubbleSpectacle.value = profile.spectacle;
        filledFields.push('spectacle');
      } else if (existingSpectacle) {
        keptFields.push('spectacle');
      }
    }

    if (editFields.bubbleViolence) {
      if (!existingViolence && profile.violence) {
        editFields.bubbleViolence.value = profile.violence;
        filledFields.push('violence');
      } else if (existingViolence) {
        keptFields.push('violence');
      }
    }

    if (editFields.bubbleHumour) {
      if (!existingHumour && profile.humour) {
        editFields.bubbleHumour.value = profile.humour;
        filledFields.push('humour');
      } else if (existingHumour) {
        keptFields.push('humour');
      }
    }

    if (editFields.bubbleEmotion) {
      if (!existingEmotion && profile.emotion) {
        editFields.bubbleEmotion.value = profile.emotion;
        filledFields.push('émotion');
      } else if (existingEmotion) {
        keptFields.push('émotion');
      }
    }

    if (editFields.bubbleFamily) {
      if (!existingFamily && typeof profile.family === 'boolean') {
        editFields.bubbleFamily.value = profile.family ? 'true' : 'false';
        filledFields.push('familial');
      } else if (existingFamily) {
        keptFields.push('familial');
      }
    }

    if (filledFields.length) {
      const keptText = keptFields.length ? ` Champs déjà validés conservés : ${keptFields.join(', ')}.` : '';
      showMessage(`Profil complété : ${filledFields.join(', ')}.${keptText} Relis, ajuste si besoin, puis clique sur Enregistrer.`);
    } else {
      showMessage('OpenAI a répondu, mais aucun champ vide visible n’a pu être complété. Les valeurs existantes n’ont pas été écrasées.');
    }
  } catch (err) {
    console.error(err);
    showMessage(`Génération du profil impossible : ${err.message}`);
  } finally {
    if (generateBubblePaceBtn) {
      generateBubblePaceBtn.disabled = false;
      generateBubblePaceBtn.textContent = originalLabel;
    }
  }
}

async function generateBubbleAdviceForCurrentEntry() {
  if (editingIndex < 0 || !draft[editingIndex]) {
    showMessage('Ouvre une fiche avant de demander le conseil du projectionniste.');
    return;
  }

  const payload = getCurrentEditorBubblePayload();

  if (!payload.title || !payload.overview) {
    showMessage('Il faut au moins un titre et un résumé pour générer un conseil propre.');
    return;
  }

  const existingAdvice = editFields.projectionnisteAdvice?.value.trim() || '';

  if (existingAdvice) {
    const replace = confirm('Cette fiche contient déjà un conseil du projectionniste. Tu veux le remplacer par une génération OpenAI ?');
    if (!replace) return;
  }

  const originalLabel = generateBubbleAdviceBtn?.textContent || '✨ Générer le conseil';

  try {
    if (generateBubbleAdviceBtn) {
      generateBubbleAdviceBtn.disabled = true;
      generateBubbleAdviceBtn.textContent = '🐠 Conseil...';
    }

    showMessage(`Bubulle demande un avis de projectionniste pour “${payload.title}”…`);

    const advice = await requestBubbleAdvice(payload);

    if (editFields.projectionnisteAdvice) {
      editFields.projectionnisteAdvice.value = advice;
    }

    showMessage(
      advice
        ? 'Conseil généré. Relis, ajuste si besoin, puis clique sur Enregistrer.'
        : 'OpenAI n’a pas retourné de conseil exploitable. Le champ reste vide.'
    );
  } catch (err) {
    console.error(err);
    showMessage(`Génération du conseil impossible : ${err.message}`);
  } finally {
    if (generateBubbleAdviceBtn) {
      generateBubbleAdviceBtn.disabled = false;
      generateBubbleAdviceBtn.textContent = originalLabel;
    }
  }
}

function cleanGeneratedBubbleReasons(reasons = {}) {
  const cleaned = {};

  BUBBLE_REASON_KEYS.forEach(key => {
    const value = String(reasons[key] || '').trim();

    if (value) {
      cleaned[key] = value;
    }
  });

  return cleaned;
}

function setBubbleBatchUi(isRunning, label = '') {
  bubbleBatchRunning = isRunning;

  if (generateAllBubbleReasonsBtn) {
    generateAllBubbleReasonsBtn.disabled = isRunning;
    generateAllBubbleReasonsBtn.textContent = isRunning ? (label || '🐠 Moulinette en cours...') : '✨ Compléter Bubulle';
  }

  if (stopBubbleBatchBtn) {
    stopBubbleBatchBtn.disabled = !isRunning;
  }

  if (generateBubbleReasonsBtn) {
    generateBubbleReasonsBtn.disabled = isRunning;
  }

  if (generateBubbleAdviceBtn) {
    generateBubbleAdviceBtn.disabled = isRunning;
  }

  if (generateBubblePaceBtn) {
    generateBubblePaceBtn.disabled = isRunning;
  }
}

function updateBubbleBatchStatus(text) {
  if (catalogueBubbleStatus && text) {
    catalogueBubbleStatus.textContent = text;
  }

  if (text) {
    showMessage(text);
  }
}

async function generateMissingBubbleReasonsBatch() {
  if (bubbleBatchRunning) return;

  const targets = draft
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => needsBubulleCompletion(entry))
    .filter(({ entry }) => {
      const payload = getBubblePayloadFromEntry(entry);
      return payload.title && payload.overview;
    });

  if (!targets.length) {
    showMessage('Aucune fiche Bubulle incomplète exploitable. Le bocal est déjà propre ou il manque des résumés.');
    return;
  }

  const missingReasonsTotal = targets.filter(({ entry }) => needsBubbleReasons(entry)).length;
  const missingAdviceTotal = targets.filter(({ entry }) => !hasProjectionnisteAdvice(entry)).length;
  const missingProfileTotal = targets.filter(({ entry }) => !hasCompleteBubulleProfile(entry)).length;

  const confirmRun = confirm(
    `Bubulle va compléter ${targets.length} fiche${targets.length > 1 ? 's' : ''} incomplète${targets.length > 1 ? 's' : ''}.\n\n` +
    `À générer : ${missingReasonsTotal} justification${missingReasonsTotal > 1 ? 's' : ''}, ${missingAdviceTotal} avis, ${missingProfileTotal} profil${missingProfileTotal > 1 ? 's' : ''}.\n\n` +
    'Il complétera uniquement les champs manquants et ne remplacera pas ce qui existe déjà.\n' +
    'Tu pourras stopper après la fiche en cours.\n\n' +
    'On lance la moulinette complète ?'
  );

  if (!confirmRun) return;

  bubbleBatchShouldStop = false;
  setBubbleBatchUi(true);

  let done = 0;
  let reasonsFilled = 0;
  let adviceFilled = 0;
  let profileFilled = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const target of targets) {
      if (bubbleBatchShouldStop) break;

      const { entry, index } = target;
      const title = entry.title || `fiche ${index + 1}`;
      const progress = `${done + 1}/${targets.length}`;
      const payload = getBubblePayloadFromEntry(entry);
      const patch = {};
      const operations = [];

      setBubbleBatchUi(true, `🐠 ${progress} · ${title}`.slice(0, 46));
      updateBubbleBatchStatus(`Moulinette Bubulle complète : ${progress} · ${title}`);

      try {
        if (needsBubbleReasons(entry)) {
          const reasons = cleanGeneratedBubbleReasons(await requestBubbleReasons(payload));

          if (Object.keys(reasons).length) {
            patch.bubbleReasons = reasons;
            reasonsFilled += 1;
            operations.push('justifs');
          }

          if (!bubbleBatchShouldStop) {
            await waitBubbleBatch(450);
          }
        }

        if (!hasProjectionnisteAdvice(entry)) {
          const advice = await requestBubbleAdvice(payload);

          if (advice) {
            patch.projectionnisteAdvice = advice;
            adviceFilled += 1;
            operations.push('avis');
          }

          if (!bubbleBatchShouldStop) {
            await waitBubbleBatch(450);
          }
        }

        if (!hasCompleteBubulleProfile(entry)) {
          const profile = await requestBubbleProfile(payload);
          const cleanedProfile = {
            ...getBubulleProfile(entry)
          };

          if (!String(cleanedProfile.pace || '').trim() && profile.pace) cleanedProfile.pace = profile.pace;
          if (!String(cleanedProfile.complexity || '').trim() && profile.complexity) cleanedProfile.complexity = profile.complexity;
          if (!String(cleanedProfile.spectacle || '').trim() && profile.spectacle) cleanedProfile.spectacle = profile.spectacle;
          if (!String(cleanedProfile.violence || '').trim() && profile.violence) cleanedProfile.violence = profile.violence;
          if (!String(cleanedProfile.humour || '').trim() && profile.humour) cleanedProfile.humour = profile.humour;
          if (!String(cleanedProfile.emotion || '').trim() && profile.emotion) cleanedProfile.emotion = profile.emotion;
          if (typeof cleanedProfile.family !== 'boolean' && typeof profile.family === 'boolean') cleanedProfile.family = profile.family;

          const hasProfileData = BUBULLE_PROFILE_REQUIRED_KEYS.some(key => String(cleanedProfile[key] || '').trim()) || typeof cleanedProfile.family === 'boolean';

          if (hasProfileData) {
            patch.bubulle = {
              ...(entry.bubulle && typeof entry.bubulle === 'object' && !Array.isArray(entry.bubulle) ? entry.bubulle : {}),
              profile: cleanedProfile
            };
            profileFilled += 1;
            operations.push('profil');
          }
        }

        if (Object.keys(patch).length) {
          draft[index] = {
            ...draft[index],
            ...patch
          };
          syncOutput();
          localStorage.setItem('catalogueDraft', JSON.stringify(draft));
          updateBubbleBatchStatus(`Moulinette Bubulle : ${progress} · ${title} · ${operations.join(', ')}`);
        } else {
          skipped += 1;
        }
      } catch (err) {
        failed += 1;
        console.error(`Erreur génération Bubulle complète pour ${title}`, err);
      }

      done += 1;
      renderCatalogueList();

      if (!bubbleBatchShouldStop) {
        await waitBubbleBatch(900);
      }
    }
  } finally {
    setBubbleBatchUi(false);
    renderCatalogueList();

    const stopped = bubbleBatchShouldStop ? ' Moulinette stoppée à la demande.' : '';
    updateBubbleBatchStatus(
      `Bubulle a terminé : ${reasonsFilled} justif${reasonsFilled > 1 ? 's' : ''}, ${adviceFilled} avis, ${profileFilled} profil${profileFilled > 1 ? 's' : ''}, ${skipped} sans ajout, ${failed} erreur${failed > 1 ? 's' : ''}.${stopped}`
    );

    bubbleBatchShouldStop = false;
  }
}


function collectBubbleReasonsFromEditor() {
  const reasons = {
    voyager: editFields.reasonVoyager?.value.trim() || '',
    frissonner: editFields.reasonFrissonner?.value.trim() || '',
    rire: editFields.reasonRire?.value.trim() || '',
    fatigue: editFields.reasonFatigue?.value.trim() || '',
    reflechir: editFields.reasonReflechir?.value.trim() || '',
    spectacle: editFields.reasonSpectacle?.value.trim() || '',
    emotion: editFields.reasonEmotion?.value.trim() || '',
    famille: editFields.reasonFamille?.value.trim() || ''
  };

  return Object.fromEntries(
    Object.entries(reasons).filter(([, value]) => value)
  );
}

function fillBubbleReasonFields(entry = {}) {
  const reasons = getBubbleReasons(entry);

  if (editFields.reasonVoyager) editFields.reasonVoyager.value = reasons.voyager || '';
  if (editFields.reasonFrissonner) editFields.reasonFrissonner.value = reasons.frissonner || '';
  if (editFields.reasonRire) editFields.reasonRire.value = reasons.rire || '';
  if (editFields.reasonFatigue) editFields.reasonFatigue.value = reasons.fatigue || '';
  if (editFields.reasonReflechir) editFields.reasonReflechir.value = reasons.reflechir || '';
  if (editFields.reasonSpectacle) editFields.reasonSpectacle.value = reasons.spectacle || '';
  if (editFields.reasonEmotion) editFields.reasonEmotion.value = reasons.emotion || '';
  if (editFields.reasonFamille) editFields.reasonFamille.value = reasons.famille || '';
}

function updateCatalogueFilterButtons() {
  showAllEmbedsBtn?.classList.toggle('is-active', !catalogueMissingMode && !catalogueBubbleMissingMode);
  showMissingEmbedsBtn?.classList.toggle('is-active', catalogueMissingMode);
  showMissingBubbleBtn?.classList.toggle('is-active', catalogueBubbleMissingMode);
}

function renderCatalogueList() {
  if (!catalogueList) return;

  const query = (catalogueSearch?.value || '').trim().toLowerCase();
  const type = catalogueTypeFilter?.value || 'all';
  const sortMode = catalogueSort?.value || 'recent';
  const missingTotal = draft.filter(entry => getMediaEmbedSummary(entry).missing).length;

  let items = draft.map((entry, index) => ({ entry, index }));

  if (type !== 'all') {
    items = items.filter(({ entry }) => getCatalogueMediaType(entry) === type);
  }

  if (catalogueMissingMode) {
    items = items.filter(({ entry }) => getMediaEmbedSummary(entry).missing);
  }

  if (catalogueBubbleMissingMode) {
    items = items.filter(({ entry }) => needsBubulleCompletion(entry));
  }

  if (query) {
    items = items.filter(({ entry }) => {
      const haystack = [
        entry.title,
        entry.originalTitle,
        entry.year,
        entry.category,
        ...(Array.isArray(entry.genres) ? entry.genres : []),
        entry.director,
        ...getCastSearchTerms(entry.cast)
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  items.sort((a, b) => compareCatalogueItems(a.entry, b.entry, sortMode));

  if (catalogueCount) {
    const visible = items.length;
    catalogueCount.textContent = catalogueMissingMode || catalogueBubbleMissingMode || query || type !== 'all'
      ? `${visible} / ${draft.length} contenu${draft.length > 1 ? 's' : ''}`
      : `${draft.length} contenu${draft.length > 1 ? 's' : ''}`;
  }

  if (catalogueEmbedStatus) {
    const bubbleMissingTotal = draft.filter(entry => needsBubulleCompletion(entry)).length;
    const bubbleCompleteTotal = draft.length - bubbleMissingTotal;
    const embedText = missingTotal
      ? `${missingTotal} contenu${missingTotal > 1 ? 's' : ''} sans embed`
      : 'embeds OK';
    const bubbleText = draft.length
      ? `Bubulle ${bubbleCompleteTotal}/${draft.length}`
      : 'Bubulle OK';
    catalogueEmbedStatus.textContent = `${embedText} · ${bubbleText}`;
  }

  if (catalogueBubbleStatus) {
    const missingReasonsTotal = draft.filter(entry => !hasBubbleReasons(entry)).length;
    const missingAdviceTotal = draft.filter(entry => !hasProjectionnisteAdvice(entry)).length;
    const missingProfileTotal = draft.filter(entry => !hasCompleteBubulleProfile(entry)).length;
    const bubbleMissingTotal = draft.filter(entry => needsBubulleCompletion(entry)).length;
    const bubbleReadyTotal = draft.length - bubbleMissingTotal;

    catalogueBubbleStatus.textContent = bubbleMissingTotal
      ? `Bubulle complet ${bubbleReadyTotal}/${draft.length} · justifs manquantes ${missingReasonsTotal} · avis manquants ${missingAdviceTotal} · profils manquants ${missingProfileTotal}`
      : `Toutes les fiches ont justifications, avis et profil Bubulle complet. Le bocal est vraiment propre.`;
  }

  if (showMissingEmbedsBtn) {
    showMissingEmbedsBtn.textContent = missingTotal ? `Sans embed (${missingTotal})` : 'Sans embed';
  }

  if (showMissingBubbleBtn) {
    const bubbleMissingTotal = draft.filter(entry => needsBubulleCompletion(entry)).length;
    showMissingBubbleBtn.textContent = bubbleMissingTotal ? `🐠 Bubulle incomplet (${bubbleMissingTotal})` : '🐠 Bubulle complet';
  }

  updateCatalogueFilterButtons();

  if (!items.length) {
    catalogueList.innerHTML = '<div class="admin-empty">Aucun contenu ne correspond aux filtres. Le catalogue boude dans son coin.</div>';
    return;
  }

  catalogueList.innerHTML = '';
  items.forEach(({ entry, index }) => catalogueList.appendChild(catalogueRow(entry, index)));
}

function compareCatalogueItems(a, b, sortMode) {
  if (sortMode === 'missing-first') {
    const ma = getMediaEmbedSummary(a).missing ? 1 : 0;
    const mb = getMediaEmbedSummary(b).missing ? 1 : 0;
    return mb - ma || String(a.title || '').localeCompare(String(b.title || ''), 'fr');
  }
  if (sortMode === 'title') return String(a.title || '').localeCompare(String(b.title || ''), 'fr');
  if (sortMode === 'year-desc') return String(b.year || '').localeCompare(String(a.year || '')) || String(a.title || '').localeCompare(String(b.title || ''), 'fr');
  if (sortMode === 'year-asc') return String(a.year || '').localeCompare(String(b.year || '')) || String(a.title || '').localeCompare(String(b.title || ''), 'fr');
  if (sortMode === 'rating-desc') return Number(b.rating || 0) - Number(a.rating || 0) || String(a.title || '').localeCompare(String(b.title || ''), 'fr');
  if (sortMode === 'category') return String(a.category || '').localeCompare(String(b.category || ''), 'fr') || String(a.title || '').localeCompare(String(b.title || ''), 'fr');
  return 0;
}

function catalogueRow(entry, index) {
  const el = document.createElement('article');
  el.className = 'catalogue-item';
  const poster = entry.poster || '';
  const genres = Array.isArray(entry.genres) ? entry.genres.slice(0, 5).join(', ') : '';
  const isSeries = isSeriesEntry(entry);
  const typeLabel = getMediaLabel(entry);
  const featured = entry.featured ? '<span class="catalogue-badge">À la une</span>' : '';
  const premium = entry.premium ? '<span class="catalogue-badge premium">⭐ Premium</span>' : '';
  const cinemaReleaseBadge = entry.cinemaRelease ? `<span class="catalogue-badge">🎞️ Sortie cinéma${entry.cinemaReleaseFeatured ? ' · vedette' : ''}${entry.cinemaReleaseOrder ? ` #${escapeHtml(String(entry.cinemaReleaseOrder))}` : ''}</span>` : '';
  const bubbleBadge = getBubbleReasonBadge(entry);
  const mediaSummary = getMediaEmbedSummary(entry);
  const stats = isSeries ? getEpisodeEmbedStats(entry) : null;
  const readyBadge = mediaSummary.missing
    ? `<span class="catalogue-badge missing">${escapeHtml(mediaSummary.label)}</span>`
    : `<span class="catalogue-badge ready">${isSeries ? `${typeLabel} prêt${typeLabel === 'Série' ? 'e' : ''}` : 'Embed OK'}</span>`;
  const seriesBadge = isSeries
    ? `<span class="catalogue-badge">${escapeHtml(String(entry.seasons || (Array.isArray(entry.seasonsData) ? entry.seasonsData.length : 0)))} saison${Number(entry.seasons || 0) > 1 ? 's' : ''}</span><span class="catalogue-badge">${escapeHtml(String(entry.episodes || stats?.total || 0))} épisode${Number(entry.episodes || stats?.total || 0) > 1 ? 's' : ''}</span>`
    : '';
  const overview = String(entry.overview || '').trim();

  if (mediaSummary.missing) el.classList.add('is-missing-embed');
  if (needsBubulleCompletion(entry)) el.classList.add('is-missing-bubulle');

  el.innerHTML = `
    ${poster ? `<img src="${escapeAttr(poster)}" alt="Affiche ${escapeAttr(entry.title || '')}">` : '<div class="catalogue-thumb">Sans affiche</div>'}
    <div>
      <h3>${escapeHtml(entry.title || 'Sans titre')}</h3>
      <div class="catalogue-meta-line">
        <span class="catalogue-badge">${escapeHtml(typeLabel)}</span>
        <span class="catalogue-badge">${escapeHtml(entry.year || 'Année ?')}</span>
        ${seriesBadge}
        ${readyBadge}
        ${featured}
        ${premium}
        ${cinemaReleaseBadge}
        ${bubbleBadge}
      </div>
      <p>${escapeHtml(genres || 'Genres à compléter')} · Note ${escapeHtml(String(entry.rating || 0))}</p>
      ${overview ? `<p class="catalogue-summary">${escapeHtml(overview)}</p>` : ''}
    </div>
    <div class="catalogue-buttons">
      <button class="ghost" type="button" data-action="edit">Modifier</button>
      <button class="ghost" type="button" data-action="refresh-tmdb">🔄 TMDb</button>
      <button class="danger" type="button" data-action="delete">Supprimer</button>
    </div>
  `;

  el.querySelector('[data-action="edit"]')?.addEventListener('click', () => openEditor(index));
  el.querySelector('[data-action="refresh-tmdb"]')?.addEventListener('click', () => refreshCatalogueItemFromTmdb(index));
  el.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteCatalogueItem(index));
  return el;
}

function openEditor(index) {
  const entry = draft[index];
  if (!entry || !editPanel) return;
  editingIndex = index;
  editPanel.classList.remove('is-hidden');
  const isSeries = isSeriesEntry(entry);
  catalogueEditorGrid?.classList.add('is-editing-content');
  catalogueEditorGrid?.classList.toggle('is-series-editing', isSeries);
  editPanel.classList.toggle('is-series-editing', isSeries);
  if (editFields.videoEmbed) editFields.videoEmbed.closest('label')?.classList.toggle('is-hidden', isSeries);

  editFields.title.value = entry.title || '';
  editFields.year.value = entry.year || '';
  editFields.category.value = entry.category || '';
  editFields.featured.value = entry.featured ? 'true' : 'false';
  if (editFields.premium) editFields.premium.value = entry.premium ? 'true' : 'false';
  if (editFields.homeFeatured) editFields.homeFeatured.value = entry.homeFeatured ? 'true' : 'false';
  if (editFields.cinemaRelease) editFields.cinemaRelease.value = entry.cinemaRelease ? 'true' : 'false';
  if (editFields.cinemaReleaseOrder) editFields.cinemaReleaseOrder.value = Math.max(1, Number(entry.cinemaReleaseOrder || 1));
  if (editFields.cinemaReleaseFeatured) editFields.cinemaReleaseFeatured.value = entry.cinemaReleaseFeatured ? 'true' : 'false';
  editFields.genres.value = Array.isArray(entry.genres) ? entry.genres.join(', ') : '';
  editFields.rating.value = entry.rating ?? 0;
  editFields.poster.value = entry.poster || '';
  editFields.backdrop.value = entry.backdrop || '';
  editFields.trailer.value = entry.trailer || '';
  if (editFields.videoEmbed) editFields.videoEmbed.value = entry.videoEmbed || entry.video_embed || '';
  editFields.slug.value = entry.slug || slugify(entry.title || 'contenu');
  editFields.overview.value = entry.overview || '';
  fillBubbleReasonFields(entry);
  if (editFields.projectionnisteAdvice) editFields.projectionnisteAdvice.value = entry.projectionnisteAdvice || '';
  if (editFields.bubblePace) editFields.bubblePace.value = getBubulleProfile(entry).pace || '';
  if (editFields.bubbleComplexity) editFields.bubbleComplexity.value = getBubulleProfile(entry).complexity || '';
  if (editFields.bubbleSpectacle) editFields.bubbleSpectacle.value = getBubulleProfile(entry).spectacle || '';
  if (editFields.bubbleViolence) editFields.bubbleViolence.value = getBubulleProfile(entry).violence || '';
  if (editFields.bubbleHumour) editFields.bubbleHumour.value = getBubulleProfile(entry).humour || '';
  if (editFields.bubbleEmotion) editFields.bubbleEmotion.value = getBubulleProfile(entry).emotion || '';
  if (editFields.bubbleFamily) editFields.bubbleFamily.value = typeof getBubulleProfile(entry).family === 'boolean' ? String(getBubulleProfile(entry).family) : '';

  renderSeriesEpisodeEditor(entry);

  editPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveEditedItem() {
  if (editingIndex < 0 || !draft[editingIndex]) return;
  const current = draft[editingIndex];
  const newSlug = slugify(editFields.slug.value || editFields.title.value || current.title || 'contenu');
  const slugAlreadyUsed = draft.some((entry, index) => index !== editingIndex && entry.slug === newSlug);

  if (slugAlreadyUsed) {
    showMessage('Ce slug existe déjà. Deux contenus avec le même passeport, ça finit toujours au guichet.' );
    editFields.slug.focus();
    return;
  }

  const updatedSeasonsData = collectSeriesEpisodeData(current);
  const isSeries = isSeriesEntry(current);
  const firstEpisodeEmbed = getFirstEpisodeEmbed(updatedSeasonsData);
  const bubbleReasons = collectBubbleReasonsFromEditor();

  draft[editingIndex] = {
    ...current,
    title: editFields.title.value.trim() || current.title,
    slug: newSlug,
    year: editFields.year.value.trim(),
    category: editFields.category.value || current.category || (getCatalogueMediaType(current) === 'manga' ? 'manga' : (isSeries ? 'series' : 'films')),
    featured: editFields.featured.value === 'true',
    premium: editFields.premium?.value === 'true',
    homeFeatured: editFields.homeFeatured?.value === 'true',
    cinemaRelease: editFields.cinemaRelease?.value === 'true',
    cinemaReleaseOrder: Math.max(1, Number(editFields.cinemaReleaseOrder?.value || 1)),
    cinemaReleaseFeatured: editFields.cinemaReleaseFeatured?.value === 'true',
    genres: editFields.genres.value.split(',').map(genre => genre.trim()).filter(Boolean),
    rating: Number(editFields.rating.value || 0),
    poster: editFields.poster.value.trim(),
    backdrop: editFields.backdrop.value.trim(),
    trailer: editFields.trailer.value.trim(),
    videoEmbed: isSeries ? firstEpisodeEmbed : (editFields.videoEmbed ? editFields.videoEmbed.value.trim() : (current.videoEmbed || '')),
    seasonsData: isSeries ? updatedSeasonsData : current.seasonsData,
    seasons: isSeries ? updatedSeasonsData.length : Number(current.seasons || 0),
    episodes: isSeries ? countEpisodes(updatedSeasonsData) : Number(current.episodes || 0),
    overview: editFields.overview.value.trim(),
    bubbleReasons,
    projectionnisteAdvice: editFields.projectionnisteAdvice?.value.trim() || '',
    bubulle: {
      ...getBubulleData(current),
      profile: {
        ...getBubulleProfile(current),
        pace: editFields.bubblePace?.value.trim() || '',
        complexity: editFields.bubbleComplexity?.value.trim() || '',
        spectacle: editFields.bubbleSpectacle?.value.trim() || '',
        violence: editFields.bubbleViolence?.value.trim() || '',
        humour: editFields.bubbleHumour?.value.trim() || '',
        emotion: editFields.bubbleEmotion?.value.trim() || '',
        family: editFields.bubbleFamily?.value === 'true'
      }
    }
  };

  sortDraft();
  syncOutput();
  renderCatalogueList();
  closeEditor();
  showMessage('Fiche modifiée. Le catalogue est prêt à être exporté.');
}

function closeEditor() {
  editingIndex = -1;
  editPanel?.classList.add('is-hidden');
  seriesEpisodeManager?.classList.add('is-hidden');
  catalogueEditorGrid?.classList.remove('is-series-editing');
  catalogueEditorGrid?.classList.remove('is-editing-content');
  editPanel?.classList.remove('is-series-editing');
  if (editFields.videoEmbed) editFields.videoEmbed.closest('label')?.classList.remove('is-hidden');
}

async function refreshCatalogueItemFromTmdb(index) {
  const current = draft[index];
  if (!current) return;

  const selectedRefreshItem = getSelectedTmdbRefreshItem(current);

  if (selectedRefreshItem) {
    draft[index] = mergeTmdbRefresh(current, selectedRefreshItem);
    syncOutput();
    renderCatalogueList();
    if (editingIndex === index) openEditor(index);
    showMessage(`“${current.title}” actualisé avec la fiche TMDb sélectionnée. Casting : ${normalizeCast(selectedRefreshItem.cast).length} acteur(s).`);
    return;
  }

  const title = current.originalTitle || current.title || '';
  if (!title) {
    showMessage('Impossible d’actualiser : titre absent. Même TMDb ne lit pas dans le marc de pop-corn.');
    return;
  }

  showMessage(`Actualisation TMDb de “${current.title}” en cours…`);

  try {
    const mediaType = getCatalogueMediaType(current);
    const tmdbSearchType = getTmdbSearchType(mediaType);
    const res = await fetch(
      `/.netlify/functions/tmdb-search?query=${encodeURIComponent(title)}&type=${encodeURIComponent(tmdbSearchType)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.details || 'Réponse TMDb invalide');

    const results = (data.results || []).map(item => prepareItemForSelectedMediaType(item, getCatalogueMediaType(current)));
    const refreshed = findBestTmdbRefreshMatch(current, results);

    if (!refreshed) {
      showMessage('Aucune correspondance TMDb fiable trouvée. Le radar a vu du sable.');
      return;
    }

    draft[index] = mergeTmdbRefresh(current, refreshed);
    syncOutput();
    renderCatalogueList();
    if (editingIndex === index) openEditor(index);
    showMessage(`“${current.title}” actualisé depuis TMDb. Casting : ${normalizeCast(refreshed.cast).length} acteur(s). Options internes conservées.`);
  } catch (err) {
    console.error(err);
    showMessage(`Actualisation impossible : ${err.message}`);
  }
}

function getSelectedTmdbRefreshItem(current) {
  if (!selectedItem) return null;

  const normalized = normalizeTmdbItem(selectedItem);
  const currentType = getCatalogueMediaType(current);
  const selectedType = getCatalogueMediaType(normalized);
  if (currentType !== selectedType) return null;

  const sameTmdbId = current.tmdbId && normalized.tmdbId && String(current.tmdbId) === String(normalized.tmdbId);
  const sameTitle = normalizeComparableTitle(current.originalTitle || current.title || '') === normalizeComparableTitle(normalized.originalTitle || normalized.title || '');
  const sameYear = !current.year || !normalized.year || String(current.year) === String(normalized.year);

  return (sameTmdbId || (sameTitle && sameYear)) ? normalized : null;
}

function findBestTmdbRefreshMatch(current, results) {
  if (!results.length) return null;
  const currentTmdbId = String(current.tmdbId || '');
  if (currentTmdbId) {
    const sameId = results.find(item => String(item.tmdbId || '') === currentTmdbId);
    if (sameId) return sameId;
  }

  const currentType = getCatalogueMediaType(current);
  const currentTitle = normalizeComparableTitle(current.originalTitle || current.title || '');
  const currentYear = String(current.year || '');

  return results.find(item => {
    const sameType = getCatalogueMediaType(item) === currentType;
    const sameTitle = normalizeComparableTitle(item.originalTitle || item.title || '') === currentTitle;
    const sameYear = !currentYear || !item.year || String(item.year) === currentYear;
    return sameType && sameTitle && sameYear;
  }) || results.find(item => getCatalogueMediaType(item) === currentType) || results[0];
}

function mergeTmdbRefresh(current, tmdbItem) {
  const isSeries = isSeriesEntry(current);
  const currentVideo = current.videoEmbed || current.video_embed || current.embed || '';
  const refreshed = {
    ...current,
    originalTitle: tmdbItem.originalTitle || current.originalTitle || '',
    year: tmdbItem.year || current.year || '',
    releaseDate: tmdbItem.releaseDate || current.releaseDate || '',
    type: current.type || tmdbItem.type,
    mediaType: current.mediaType || tmdbItem.mediaType,
    genres: tmdbItem.genres?.length ? tmdbItem.genres : (current.genres || []),
    director: tmdbItem.director || current.director || 'À compléter',
    cast: normalizeCast(tmdbItem.cast?.length ? tmdbItem.cast : current.cast),
    runtime: Number(tmdbItem.runtime || current.runtime || 0),
    country: tmdbItem.country || current.country || '',
    language: tmdbItem.language || current.language || '',
    rating: Number(tmdbItem.rating || current.rating || 0),
    popularity: Number(tmdbItem.popularity || current.popularity || 0),
    trailer: tmdbItem.trailer || current.trailer || '',
    tagline: tmdbItem.tagline || current.tagline || '',
    status: tmdbItem.status || current.status || '',
    homepage: tmdbItem.homepage || current.homepage || '',
    collection: tmdbItem.collection || current.collection || '',
    studios: tmdbItem.studios?.length ? tmdbItem.studios : (current.studios || []),
    tmdbId: tmdbItem.tmdbId || current.tmdbId || '',
    poster: tmdbItem.poster || current.poster || '',
    backdrop: tmdbItem.backdrop || current.backdrop || '',
    overview: tmdbItem.overview || current.overview || '',
    // Options internes conservées
    slug: current.slug,
    category: current.category,
    featured: Boolean(current.featured),
    premium: Boolean(current.premium),
    homeFeatured: Boolean(current.homeFeatured),
    bubbleReasons: current.bubbleReasons || {},
    projectionnisteAdvice: current.projectionnisteAdvice || '',
    videoEmbed: currentVideo
  };

  if (isSeries) {
    refreshed.seasonsData = Array.isArray(tmdbItem.seasonsData) && tmdbItem.seasonsData.length
      ? preserveEpisodeEmbeds(current.seasonsData, tmdbItem.seasonsData)
      : current.seasonsData;
    refreshed.seasons = Array.isArray(refreshed.seasonsData) ? refreshed.seasonsData.length : Number(current.seasons || 0);
    refreshed.episodes = Array.isArray(refreshed.seasonsData) ? countEpisodes(refreshed.seasonsData) : Number(current.episodes || 0);
  } else {
    refreshed.seasonsData = current.seasonsData;
    refreshed.seasons = Number(current.seasons || 0);
    refreshed.episodes = Number(current.episodes || 0);
  }

  return refreshed;
}

function preserveEpisodeEmbeds(oldSeasons = [], newSeasons = []) {
  return newSeasons.map((season, seasonIndex) => {
    const seasonNumber = Number(season.seasonNumber || season.number || seasonIndex + 1);
    const oldSeason = (oldSeasons || []).find(item => Number(item.seasonNumber || item.number || 0) === seasonNumber);
    return {
      ...season,
      episodes: (season.episodes || []).map((episode, episodeIndex) => {
        const episodeNumber = Number(episode.episodeNumber || episode.number || episodeIndex + 1);
        const oldEpisode = (oldSeason?.episodes || []).find(item => Number(item.episodeNumber || item.number || 0) === episodeNumber);
        return {
          ...episode,
          videoEmbed: oldEpisode?.videoEmbed || oldEpisode?.embed || episode.videoEmbed || ''
        };
      })
    };
  });
}

function normalizeComparableTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeCast(cast = []) {
  if (!Array.isArray(cast)) return [];
  return cast
    .map(actor => {
      if (typeof actor === 'string') {
        const name = actor.trim();
        return name ? { name, character: '', profile_path: '', profile: '', id: null } : null;
      }
      if (!actor || typeof actor !== 'object') return null;
      const name = String(actor.name || '').trim();
      if (!name) return null;
      return {
        id: actor.id || null,
        name,
        character: String(actor.character || '').trim(),
        profile_path: actor.profile_path || '',
        profile: actor.profile || actor.profileUrl || buildTmdbProfileUrl(actor.profile_path || ''),
      };
    })
    .filter(Boolean);
}

function getCastSearchTerms(cast = []) {
  return normalizeCast(cast).flatMap(actor => [actor.name, actor.character].filter(Boolean));
}

function buildTmdbProfileUrl(path) {
  if (!path) return '';
  if (/^https?:/i.test(path)) return path;
  return `https://image.tmdb.org/t/p/w185${path}`;
}


function deleteCatalogueItem(index) {
  const entry = draft[index];
  if (!entry) return;
  const ok = confirm(`Supprimer “${entry.title || 'ce contenu'}” du brouillon ?`);
  if (!ok) return;

  draft.splice(index, 1);
  syncOutput();
  renderCatalogueList();
  closeEditor();
  showMessage('Contenu supprimé du brouillon. Paix à son affiche.');
}


function isSeriesEntry(entry) {
  const mediaType = (entry?.mediaType || entry?.media_type || '').toLowerCase();
  const type = (entry?.type || '').toLowerCase();
  const seasonsData = Array.isArray(entry?.seasonsData) ? entry.seasonsData : [];
  return mediaType === 'tv' || mediaType === 'manga' || type === 'serie' || type === 'manga' || seasonsData.length > 0;
}

function countEpisodes(seasonsData = []) {
  return seasonsData.reduce((total, season) => total + (Array.isArray(season.episodes) ? season.episodes.length : 0), 0);
}

function getFirstEpisodeEmbed(seasonsData = []) {
  const firstSeason = seasonsData.find(season => Array.isArray(season.episodes) && season.episodes.length);
  const firstEpisode = firstSeason?.episodes?.find(episode => String(episode.videoEmbed || episode.embed || '').trim());
  return String(firstEpisode?.videoEmbed || firstEpisode?.embed || '').trim();
}

function getEpisodeEmbedStats(entry) {
  const seasonsData = Array.isArray(entry?.seasonsData) ? entry.seasonsData : [];
  const episodes = seasonsData.flatMap(season => Array.isArray(season.episodes) ? season.episodes : []);
  const total = episodes.length;
  const missing = episodes.filter(episode => !String(episode.videoEmbed || episode.embed || '').trim()).length;
  return {total, missing, ready: total > 0 && missing < total};
}

function getMediaEmbedSummary(entry) {
  if (isSeriesEntry(entry)) {
    const stats = getEpisodeEmbedStats(entry);
    if (!stats.total) return {ready:false, missing:true, label:'Épisodes à importer'};
    if (stats.missing) return {ready:stats.ready, missing:true, label:`${stats.missing} épisode${stats.missing > 1 ? 's' : ''} sans embed`};
    return {ready:true, missing:false, label:'Tous les épisodes prêts'};
  }
  const ready = Boolean(String(entry?.videoEmbed || entry?.video_embed || entry?.embed || '').trim());
  return {ready, missing:!ready, label:'Embed manquant'};
}

function renderSeriesEpisodeEditor(entry) {
  if (!seriesEpisodeManager || !seriesEpisodeList) return;
  if (!isSeriesEntry(entry)) {
    seriesEpisodeManager.classList.add('is-hidden');
    seriesEpisodeList.innerHTML = '';
    return;
  }

  const seasonsData = ensureSeriesData(entry);
  seriesEpisodeManager.classList.remove('is-hidden');

  if (!seasonsData.length) {
    seriesEpisodeList.innerHTML = '<div class="admin-empty">Aucune saison récupérée. Relance l’import TMDb de la série pour générer les épisodes.</div>';
    return;
  }

  seriesEpisodeList.innerHTML = seasonsData.map((season, seasonIndex) => {
    const episodes = Array.isArray(season.episodes) ? season.episodes : [];
    const missing = episodes.filter(ep => !String(ep.videoEmbed || ep.embed || '').trim()).length;
    return `
      <section class="season-block" data-season-index="${seasonIndex}">
        <button class="season-toggle" type="button" data-season-toggle>
          <span>▼ Saison ${escapeHtml(String(season.seasonNumber || season.number || seasonIndex + 1))} · ${escapeHtml(season.title || '')}</span>
          <small>${episodes.length} épisode${episodes.length > 1 ? 's' : ''} · ${missing ? `${missing} sans embed` : 'prête'}</small>
        </button>
        <div class="season-episodes">
          ${episodes.map((episode, episodeIndex) => `
            <div class="episode-edit-row" data-episode-row data-season-index="${seasonIndex}" data-episode-index="${episodeIndex}">
              <strong>S${escapeHtml(String(season.seasonNumber || seasonIndex + 1))}E${escapeHtml(String(episode.episodeNumber || episode.number || episodeIndex + 1))}</strong>
              <label>Titre épisode
                <input type="text" data-episode-title value="${escapeAttr(episode.title || '')}">
                <span class="${String(episode.videoEmbed || episode.embed || '').trim() ? 'episode-ready' : 'episode-missing'}">${String(episode.videoEmbed || episode.embed || '').trim() ? 'Embed renseigné' : 'Embed manquant'}</span>
              </label>
              <label>Embed épisode
                <textarea data-episode-embed spellcheck="false" placeholder="<iframe src=&quot;https://...&quot; allowfullscreen></iframe>">${escapeHtml(episode.videoEmbed || episode.embed || '')}</textarea>
              </label>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }).join('');

  seriesEpisodeList.querySelectorAll('[data-season-toggle]').forEach(button => {
    button.addEventListener('click', () => button.closest('.season-block')?.classList.toggle('is-collapsed'));
  });
}

function ensureSeriesData(entry) {
  if (Array.isArray(entry.seasonsData)) return entry.seasonsData;
  entry.seasonsData = [];
  return entry.seasonsData;
}

function collectSeriesEpisodeData(current) {
  if (!isSeriesEntry(current)) return current.seasonsData;
  const base = JSON.parse(JSON.stringify(ensureSeriesData(current)));
  if (!seriesEpisodeList) return base;

  seriesEpisodeList.querySelectorAll('[data-episode-row]').forEach(row => {
    const seasonIndex = Number(row.dataset.seasonIndex);
    const episodeIndex = Number(row.dataset.episodeIndex);
    const episode = base?.[seasonIndex]?.episodes?.[episodeIndex];
    if (!episode) return;
    episode.title = row.querySelector('[data-episode-title]')?.value.trim() || episode.title || `Épisode ${episode.episodeNumber || episodeIndex + 1}`;
    episode.videoEmbed = row.querySelector('[data-episode-embed]')?.value.trim() || '';
  });

  return base;
}

function toggleAllSeasons() {
  if (!seriesEpisodeList) return;
  const blocks = [...seriesEpisodeList.querySelectorAll('.season-block')];
  const shouldCollapse = blocks.some(block => !block.classList.contains('is-collapsed'));
  blocks.forEach(block => block.classList.toggle('is-collapsed', shouldCollapse));
  if (collapseSeasonsBtn) collapseSeasonsBtn.textContent = shouldCollapse ? 'Tout ouvrir' : 'Tout replier';
}

function updateGenreSelect(item) {
  resetGenreSelect();
  item.genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre;
    option.textContent = genre;
    genreSelect?.appendChild(option);
  });
}

function resetGenreSelect() {
  if (!genreSelect) return;
  genreSelect.innerHTML = '<option value="">Automatique</option>';
}

function resetDraft() {
  localStorage.removeItem('catalogueDraft');
  location.reload();
}

function clearSelection() {
  selectedItem = null;
  resetGenreSelect();
  if (results) {
    results.innerHTML = '<div class="admin-empty">Sélection vidée. Lance une nouvelle recherche pour repartir proprement.</div>';
  }
  if (preview) {
    preview.innerHTML = `
      <div class="preview-poster">Aucun contenu sélectionné</div>
      <div class="preview-body">
        <h3>En attente de recherche</h3>
        <div class="preview-meta"><span>Source enrichie</span><span>Prévisualisation</span></div>
        <p>Sélectionne un résultat pour vérifier l’affiche, le résumé et les informations principales.</p>
      </div>
    `;
  }
}

function syncOutput() {
  const json = JSON.stringify(draft, null, 2);
  if (output) output.value = json;
  localStorage.setItem('catalogueDraft', json);
}

async function copyJson() {
  if (!output) return;
  try {
    await navigator.clipboard.writeText(output.value);
    showMessage('Catalogue copié dans le presse-papier.');
  } catch (err) {
    output.select();
    document.execCommand('copy');
    showMessage('Catalogue copié.');
  }
}

function downloadJson() {
  if (!output) return;
  const blob = new Blob([output.value], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'catalogue.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isDuplicate(item) {
  return Boolean(findDuplicate(item));
}

function findDuplicate(item) {
  return draft.find(entry => {
    const sameTmdbId = entry.tmdbId && item.tmdbId && String(entry.tmdbId) === String(item.tmdbId);
    const sameSlugAndType = entry.slug === item.slug && entry.type === item.type;
    return sameTmdbId || sameSlugAndType;
  });
}

function uniqueSlug(baseSlug) {
  let slug = baseSlug || 'contenu';
  let counter = 2;
  const existingSlugs = new Set(draft.map(entry => entry.slug));

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
}

function sortDraft() {
  draft.sort((a, b) => {
    if ((b.featured ? 1 : 0) !== (a.featured ? 1 : 0)) return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    return String(b.year || '').localeCompare(String(a.year || '')) || String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function refreshVisibleResults() {
  const cards = [...document.querySelectorAll('.tmdb-result')];
  cards.forEach(card => {
    const title = card.querySelector('h3')?.textContent || '';
    const entry = draft.find(item => item.title === title);
    if (!entry) return;
    card.classList.add('is-duplicate');
    const button = card.querySelector('[data-action="add"]');
    if (button) button.textContent = 'Déjà présent';
  });
}

function showMessage(message) {
  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add('is-visible'), 10);
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function slugify(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
