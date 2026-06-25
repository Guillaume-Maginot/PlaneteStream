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
    applySearchFromUrl();
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
    premium: item.premium === true || item.premium === 'true',
    featured: item.featured === true || item.featured === 'true',
    homeFeatured: item.homeFeatured === true || item.homeFeatured === 'true',
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
    setActiveMenuLink(link);
    syncActiveTabs();
    resetGenreFilter();
    render();
  }));

  const search = document.querySelector('#searchInput');
  search?.addEventListener('input', e => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });

  search?.addEventListener('keydown', e => {
    if(e.key !== 'Enter') return;
    e.preventDefault();
    state.search = e.target.value.trim().toLowerCase();
    render();
    focusSearchResults();
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


function setActiveMenuLink(activeLink){
  document.querySelectorAll('.menu a').forEach(link => link.classList.remove('active'));
  activeLink?.classList.add('active');
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
  const haystack = [
    item.title,
    item.originalTitle,
    item.type,
    item.mediaType,
    item.category,
    item.director,
    item.tagline,
    ...(item.genres || []),
    ...getCastSearchTerms(item.cast)
  ].join(' ').toLowerCase();

  const manga = isManga(item);
  const filterOk = state.filter === 'manga'
    ? manga
    : state.filter === 'all'
      ? isStandardCatalogueItem(item)
      : !manga && (item.type === state.filter || item.mediaType === state.filter || haystack.includes(state.filter));

  const searchOk = !state.search || haystack.includes(state.search);
  return filterOk && searchOk;
}

function getCastSearchTerms(cast = []){
  if(!Array.isArray(cast)) return [];
  return cast.flatMap(actor => {
    if(typeof actor === 'string') return [actor];
    if(!actor || typeof actor !== 'object') return [];
    return [actor.name, actor.character].filter(Boolean);
  });
}

function isManga(item){
  // Manga peut venir de l'admin sous plusieurs costumes selon la source TMDb
  // (film Akira, série anime, catégorie forcée, ancien export, etc.).
  const values = [
    item?.type,
    item?.mediaType,
    item?.category,
    item?.section,
    item?.contentType,
    item?.tmdbType
  ].map(value => String(value || '').toLowerCase().trim());

  return values.some(value =>
    value === 'manga' ||
    value === 'mangas' ||
    value === 'anime' ||
    value === 'animé' ||
    value === 'animés' ||
    value.includes('manga') ||
    value.includes('anime')
  );
}

function isStandardCatalogueItem(item){
  return !isManga(item);
}

function applySearchFromUrl(){
  const params = new URLSearchParams(window.location.search);
  const searchValue = params.get('search') || params.get('q') || '';
  if(!searchValue.trim()) return;
  state.search = searchValue.trim().toLowerCase();
  const input = document.querySelector('#searchInput');
  if(input) input.value = searchValue.trim();
  window.requestAnimationFrame(focusSearchResults);
}


function focusSearchResults(){
  const target = document.querySelector('#catalogue');
  if(!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('search-jump-highlight');
    setTimeout(() => target.classList.remove('search-jump-highlight'), 900);
  });
}

function render(){
  renderHero(false);
  renderStats();

  const browsing = state.filter === 'all' && !state.search;
  const standardCatalogue = state.catalogue.filter(isStandardCatalogueItem);
  const mangaCatalogue = state.catalogue.filter(isManga);
  const filtered = state.catalogue.filter(matches).sort(sortByTitle);

  // Tri général lisible : A → Z pour les rails éditoriaux et le catalogue.
  // Les mangas ont leur propre rail d'accueil et leur propre catalogue : ils ne remontent pas dans le catalogue général.
  const premium = standardCatalogue.filter(i => i.premium && i.featured).sort(sortByRecentYear).slice(0,1);
  const featured = standardCatalogue.filter(i => i.featured).sort(sortByTitle).slice(0,10);
  const latest = [...standardCatalogue].sort(sortByLatest).slice(0,10);
  const latestManga = [...mangaCatalogue].sort(sortByLatest).slice(0,10);
  const topRated = [...standardCatalogue].sort(sortByRating).slice(0,10);

  mountPremium('#premiumGrid', premium);
  mount('#featuredGrid', featured);
  mount('#latestGrid', latest);
  mount('#latestMangaGrid', latestManga);
  mount('#topRatedGrid', topRated);
  mount('#catalogueGrid', filtered);

  document.querySelector('#premiumSection').style.display = browsing && premium.length ? 'block' : 'none';
  document.querySelector('#featuredSection').style.display = browsing && featured.length ? 'block' : 'none';
  document.querySelector('#latestSection').style.display = browsing ? 'block' : 'none';
  document.querySelector('#latestMangaSection').style.display = browsing && latestManga.length ? 'block' : 'none';
  document.querySelector('#topRatedSection').style.display = browsing ? 'block' : 'none';
  const sagasSection = document.querySelector('#sagasSection');
  if(sagasSection) sagasSection.style.display = browsing ? 'block' : 'none';

  const catalogueTitle = document.querySelector('#catalogueFullSection .section-title');
  if(catalogueTitle) catalogueTitle.textContent = state.filter === 'manga' ? 'Catalogue Manga' : 'Catalogue complet';
  document.querySelector('#countLabel').textContent = `${filtered.length} titre${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''}`;
}

function getHeroItems(){
  // Carrousel principal = films marqués "À la une / Sous les projecteurs".
  // Le flag homeFeatured sert uniquement à la vitrine Premium.
  const source = state.catalogue.filter(item => isStandardCatalogueItem(item) && item.backdrop && item.featured).sort(sortByTitle);
  return (source.length ? source : state.catalogue.filter(item => isStandardCatalogueItem(item) && item.backdrop).sort(sortByTitle)).slice(0, 8);
}

function sortByTitle(a,b){
  return String(a?.title || '').localeCompare(String(b?.title || ''), 'fr', { sensitivity:'base' });
}

function sortByLatest(a,b){
  return (b._index || 0) - (a._index || 0) || sortByTitle(a,b);
}

function sortByRating(a,b){
  return (Number(b._rating || 0) - Number(a._rating || 0)) || (Number(b._popularity || 0) - Number(a._popularity || 0)) || sortByTitle(a,b);
}

function sortByRecentYear(a,b){
  return (Number(b._year || 0) - Number(a._year || 0)) || (Number(b._popularity || 0) - Number(a._popularity || 0)) || sortByTitle(a,b);
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
  hero.querySelector('#heroEyebrow').textContent = item.homeFeatured ? 'Sous le projecteur' : (item.featured ? 'À la une' : 'Sélection Planète Stream');
  hero.querySelector('#heroTitle').textContent = item.title || 'Planète Stream';
  hero.querySelector('#heroMeta').textContent = [year, formatType(item.type), genres, item._rating ? `⭐ ${item._rating.toFixed(1)}` : ''].filter(Boolean).join('   ');
  const detailHref = getDetailHref(item);
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
  const detailHref = getDetailHref(item);
  const watchHref = getWatchHref(item);
  const watchTarget = isExternalHref(watchHref) ? ' target="_blank" rel="noopener noreferrer"' : '';
  card.innerHTML = `
    <a class="poster poster-link" href="${detailHref}" data-title="${escapeHtml(item.title)}" style="background-image:url('${item.poster || ''}'), ${posterFallback}" aria-label="Voir la fiche ${escapeHtml(item.title)}"></a>
    <div class="info">
      <div class="compact-meta" aria-label="Informations ${escapeHtml(item.title)}">
        <span>${escapeHtml(formatType(item.type || item.mediaType || 'film'))}</span>
        ${year ? `<span>${escapeHtml(year)}</span>` : ''}
        ${item.premium ? '<span>⭐ Premium</span>' : ''}
      </div>
      <div class="compact-genres">
        ${(item.genres || []).slice(0,2).map(g => `<span>${escapeHtml(g)}</span>`).join('')}
      </div>
      <div class="card-actions">
        <a class="card-play" href="${watchHref}"${watchTarget}>▶ Lecture</a>
        <a class="card-detail" href="${detailHref}">Fiche</a>
      </div>
    </div>`;
  return card;
}

function createPremiumCard(item){
  const card = document.createElement('article');
  card.className = 'premium-home-card premium-home-cinema';
  const year = item.year || (item.releaseDate || '').slice(0,4);
  const detailHref = getDetailHref(item);
  const watchHref = getWatchHref(item);
  const watchTarget = isExternalHref(watchHref) ? ' target="_blank" rel="noopener noreferrer"' : '';
  const genres = (item.genres || []).slice(0,3).map(g => `<span>${escapeHtml(g)}</span>`).join('');
  const synopsis = item.overview || item.description || item.synopsis || '';
  const backdrop = item.backdrop || item.poster || '';
  const poster = item.poster || item.backdrop || '';
  const rating = item._rating ? item._rating.toFixed(1) : (item.rating ? Number(item.rating).toFixed(1) : '');
  card.style.setProperty('--premium-home-backdrop', backdrop ? `url('${backdrop}')` : 'none');
  const sand = Array.from({ length: 26 }, (_, i) => {
    const x = (i * 37) % 100;
    const y = 8 + ((i * 23) % 82);
    const size = 2 + (i % 4);
    const duration = 12 + (i % 7) * 2;
    const delay = -1 * ((i * 1.7) % 14);
    return `<span style="--x:${x}%;--y:${y}%;--size:${size}px;--duration:${duration}s;--delay:${delay}s"></span>`;
  }).join('');
  card.innerHTML = `
    <div class="premium-home-backdrop" aria-hidden="true"></div>
    <div class="premium-home-sand" aria-hidden="true">${sand}</div>
    <a class="premium-home-poster" href="${detailHref}" style="background-image:url('${poster}'), ${posterFallback}" aria-label="Ouvrir la fiche Premium ${escapeHtml(item.title)}"></a>
    <div class="premium-home-copy">
      <p class="premium-home-kicker">⭐ Sélection Premium</p>
      <h3>${escapeHtml(item.title || 'Titre premium')}</h3>
      ${item.tagline ? `<p class="premium-home-tagline">“${escapeHtml(item.tagline)}”</p>` : ''}
      <div class="premium-home-meta">
        ${year ? `<span>${escapeHtml(year)}</span>` : ''}
        <span>${escapeHtml(formatType(item.type || item.mediaType || 'film'))}</span>
        ${item.runtime ? `<span>${escapeHtml(String(item.runtime))} min</span>` : ''}
        ${rating ? `<span>⭐ ${rating}/10</span>` : ''}
      </div>
      <div class="premium-home-genres">${genres}</div>
      ${synopsis ? `<p class="premium-home-synopsis">${escapeHtml(synopsis).slice(0, 300)}${synopsis.length > 300 ? '…' : ''}</p>` : ''}
      <div class="premium-home-actions">
        <a class="primary" href="${watchHref}"${watchTarget}>▶ Lecture</a>
        <a class="secondary" href="${detailHref}">Ouvrir la fiche Premium</a>
      </div>
    </div>`;
  return card;
}

function mountPremium(selector, list){
  const grid = document.querySelector(selector);
  if(!grid) return;
  grid.innerHTML = '';
  list.forEach(item => grid.appendChild(createPremiumCard(item)));
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
  const fallback = state.filter === 'manga' ? state.catalogue.filter(isManga) : state.catalogue.filter(isStandardCatalogueItem);
  const list = pool.length ? pool : fallback;
  if(!list.length) return;
  const item = list[Math.floor(Math.random() * list.length)];
  window.location.href = getDetailHref(item);
}


function getDetailHref(item){
  const page = item?.premium ? 'premium.html' : 'detail.html';
  return `${page}?slug=${encodeURIComponent(item.slug)}`;
}


function getWatchHref(item){
  const firstEpisode = getFirstEpisode(item);
  const base = `watch.html?slug=${encodeURIComponent(item.slug)}&autoplay=1`;
  if(!firstEpisode) return base;
  const seasonNumber = getSeasonNumber(firstEpisode.season);
  const episodeNumber = getEpisodeNumber(firstEpisode.episode);
  return `${base}&season=${encodeURIComponent(seasonNumber)}&episode=${encodeURIComponent(episodeNumber)}`;
}

function getSeasonNumber(season, index=0){
  return Number(season?.seasonNumber || season?.number || season?.season || index + 1) || index + 1;
}

function getEpisodeNumber(episode, index=0){
  return Number(episode?.episodeNumber || episode?.number || episode?.episode || index + 1) || index + 1;
}

function getSeasonsArray(item){
  if(Array.isArray(item?.seasons)) return item.seasons;
  if(Array.isArray(item?.seasonsData)) return item.seasonsData;
  if(Array.isArray(item?.seasonList)) return item.seasonList;
  return [];
}

function getFirstEpisode(item){
  const seasons = getSeasonsArray(item);
  const sortedSeasons = [...seasons].sort((a,b) => getSeasonNumber(a) - getSeasonNumber(b));
  for(const season of sortedSeasons){
    const episodes = Array.isArray(season.episodes) ? [...season.episodes] : [];
    episodes.sort((a,b) => getEpisodeNumber(a) - getEpisodeNumber(b));
    const episode = episodes.find(ep => String(ep.embed || ep.videoEmbed || ep.video_embed || '').trim());
    if(episode) return {season, episode};
  }
  return null;
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
