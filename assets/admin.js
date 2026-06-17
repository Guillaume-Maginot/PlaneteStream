let draft = [];

const imageBase = 'https://image.tmdb.org/t/p/w500';
const backdropBase = 'https://image.tmdb.org/t/p/w1280';

const output = document.querySelector('#jsonOutput');
const results = document.querySelector('#results');

const searchBtn = document.querySelector('#searchBtn');
const downloadBtn = document.querySelector('#downloadBtn');
const copyBtn = document.querySelector('#copyBtn');
const resetBtn = document.querySelector('#resetBtn');

init();

async function init() {
  try {
    const saved = localStorage.getItem('catalogueDraft');

    if (saved) {
      draft = JSON.parse(saved);
    } else {
      const res = await fetch('data/catalogue.json');
      draft = await res.json();
    }

    syncOutput();
  } catch (err) {
    console.error(err);
    draft = [];
    syncOutput();
    output.value = '[]';
  }

  searchBtn?.addEventListener('click', searchTmdb);
  downloadBtn?.addEventListener('click', downloadJson);
  copyBtn?.addEventListener('click', copyJson);
  resetBtn?.addEventListener('click', resetDraft);
}

async function searchTmdb() {
  const query = document.querySelector('#query').value.trim();
  const mediaType = document.querySelector('#mediaType').value;

  if (!query) return;

  results.innerHTML = '<p>Recherche en cours...</p>';

  try {
    const res = await fetch(
      `/.netlify/functions/tmdb-search?query=${encodeURIComponent(query)}&type=${mediaType}`
    );

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    results.innerHTML = '';

    if (!data.results || data.results.length === 0) {
      results.innerHTML = '<p>Aucun résultat trouvé.</p>';
      return;
    }

    data.results
      .slice(0, 8)
      .forEach(item => results.appendChild(resultCard(item, mediaType)));

  } catch (err) {
    results.innerHTML = `
      <p>Impossible d’appeler TMDb. Vérifie la clé Netlify.</p>
      <p>Détail : ${err.message}</p>
    `;
  }
}

function resultCard(item, mediaType) {
  const title = item.title || item.name || 'Titre inconnu';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const slug = slugify(title);

  const el = document.createElement('div');
  el.className = 'tmdb-result';

  const poster = item.poster_path ? imageBase + item.poster_path : '';

  el.innerHTML = `
    <img src="${poster}" alt="">
    <div>
      <h3>${title}</h3>
      <p>${year || 'Année inconnue'} · ${
        item.overview ? item.overview.slice(0, 120) + '…' : 'Résumé absent'
      }</p>
      <button class="primary">Ajouter au JSON</button>
    </div>
  `;

  el.querySelector('button').addEventListener('click', () => {
    const alreadyExists = draft.some(entry => {
  const sameTmdbId =
    entry.tmdbId &&
    item.id &&
    String(entry.tmdbId) === String(item.id);

  const sameSlug =
    entry.slug &&
    slug &&
    entry.slug === slug &&
    entry.type === (mediaType === 'tv' ? 'serie' : 'film');

  return sameTmdbId || sameSlug;
});

if (alreadyExists) {
  const confirmAdd = confirm(
    'Un élément similaire semble déjà exister. Tu veux quand même l’ajouter ?'
  );

  if (!confirmAdd) return;
}

    draft.push({
      title,
      slug,
      type: mediaType === 'tv' ? 'serie' : 'film',
      category: mediaType === 'tv' ? 'Série' : 'Film',
      genres: [],
      director: 'À compléter',
      cast: [],
      tmdbId: item.id,
      poster: item.poster_path
  ? imageBase + item.poster_path
  : '',
backdrop: item.backdrop_path
  ? backdropBase + item.backdrop_path
  : '',
      overview: item.overview || '',
      featured: false
    });

    syncOutput();
    alert(`${title} ajouté au JSON.`);
  });

  return el;
}

function resetDraft() {
  localStorage.removeItem('catalogueDraft');
  location.reload();
}

function syncOutput() {
  const json = JSON.stringify(draft, null, 2);
  output.value = json;
  localStorage.setItem('catalogueDraft', json);
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(output.value);
    alert('JSON copié dans le presse-papier.');
  } catch (err) {
    output.select();
    document.execCommand('copy');
    alert('JSON copié.');
  }
}

function downloadJson() {
  const blob = new Blob([output.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'catalogue.json';
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}