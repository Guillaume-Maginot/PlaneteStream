const state = {
  catalogue: [],
  filter: 'all',
  search: '',
  heroIndex: 0,
  heroTimer: null,
  heroDirection: 1,
  heroSlideTimeout: null,
  heroPaused: false,
  cataloguePage: 1,
  cataloguePageSize: 'auto',
};

const posterFallback = 'linear-gradient(145deg,#3b1c70,#111), radial-gradient(circle at 60% 35%,rgba(255,255,255,.25),transparent 18%)';

function optimizeTmdbImageUrl(url, kind = 'poster'){
  if(!url) return '';
  const raw = String(url).trim();
  if(!raw) return '';
  const size = chooseTmdbImageSize(kind);
  if(raw.startsWith('/')) return `https://image.tmdb.org/t/p/${size}${raw}`;
  if(!/image\.tmdb\.org\/t\/p\//i.test(raw)) return raw;
  return raw.replace(/\/t\/p\/(?:original|w\d+)\//i, `/t/p/${size}/`);
}
function chooseTmdbImageSize(kind = 'poster'){
  const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
  if(kind === 'backdrop') return isMobile ? 'w780' : 'w1280';
  if(kind === 'profile') return 'w185';
  return isMobile ? 'w342' : 'w500';
}


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
    _addedAt: parseAddedAt(item.addedAt),
    _addedOrder: Number(item.addedOrder) || 0,
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
    state.cataloguePage = 1;
    syncActiveTabs();
    resetGenreFilter();
    render();
  }));

  document.querySelectorAll('[data-nav-filter]').forEach(link => link.addEventListener('click', () => {
    state.filter = link.dataset.navFilter;
    state.cataloguePage = 1;
    setActiveMenuLink(link);
    syncActiveTabs();
    resetGenreFilter();
    render();
  }));

  const search = document.querySelector('#searchInput');
  search?.addEventListener('input', e => {
    state.search = e.target.value.trim().toLowerCase();
    state.cataloguePage = 1;
    render();
  });

  search?.addEventListener('keydown', e => {
    if(e.key !== 'Enter') return;
    e.preventDefault();
    state.search = e.target.value.trim().toLowerCase();
    state.cataloguePage = 1;
    render();
    focusSearchResults();
  });

  document.querySelector('#genreFilter')?.addEventListener('change', e => {
    state.filter = e.target.value || 'all';
    state.cataloguePage = 1;
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    render();
  });

  document.querySelector('#surpriseBtn')?.addEventListener('click', () => openRandomTitle());
  document.querySelector('#heroPrev')?.addEventListener('click', () => moveHero(-1));
  document.querySelector('#heroNext')?.addEventListener('click', () => moveHero(1));

  const hero = document.querySelector('#dynamicHero');
  hero?.addEventListener('mouseenter', pauseHeroRotation);
  hero?.addEventListener('mouseleave', resumeHeroRotation);
  if(!window.matchMedia?.('(hover: none), (pointer: coarse)').matches){
    hero?.addEventListener('mousemove', handleHeroParallax);
  }

  const pageSizeSelect = document.querySelector('#cataloguePageSize');
  if(pageSizeSelect){
    pageSizeSelect.value = state.cataloguePageSize;
    pageSizeSelect.addEventListener('change', e => {
      state.cataloguePageSize = e.target.value || 'auto';
      state.cataloguePage = 1;
      updateCatalogueUrl();
      render();
    });
  }

  document.querySelector('#catalogueGotoForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.querySelector('#catalogueGotoInput');
    const wantedPage = Math.max(1, Number(input?.value || 1));
    state.cataloguePage = wantedPage;
    updateCatalogueUrl();
    render();
    focusSearchResults();
  });

  document.querySelector('[data-pagination]')?.addEventListener('click', e => {
    const button = e.target.closest('button[data-page]');
    if(!button || button.disabled) return;
    state.cataloguePage = Math.max(1, Number(button.dataset.page || 1));
    updateCatalogueUrl();
    render();
    focusSearchResults();
  });

  window.addEventListener('resize', debounce(() => {
    if(state.cataloguePageSize === 'auto') render();
  }, 180));
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

function isCinemaReleaseOnly(item){
  const isCinema = item?.cinemaRelease === true || item?.cinemaRelease === 'true';
  const hasPlayableVideo = Boolean(String(item?.videoEmbed || item?.video_embed || '').trim());
  return isCinema && !hasPlayableVideo;
}

function isStandardCatalogueItem(item){
  return !isManga(item) && !isCinemaReleaseOnly(item);
}

function applySearchFromUrl(){
  const params = new URLSearchParams(window.location.search);
  const filterValue = (params.get('filter') || params.get('type') || '').trim().toLowerCase();
  const searchValue = params.get('search') || params.get('q') || '';
  const pageValue = Math.max(1, Number(params.get('page') || 1));
  const perPageValue = (params.get('perPage') || params.get('parPage') || '').trim();

  if(['auto', '12', '24', '36', '48'].includes(perPageValue)){
    state.cataloguePageSize = perPageValue;
    const select = document.querySelector('#cataloguePageSize');
    if(select) select.value = perPageValue;
  }

  if(pageValue > 1) state.cataloguePage = pageValue;

  if(['all', 'film', 'serie', 'manga'].includes(filterValue)){
    state.filter = filterValue;
    syncActiveTabs();
    const activeLink = document.querySelector(`[data-nav-filter="${filterValue}"]`);
    if(activeLink) setActiveMenuLink(activeLink);
  }

  if(searchValue.trim()){
    state.search = searchValue.trim().toLowerCase();
    const input = document.querySelector('#searchInput');
    if(input) input.value = searchValue.trim();
  }

  if(filterValue || searchValue.trim() || window.location.hash === '#catalogue'){
    window.requestAnimationFrame(focusSearchResults);
  }
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
  const pagination = paginateCatalogue(filtered);
  mount('#catalogueGrid', pagination.items);
  renderCataloguePagination(pagination);

  document.querySelector('#premiumSection').style.display = browsing && premium.length ? 'block' : 'none';
  document.querySelector('#featuredSection').style.display = browsing && featured.length ? 'block' : 'none';
  document.querySelector('#latestSection').style.display = browsing ? 'block' : 'none';
  document.querySelector('#latestMangaSection').style.display = browsing && latestManga.length ? 'block' : 'none';
  document.querySelector('#topRatedSection').style.display = browsing ? 'block' : 'none';
  const sagasSection = document.querySelector('#sagasSection');
  if(sagasSection) sagasSection.style.display = browsing ? 'block' : 'none';

  const catalogueTitle = document.querySelector('#catalogueFullSection .section-title');
  if(catalogueTitle){
    catalogueTitle.textContent = state.filter === 'film'
      ? 'Films'
      : state.filter === 'serie'
        ? 'Séries'
        : state.filter === 'manga'
          ? 'Mangas'
          : 'Catalogue complet';
  }

  const countLabel = document.querySelector('#countLabel');
  if(countLabel){
    if(!filtered.length){
      countLabel.textContent = '0 titre affiché';
    }else{
      countLabel.textContent = `Affichage ${pagination.start + 1}–${pagination.end} sur ${filtered.length} titre${filtered.length > 1 ? 's' : ''}`;
    }
  }
}


function paginateCatalogue(list){
  const total = list.length;
  const perPage = getCataloguePageSize();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  state.cataloguePage = Math.min(Math.max(1, state.cataloguePage), totalPages);

  const start = (state.cataloguePage - 1) * perPage;
  const end = Math.min(total, start + perPage);

  const input = document.querySelector('#catalogueGotoInput');
  if(input){
    input.value = state.cataloguePage;
    input.max = totalPages;
  }

  return {
    total,
    page: state.cataloguePage,
    perPage,
    totalPages,
    start,
    end,
    items: list.slice(start, end)
  };
}

function getCataloguePageSize(){
  if(state.cataloguePageSize !== 'auto'){
    const value = Number(state.cataloguePageSize);
    return Number.isFinite(value) && value > 0 ? value : 24;
  }

  const grid = document.querySelector('#catalogueGrid');
  const containerWidth = grid?.clientWidth || document.querySelector('#catalogueFullSection')?.clientWidth || window.innerWidth;
  const cardMinWidth = window.innerWidth < 620 ? 150 : 220;
  const gap = window.innerWidth < 620 ? 11 : 18;
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));

  // Auto = une vraie page écran, pas un puits sans fond : assez pour respirer, pas assez pour noyer.
  const rows = window.innerWidth >= 1180 ? 4 : window.innerWidth >= 760 ? 3 : 4;
  return Math.max(window.innerWidth < 620 ? 8 : 6, columns * rows);
}

function renderCataloguePagination(pagination){
  const nav = document.querySelector('[data-pagination]');
  const panel = document.querySelector('#catalogueFullSection .catalogue-bottom-panel');
  if(!nav) return;

  const shouldPaginate = pagination.totalPages > 1;
  if(panel) panel.style.display = pagination.total ? 'flex' : 'none';

  nav.innerHTML = '';
  if(!shouldPaginate) return;

  const prev = createPageButton('‹ Précédent', pagination.page - 1, pagination.page <= 1, 'prev');
  const next = createPageButton('Suivant ›', pagination.page + 1, pagination.page >= pagination.totalPages, 'next');
  const numbers = document.createElement('div');
  numbers.className = 'page-numbers';

  getPageWindow(pagination.page, pagination.totalPages).forEach(entry => {
    if(entry === '…'){
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-ellipsis';
      ellipsis.textContent = '…';
      numbers.appendChild(ellipsis);
      return;
    }
    numbers.appendChild(createPageButton(String(entry), entry, false, 'page-number', entry === pagination.page));
  });

  nav.append(prev, numbers, next);
}

function createPageButton(label, page, disabled = false, className = '', active = false){
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.page = page;
  if(className) button.className = className;
  if(active) button.classList.add('active');
  if(disabled) button.disabled = true;
  return button;
}

function getPageWindow(current, total){
  if(total <= 7) return Array.from({length: total}, (_, index) => index + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  if(current <= 3){ pages.add(2); pages.add(3); pages.add(4); }
  if(current >= total - 2){ pages.add(total - 1); pages.add(total - 2); pages.add(total - 3); }

  const sorted = [...pages].filter(page => page >= 1 && page <= total).sort((a,b) => a - b);
  const output = [];
  sorted.forEach((page, index) => {
    if(index && page - sorted[index - 1] > 1) output.push('…');
    output.push(page);
  });
  return output;
}

function updateCatalogueUrl(){
  const params = new URLSearchParams(window.location.search);
  if(state.filter && state.filter !== 'all') params.set('filter', state.filter);
  else params.delete('filter');

  if(state.search) params.set('search', state.search);
  else params.delete('search');

  if(state.cataloguePage > 1) params.set('page', state.cataloguePage);
  else params.delete('page');

  if(state.cataloguePageSize && state.cataloguePageSize !== 'auto') params.set('perPage', state.cataloguePageSize);
  else params.delete('perPage');

  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || '#catalogue'}`;
  window.history.replaceState(null, '', url);
}

function debounce(fn, delay = 180){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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
  const aHasAdditionDate = a._addedAt > 0;
  const bHasAdditionDate = b._addedAt > 0;

  // Les contenus horodatés passent avant l'historique, puis sont classés selon
  // leur véritable ajout au catalogue. L'ordre explicite départage les imports
  // réalisés dans une même seconde.
  if(aHasAdditionDate !== bHasAdditionDate) return bHasAdditionDate - aHasAdditionDate;
  if(aHasAdditionDate && a._addedAt !== b._addedAt) return b._addedAt - a._addedAt;
  if((a._addedOrder || 0) !== (b._addedOrder || 0)) return (b._addedOrder || 0) - (a._addedOrder || 0);

  // Compatibilité avec les anciennes fiches qui ne possèdent pas encore de date.
  return (b._index || 0) - (a._index || 0) || sortByTitle(a,b);
}

function parseAddedAt(value){
  const timestamp = Date.parse(String(value || ''));
  return Number.isNaN(timestamp) ? 0 : timestamp;
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
  const heroShade = window.innerWidth < 620
    ? 'linear-gradient(180deg, rgba(2,3,10,.94) 0%, rgba(2,3,10,.78) 52%, rgba(2,3,10,.94) 100%)'
    : 'linear-gradient(90deg, rgba(2,3,10,.97) 0%, rgba(2,3,10,.78) 35%, rgba(2,3,10,.25) 78%)';
  hero.style.backgroundImage = `${heroShade}, url('${optimizeTmdbImageUrl(item.backdrop || item.poster || '', 'backdrop')}')`;
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


function formatRuntimeLabel(value){
  if(value === null || value === undefined || value === '') return '';
  if(typeof value === 'number' && Number.isFinite(value)){
    const total = Math.max(0, Math.round(value));
    if(!total) return '';
    const h = Math.floor(total / 60);
    const m = total % 60;
    if(h && m) return `${h}h${String(m).padStart(2,'0')}`;
    if(h) return `${h}h`;
    return `${m}min`;
  }
  const text = String(value).trim().toLowerCase();
  if(!text) return '';
  const hMatch = text.match(/(\d+)\s*h(?:\s*(\d+))?/);
  if(hMatch){
    const h = Number(hMatch[1] || 0);
    const m = Number(hMatch[2] || 0);
    return m ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
  }
  const minMatch = text.match(/(\d+)\s*(?:min|mn|minutes?)/);
  if(minMatch) return formatRuntimeLabel(Number(minMatch[1]));
  const numberOnly = text.match(/^\d+$/);
  if(numberOnly) return formatRuntimeLabel(Number(text));
  return String(value);
}

function getCardRuntime(item){
  return formatRuntimeLabel(
    item.runtime ??
    item.duration ??
    item.duree ??
    item.runtimeMinutes ??
    item.runtime_minutes ??
    item.durationMinutes ??
    item.duration_minutes
  );
}

function getCommunityRatingInfo(item){
  const value =
    item.planeteRating ??
    item.planetRating ??
    item.psRating ??
    item.communityRating ??
    item.averageRating ??
    item.userAverageRating ??
    item.user_rating_average;

  const count = Number(
    item.planeteRatingCount ??
    item.planetRatingCount ??
    item.psRatingCount ??
    item.communityRatingCount ??
    item.ratingCount ??
    item.userRatingCount ??
    item.user_rating_count ??
    0
  );

  const rating = Number(value);
  if(Number.isFinite(rating) && rating > 0 && count >= 5){
    return {
      source:'ps',
      icon:'🪐',
      label:`${rating.toFixed(1)}/10`,
      title:`Note Planète Stream${count ? ` · ${count} avis` : ''}`
    };
  }
  return null;
}

function getTmdbRatingInfo(item){
  const value =
    item.tmdbRating ??
    item.voteAverage ??
    item.vote_average ??
    item.rating ??
    item._rating;
  const rating = Number(value);
  if(Number.isFinite(rating) && rating > 0){
    return {
      source:'tmdb',
      icon:'⭐',
      label:`${rating.toFixed(1)}/10`,
      title:'Note TMDb'
    };
  }
  return null;
}

function getDisplayRatingInfo(item){
  return getCommunityRatingInfo(item) || getTmdbRatingInfo(item);
}

function createCard(item){
  const card = document.createElement('article');
  card.className = 'card';
  const year = item.year || (item.releaseDate || '').slice(0,4);
  const runtime = getCardRuntime(item);
  const ratingInfo = getDisplayRatingInfo(item);
  const detailHref = getDetailHref(item);
  const watchHref = getWatchHref(item);
  const watchTarget = isExternalHref(watchHref) ? ' target="_blank" rel="noopener noreferrer"' : '';
  card.innerHTML = `
    <a class="poster poster-link" href="${detailHref}" data-title="${escapeHtml(item.title)}" style="background-image:url('${optimizeTmdbImageUrl(item.poster || '', 'poster')}'), ${posterFallback}" aria-label="Voir la fiche ${escapeHtml(item.title)}"></a>
    <div class="info">
      <h3 class="catalog-card-title">${escapeHtml(item.title)}</h3>
      <div class="compact-meta" aria-label="Informations ${escapeHtml(item.title)}">
        <span>${escapeHtml(formatType(item.type || item.mediaType || 'film'))}</span>
        ${year ? `<span>${escapeHtml(year)}</span>` : ''}
        ${runtime ? `<span>${escapeHtml(runtime)}</span>` : ''}
        ${item.premium ? '<span>⭐ Premium</span>' : ''}
      </div>
      <div class="compact-genres">
        ${(item.genres || []).slice(0,2).map(g => `<span>${escapeHtml(g)}</span>`).join('')}
      </div>
      ${ratingInfo ? `<div class="catalog-card-rating catalog-card-rating-${ratingInfo.source}" title="${escapeHtml(ratingInfo.title)}"><span aria-hidden="true">${ratingInfo.icon}</span><strong>${escapeHtml(ratingInfo.label)}</strong></div>` : '<div class="catalog-card-rating catalog-card-rating-empty" aria-hidden="true"></div>'}
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
  const backdrop = optimizeTmdbImageUrl(item.backdrop || item.poster || '', 'backdrop');
  const poster = optimizeTmdbImageUrl(item.poster || item.backdrop || '', 'poster');
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
