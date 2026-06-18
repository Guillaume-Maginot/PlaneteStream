const state = {
  catalogue: [],
  filter: 'all',
  search: '',
  heroIndex: 0,
  heroTimer: null,
};

const posterFallback = 'linear-gradient(145deg,#3b1c70,#111), radial-gradient(circle at 60% 35%,rgba(255,255,255,.25),transparent 18%)';

async function init(){
  try{
    const res = await fetch('data/catalogue.json');
    state.catalogue = await res.json();
    normalizeCatalogue();
    buildGenreFilter();
    bindEvents();
    render();
    startHeroRotation();
  }catch(error){
    console.error(error);
    document.querySelector('#catalogueGrid').innerHTML = '<p class="empty-state">Impossible de charger le catalogue. Le vaisseau JSON a probablement raté son saut hyperspatial.</p>';
  }
}

function normalizeCatalogue(){
  state.catalogue = state.catalogue.map((item, index) => ({
    ...item,
    _index: index,
    _year: Number(item.year || (item.releaseDate || '').slice(0,4)) || 0,
    _rating: Number(item.rating) || 0,
    _popularity: Number(item.popularity) || 0,
  }));
}

function bindEvents(){
  document.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    syncActiveTabs();
    resetGenreFilter();
    render();
  }));

  document.querySelectorAll('[data-nav-filter]').forEach(link => link.addEventListener('click', () => {
    state.filter = link.dataset.navFilter;
    syncActiveTabs();
    resetGenreFilter();
    render();
  }));

  const search = document.querySelector('#searchInput');
  search?.addEventListener('input', e => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });

  document.querySelector('#genreFilter')?.addEventListener('change', e => {
    state.filter = e.target.value || 'all';
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    render();
  });

  document.querySelector('#surpriseBtn')?.addEventListener('click', () => openRandomTitle());
  document.querySelector('#heroPrev')?.addEventListener('click', () => moveHero(-1));
  document.querySelector('#heroNext')?.addEventListener('click', () => moveHero(1));
}

function syncActiveTabs(){
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === state.filter));
}

function resetGenreFilter(){
  const genre = document.querySelector('#genreFilter');
  if(genre) genre.value = '';
}

function buildGenreFilter(){
  const select = document.querySelector('#genreFilter');
  if(!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Tous les genres</option>';
  const genres = [...new Set(state.catalogue.flatMap(item => item.genres || []))].sort((a,b) => a.localeCompare(b, 'fr'));
  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre.toLowerCase();
    option.textContent = genre;
    select.appendChild(option);
  });
  select.value = current;
}

function matches(item){
  const haystack = [item.title, item.originalTitle, item.type, item.category, item.director, item.tagline, ...(item.genres || []), ...(item.cast || [])].join(' ').toLowerCase();
  const filterOk = state.filter === 'all' || item.type === state.filter || item.mediaType === state.filter || haystack.includes(state.filter);
  const searchOk = !state.search || haystack.includes(state.search);
  return filterOk && searchOk;
}

function render(){
  renderHero();
  renderStats();

  const filtered = state.catalogue.filter(matches);
  const featured = state.catalogue.filter(i => i.featured).slice(0,10);
  const latest = [...state.catalogue].sort((a,b) => b._index - a._index).slice(0,10);
  const topRated = [...state.catalogue].sort((a,b) => b._rating - a._rating).slice(0,10);
  const recentYears = [...state.catalogue].sort((a,b) => b._year - a._year || b._popularity - a._popularity).slice(0,10);

  mount('#featuredGrid', featured);
  mount('#latestGrid', latest);
  mount('#topRatedGrid', topRated);
  mount('#recentYearsGrid', recentYears);
  mount('#catalogueGrid', filtered);

  const browsing = state.filter === 'all' && !state.search;
  document.querySelector('#featuredSection').style.display = browsing ? 'block' : 'none';
  document.querySelector('#latestSection').style.display = browsing ? 'block' : 'none';
  document.querySelector('#topRatedSection').style.display = browsing ? 'block' : 'none';
  document.querySelector('#recentYearsSection').style.display = browsing ? 'block' : 'none';

  document.querySelector('#countLabel').textContent = `${filtered.length} titre${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''}`;
}

function getHeroItems(){
  const source = state.catalogue.filter(item => item.backdrop && (item.featured || item._rating >= 6.5));
  return (source.length ? source : state.catalogue).slice(0, 8);
}

function renderHero(){
  const hero = document.querySelector('#dynamicHero');
  if(!hero || !state.catalogue.length) return;
  const items = getHeroItems();
  if(!items.length) return;
  state.heroIndex = Math.min(state.heroIndex, items.length - 1);
  const item = items[state.heroIndex];
  const year = item.year || (item.releaseDate || '').slice(0,4);
  const genres = (item.genres || []).slice(0,3).join(' • ');
  hero.style.backgroundImage = `linear-gradient(90deg, rgba(2,3,10,.97) 0%, rgba(2,3,10,.78) 35%, rgba(2,3,10,.25) 78%), url('${item.backdrop || item.poster || ''}')`;
  hero.querySelector('#heroEyebrow').textContent = item.featured ? 'À la une' : 'Sélection Planète Stream';
  hero.querySelector('#heroTitle').textContent = item.title || 'Planète Stream';
  hero.querySelector('#heroMeta').textContent = [year, formatType(item.type), genres, item._rating ? `⭐ ${item._rating.toFixed(1)}` : ''].filter(Boolean).join('   ');
  hero.querySelector('#heroOverview').textContent = item.overview || 'Un contenu à découvrir dans votre catalogue.';
  hero.querySelector('#heroWatch').href = `detail.html?slug=${encodeURIComponent(item.slug)}`;
}

function startHeroRotation(){
  const items = getHeroItems();
  if(items.length < 2) return;
  clearInterval(state.heroTimer);
  state.heroTimer = setInterval(() => moveHero(1), 15000);
}

function moveHero(direction){
  const items = getHeroItems();
  if(!items.length) return;
  state.heroIndex = (state.heroIndex + direction + items.length) % items.length;
  renderHero();
  startHeroRotation();
}

function renderStats(){
  const total = state.catalogue.length;
  const films = state.catalogue.filter(i => i.type === 'film' || i.mediaType === 'movie').length;
  const series = state.catalogue.filter(i => i.type === 'serie' || i.mediaType === 'tv').length;
  const genres = new Set(state.catalogue.flatMap(i => i.genres || [])).size;
  setText('#statTotal', total);
  setText('#statFilms', films);
  setText('#statSeries', series);
  setText('#statGenres', genres);
}

function setText(selector, value){
  const node = document.querySelector(selector);
  if(node) node.textContent = value;
}

function createCard(item){
  const card = document.createElement('button');
  card.className = 'card';
  const year = item.year || (item.releaseDate || '').slice(0,4);
  card.innerHTML = `
    <div class="poster" data-title="${escapeHtml(item.title)}" style="background-image:url('${item.poster || ''}'), ${posterFallback}"></div>
    <div class="info">
      <h3>${escapeHtml(item.title)}</h3>
      <div class="meta">
        <span>${escapeHtml(formatType(item.type || item.mediaType || 'film'))}</span>
        ${year ? `<span>${escapeHtml(year)}</span>` : ''}
        ${(item.genres || []).slice(0,2).map(g => `<span>${escapeHtml(g)}</span>`).join('')}
      </div>
    </div>`;
  card.addEventListener('click', () => {
    window.location.href = `detail.html?slug=${encodeURIComponent(item.slug)}`;
  });
  return card;
}

function mount(selector, list){
  const grid = document.querySelector(selector);
  if(!grid) return;
  grid.innerHTML = '';
  if(!list.length){
    grid.innerHTML = '<p class="empty-state">Aucun titre trouvé. Même le pop-corn attend une meilleure requête.</p>';
    return;
  }
  list.forEach(item => grid.appendChild(createCard(item)));
}

function openRandomTitle(){
  const pool = state.catalogue.filter(matches);
  const list = pool.length ? pool : state.catalogue;
  if(!list.length) return;
  const item = list[Math.floor(Math.random() * list.length)];
  window.location.href = `detail.html?slug=${encodeURIComponent(item.slug)}`;
}

function formatType(type=''){
  const value = String(type).toLowerCase();
  const labels = { movie: 'Film', film: 'Film', tv: 'Série', serie: 'Série', series: 'Série', manga: 'Manga', anime: 'Anime' };
  return labels[value] || type;
}

function escapeHtml(str=''){
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

init();
