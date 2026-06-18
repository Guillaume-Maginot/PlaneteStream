const state = {
  catalogue: [],
  filter: 'all',
  search: '',
  heroIndex: 0,
  heroTimer: null,
  heroDirection: 1,
  heroSlideTimeout: null,
  heroPaused: false,
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
    document.querySelector('#catalogueGrid').innerHTML = '<p class="empty-state">Impossible de charger le catalogue pour le moment. Réessaie dans quelques instants.</p>';
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

  const hero = document.querySelector('#dynamicHero');
  hero?.addEventListener('mouseenter', pauseHeroRotation);
  hero?.addEventListener('mouseleave', resumeHeroRotation);
  hero?.addEventListener('mousemove', handleHeroParallax);
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
  renderHero(false);
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

function renderHero(animate = true){
  const hero = document.querySelector('#dynamicHero');
  if(!hero || !state.catalogue.length) return;
  const items = getHeroItems();
  if(!items.length) return;
  state.heroIndex = Math.min(state.heroIndex, items.length - 1);
  const item = items[state.heroIndex];
  const directionClass = state.heroDirection >= 0 ? 'hero-slide-next' : 'hero-slide-prev';
  hero.classList.remove('hero-slide-next', 'hero-slide-prev');
  if(animate){
    clearTimeout(state.heroSlideTimeout);
    void hero.offsetWidth;
    hero.classList.add(directionClass);
    state.heroSlideTimeout = setTimeout(() => hero.classList.remove(directionClass), 520);
  }
  const year = item.year || (item.releaseDate || '').slice(0,4);
  const genres = (item.genres || []).slice(0,3).join(' • ');
  hero.style.backgroundImage = `linear-gradient(90deg, rgba(2,3,10,.97) 0%, rgba(2,3,10,.78) 35%, rgba(2,3,10,.25) 78%), url('${item.backdrop || item.poster || ''}')`;
  hero.style.backgroundPosition = state.heroDirection >= 0 ? 'center center' : 'right center';
  hero.querySelector('#heroEyebrow').textContent = item.featured ? 'À la une' : 'Sélection Planète Stream';
  hero.querySelector('#heroTitle').textContent = item.title || 'Planète Stream';
  hero.querySelector('#heroMeta').textContent = [year, formatType(item.type), genres, item._rating ? `⭐ ${item._rating.toFixed(1)}` : ''].filter(Boolean).join('   ');
  const detailHref = `detail.html?slug=${encodeURIComponent(item.slug)}`;
  const watchHref = getWatchHref(item);
  const heroWatch = hero.querySelector('#heroWatch');
  heroWatch.href = watchHref;
  heroWatch.target = isExternalHref(watchHref) ? '_blank' : '_self';
  heroWatch.rel = isExternalHref(watchHref) ? 'noopener noreferrer' : '';
  const heroDetail = hero.querySelector('#heroDetail');
  if(heroDetail) heroDetail.href = detailHref;

  const counter = hero.querySelector('#heroCounter');
  if(counter) counter.textContent = `${String(state.heroIndex + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
  resetHeroProgress();
}

function startHeroRotation(){
  const items = getHeroItems();
  const hero = document.querySelector('#dynamicHero');
  clearInterval(state.heroTimer);
  if(!hero || items.length < 2) return;
  if(state.heroPaused) return;
  hero.classList.add('hero-progress-running');
  state.heroTimer = setInterval(() => moveHero(1), 5000);
}

function pauseHeroRotation(){
  state.heroPaused = true;
  clearInterval(state.heroTimer);
  document.querySelector('#dynamicHero')?.classList.add('hero-paused');
}

function resumeHeroRotation(){
  state.heroPaused = false;
  const hero = document.querySelector('#dynamicHero');
  if(hero){
    hero.classList.remove('hero-paused');
    hero.style.backgroundPosition = state.heroDirection >= 0 ? 'center center' : 'right center';
  }
  startHeroRotation();
}

function resetHeroProgress(){
  const hero = document.querySelector('#dynamicHero');
  if(!hero) return;
  hero.classList.remove('hero-progress-running');
  void hero.offsetWidth;
  if(!state.heroPaused && getHeroItems().length > 1) hero.classList.add('hero-progress-running');
}

function handleHeroParallax(event){
  const hero = event.currentTarget;
  if(!hero) return;
  const rect = hero.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - .5) * 4;
  const y = ((event.clientY - rect.top) / rect.height - .5) * 3;
  hero.style.backgroundPosition = `${50 + x}% ${50 + y}%`;
}

function moveHero(direction){
  const items = getHeroItems();
  if(!items.length) return;
  state.heroDirection = direction >= 0 ? 1 : -1;
  state.heroIndex = (state.heroIndex + direction + items.length) % items.length;
  renderHero(true);
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
  const card = document.createElement('article');
  card.className = 'card';
  const year = item.year || (item.releaseDate || '').slice(0,4);
  const detailHref = `detail.html?slug=${encodeURIComponent(item.slug)}`;
  const watchHref = getWatchHref(item);
  const watchTarget = isExternalHref(watchHref) ? ' target="_blank" rel="noopener noreferrer"' : '';
  card.innerHTML = `
    <a class="poster poster-link" href="${detailHref}" data-title="${escapeHtml(item.title)}" style="background-image:url('${item.poster || ''}'), ${posterFallback}" aria-label="Voir la fiche ${escapeHtml(item.title)}"></a>
    <div class="info">
      <h3>${escapeHtml(item.title)}</h3>
      <div class="meta">
        <span>${escapeHtml(formatType(item.type || item.mediaType || 'film'))}</span>
        ${year ? `<span>${escapeHtml(year)}</span>` : ''}
        ${(item.genres || []).slice(0,2).map(g => `<span>${escapeHtml(g)}</span>`).join('')}
      </div>
      <div class="card-actions">
        <a class="card-play" href="${watchHref}"${watchTarget}>▶ Lecture</a>
        <a class="card-detail" href="${detailHref}">Fiche</a>
      </div>
    </div>`;
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


function getWatchHref(item){
  return `watch.html?slug=${encodeURIComponent(item.slug)}`;
}

function isExternalHref(href=''){
  return /^https?:\/\//i.test(String(href));
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
