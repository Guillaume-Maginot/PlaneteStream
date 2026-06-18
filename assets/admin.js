let draft = [];
let selectedItem = null;

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
const genreSelect = document.querySelector('#genreSelect');

init();

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
  downloadBtn?.addEventListener('click', downloadJson);
  copyBtn?.addEventListener('click', copyJson);
  resetBtn?.addEventListener('click', resetDraft);
  clearBtn?.addEventListener('click', clearSelection);
}

async function searchTmdb() {
  const query = queryInput?.value.trim() || '';
  const mediaType = mediaTypeSelect?.value || 'all';

  if (!query) {
    showMessage('Entre un titre avant de lancer la chasse au trésor TMDb.');
    queryInput?.focus();
    return;
  }

  results.innerHTML = '<div class="admin-empty">Recherche en cours… Le hamster TMDb pédale.</div>';

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
      results.innerHTML = '<div class="admin-empty">Aucun résultat trouvé. TMDb a regardé sous le canapé, rien.</div>';
      return;
    }

    filteredResults
      .slice(0, 8)
      .forEach(item => results.appendChild(resultCard(normalizeTmdbItem(item))));
  } catch (err) {
    console.error(err);
    results.innerHTML = `
      <div class="admin-empty">
        <strong>Impossible d’appeler TMDb.</strong><br>
        Vérifie la variable Netlify <code>TMDB_BEARER_TOKEN</code>.<br>
        <small>${escapeHtml(err.message)}</small>
      </div>
    `;
  }
}

function filterByMediaType(items, mediaType) {
  if (mediaType === 'movie') return items.filter(item => item.mediaType === 'movie' || item.type === 'film');
  if (mediaType === 'tv') return items.filter(item => item.mediaType === 'tv' || item.type === 'serie');
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
        <button class="primary" type="button" data-action="add">${exists ? 'Déjà présent' : 'Ajouter au JSON'}</button>
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
  showMessage(`“${entry.title}” ajouté au JSON. Le catalogue grossit, mais sans grogner.`);
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
    category: sectionSelect?.value || (item.mediaType === 'tv' ? 'series' : 'films'),
    genres,
    director: item.director || 'À compléter',
    cast: item.cast || [],
    runtime: item.runtime || 0,
    seasons: item.seasons || 0,
    episodes: item.episodes || 0,
    country: item.country || '',
    language: item.language || '',
    rating: Number(item.rating || 0),
    popularity: Number(item.popularity || 0),
    trailer: item.trailer || '',
    tagline: item.tagline || '',
    status: item.status || '',
    homepage: item.homepage || '',
    collection: item.collection || '',
    studios: item.studios || [],
    tmdbId: item.tmdbId,
    poster: item.poster || '',
    backdrop: item.backdrop || '',
    overview: item.overview || '',
    featured: featuredSelect?.value === 'true'
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
    cast: Array.isArray(item.cast) ? item.cast.filter(Boolean) : [],
    runtime: Number(item.runtime || 0),
    seasons: Number(item.seasons || 0),
    episodes: Number(item.episodes || 0),
    country: item.country || '',
    language: item.language || '',
    rating: Number(item.rating || 0),
    popularity: Number(item.popularity || 0),
    trailer: item.trailer || '',
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

  const runtimeLabel = item.mediaType === 'tv'
    ? `${item.seasons || 0} saison(s) · ${item.episodes || 0} épisode(s)`
    : `${item.runtime || 0} min`;

  preview.innerHTML = `
    <div class="preview-poster">
      ${item.poster ? `<img src="${escapeAttr(item.poster)}" alt="Affiche ${escapeAttr(item.title)}">` : 'Aucune affiche'}
    </div>
    <div class="preview-body">
      <h3>${escapeHtml(item.title)}</h3>
      <div class="preview-meta">
        <span>${item.mediaType === 'tv' ? 'Série' : 'Film'}</span>
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
  genreSelect.innerHTML = '<option value="">Auto TMDb</option>';
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
        <div class="preview-meta"><span>TMDb</span><span>PoC</span></div>
        <p>Sélectionne un résultat pour préparer son import dans le catalogue.</p>
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
    showMessage('JSON copié dans le presse-papier. Le presse-papier porte désormais une petite cape.');
  } catch (err) {
    output.select();
    document.execCommand('copy');
    showMessage('JSON copié.');
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
