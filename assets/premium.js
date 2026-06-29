
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

const premiumPage = document.querySelector('#premiumPage');

async function initPremiumPage(){
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if(!slug){
    showPremiumError('Aucun contenu sélectionné. Même le ver des sables demande une adresse.');
    return;
  }

  try{
    const response = await fetch('data/catalogue.json');
    const catalogue = await response.json();
    const item = catalogue.find(entry => entry.slug === slug);

    if(!item){
      showPremiumError('Contenu introuvable dans le catalogue.');
      return;
    }

    const isLogged = await isMemberLoggedIn();
    renderPremium(item, catalogue, isLogged);
    document.title = `${item.title} | Fiche Premium | Planète Stream`;
  }catch(error){
    console.error(error);
    showPremiumError('Impossible de charger la fiche premium.');
  }
}

function renderPremium(item, catalogue, isLogged=false){
  const year = item.year || (item.releaseDate || '').slice(0, 4);
  const genres = item.genres || [];
  const backdrop = optimizeTmdbImageUrl(item.backdrop || item.poster || '', 'backdrop');
  const poster = optimizeTmdbImageUrl(item.poster || '', 'poster');
  const runtime = getRuntimeLabel(item);
  const rating = item.rating ? Number(item.rating).toFixed(1) : '';
  const cast = normalizeCast(item.cast).slice(0, 10);
  const related = getRelatedPremiumItems(item, catalogue);

  premiumPage.innerHTML = `
    <section class="premium-cinema-hero" style="${backdrop ? `--premium-backdrop:url('${escapeAttr(backdrop)}')` : ''}">
      <div class="premium-grain" aria-hidden="true"></div>
      <div class="premium-aurora" aria-hidden="true"></div>
      <div class="premium-sandstorm" aria-hidden="true">${createPremiumParticles(38)}</div>
      <div class="container premium-hero-grid">
        <aside class="premium-poster-card">
          ${poster ? `<img src="${escapeAttr(poster)}" alt="Affiche ${escapeHtml(item.title)}">` : `<div class="premium-poster-empty">${escapeHtml(item.title)}</div>`}
          <div class="premium-poster-glow" aria-hidden="true"></div>
        </aside>

        <div class="premium-hero-copy">
          <p class="premium-kicker">⭐ Fiche Premium Planète Stream</p>
          <h1>${escapeHtml(item.title)}</h1>
          ${item.tagline ? `<p class="premium-tagline">“${escapeHtml(item.tagline)}”</p>` : ''}

          <div class="premium-meta-row">
            ${year ? `<span>${escapeHtml(year)}</span>` : ''}
            <span>${escapeHtml(formatType(item.type || item.mediaType || 'film'))}</span>
            ${runtime ? `<span>${escapeHtml(runtime)}</span>` : ''}
            ${rating ? `<span>⭐ TMDb ${escapeHtml(rating)}/10</span>` : ''}
          </div>

          <div class="premium-genre-row">
            ${genres.slice(0, 5).map(genre => `<span>${escapeHtml(genre)}</span>`).join('')}
          </div>

          <p class="premium-overview">${escapeHtml(item.overview || 'Aucun synopsis disponible.')}</p>

          <div class="premium-actions">
            ${renderWatchAction(item, isLogged)}
            ${item.trailer ? `<a class="ghost premium-ghost" href="#premiumTrailer">Voir la bande-annonce</a>` : ''}
          </div>
        </div>
      </div>
    </section>


    <section class="container premium-editorial-grid">
      <article class="premium-panel premium-synopsis-panel">
        <p class="premium-panel-label">Synopsis</p>
        <h2>L’histoire</h2>
        <p>${escapeHtml(item.overview || 'Aucun synopsis disponible.')}</p>
      </article>

      <aside class="premium-panel premium-info-panel">
        <p class="premium-panel-label">Carte d’identité</p>
        <h2>Informations</h2>
        <ul>
          <li><span>🎬 Réalisation</span><strong>${escapeHtml(item.director || 'À compléter')}</strong></li>
          <li><span>📅 Sortie</span><strong>${escapeHtml(formatDate(item.releaseDate) || item.year || '-')}</strong></li>
          <li><span>⏱️ Durée</span><strong>${item.runtime ? `${escapeHtml(String(item.runtime))} min` : '-'}</strong></li>
          <li><span>🌍 Pays</span><strong>${escapeHtml(formatCountry(item.country) || '-')}</strong></li>
          <li><span>🗣️ Langue</span><strong>${escapeHtml(formatLanguage(item.language) || '-')}</strong></li>
          ${(item.studios || []).length ? `<li><span>🏛️ Studios</span><strong>${escapeHtml(item.studios.join(' • '))}</strong></li>` : ''}
        </ul>
      </aside>
    </section>

    ${cast.length ? `
      <section class="container premium-cast-section">
        <div class="premium-section-head">
          <p class="premium-panel-label">Distribution</p>
          <h2>Casting principal</h2>
        </div>
        <div class="premium-cast-grid premium-cast-portraits">
          ${cast.map(createCastCard).join('')}
        </div>
      </section>
    ` : ''}

    ${item.trailer ? `
      <section class="container premium-trailer-section" id="premiumTrailer">
        <div class="premium-section-head">
          <p class="premium-panel-label">Bande-annonce</p>
          <h2>La salle s’assombrit</h2>
        </div>
        <div class="premium-trailer-frame">
          <iframe
            src="https://www.youtube.com/embed/${escapeAttr(item.trailer)}"
            title="Bande-annonce ${escapeHtml(item.title)}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>
        </div>
      </section>
    ` : ''}

    ${related.length ? `
      <section class="container premium-related-section">
        <div class="premium-section-head">
          <p class="premium-panel-label">Constellation voisine</p>
          <h2>Vous pourriez aussi aimer</h2>
        </div>
        <div class="grid premium-related-grid">
          ${related.map(createPremiumRelatedCard).join('')}
        </div>
      </section>
    ` : ''}
  `;
}

function createCastCard(actor){
  const photo = actor.profile || buildTmdbProfileUrl(actor.profile_path);
  const searchUrl = `index.html?search=${encodeURIComponent(actor.name)}#catalogue`;
  return `
    <a class="premium-cast-card" href="${searchUrl}" title="Voir les contenus avec ${escapeAttr(actor.name)}">
      <div class="premium-cast-photo">
        ${photo ? `<img src="${escapeAttr(photo)}" alt="${escapeAttr(actor.name)}">` : `<span>${escapeHtml(getInitials(actor.name))}</span>`}
      </div>
      <strong>${escapeHtml(actor.name)}</strong>
      ${actor.character ? `<em>${escapeHtml(actor.character)}</em>` : ''}
    </a>
  `;
}

function normalizeCast(cast = []){
  if(!Array.isArray(cast)) return [];
  return cast
    .map(actor => {
      if(typeof actor === 'string'){
        const name = actor.trim();
        return name ? {name, character:'', profile_path:'', profile:''} : null;
      }
      if(!actor || typeof actor !== 'object') return null;
      const name = String(actor.name || '').trim();
      if(!name) return null;
      return {
        id: actor.id || null,
        name,
        character: String(actor.character || '').trim(),
        profile_path: actor.profile_path || '',
        profile: actor.profile || actor.profileUrl || buildTmdbProfileUrl(actor.profile_path || '')
      };
    })
    .filter(Boolean);
}

function buildTmdbProfileUrl(path){
  if(!path) return '';
  if(/^https?:/i.test(path)) return path;
  return optimizeTmdbImageUrl(path, 'profile');
}

function getInitials(name=''){
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || '🎭';
}

function createPremiumParticles(count=34){
  return Array.from({length: count}, (_, index) => {
    const left = (index * 37) % 100;
    const top = (index * 19) % 100;
    const delay = -((index * 0.47) % 12).toFixed(2);
    const duration = (10 + (index % 7) * 1.8).toFixed(1);
    const size = 2 + (index % 4);
    return `<span style="--x:${left}%;--y:${top}%;--delay:${delay}s;--duration:${duration}s;--size:${size}px"></span>`;
  }).join('');
}

function getRelatedPremiumItems(item, catalogue){
  const genres = item.genres || [];
  return catalogue
    .filter(entry => entry.slug !== item.slug)
    .filter(entry => entry.type === item.type || (entry.genres || []).some(genre => genres.includes(genre)))
    .slice(0, 5);
}

function createPremiumRelatedCard(item){
  const poster = item.poster || '';
  const href = item.premium ? `premium.html?slug=${encodeURIComponent(item.slug)}` : `detail.html?slug=${encodeURIComponent(item.slug)}`;
  return `
    <a class="card premium-related-card" href="${href}">
      <div class="poster" data-title="${escapeHtml(item.title)}" style="background-image:url('${escapeAttr(poster)}')"></div>
      <div class="info">
        <div class="compact-meta">
          <span>${escapeHtml(formatType(item.type || item.mediaType || 'film'))}</span>
          ${item.year ? `<span>${escapeHtml(String(item.year))}</span>` : ''}
          ${item.premium ? '<span>⭐ Premium</span>' : ''}
        </div>
        <div class="compact-genres">
          ${(item.genres || []).slice(0, 2).map(genre => `<span>${escapeHtml(genre)}</span>`).join('')}
        </div>
      </div>
    </a>
  `;
}

function renderWatchAction(item, isLogged){
  if(!hasBetaVideo(item)){
    return '<span class="primary premium-disabled" aria-disabled="true">🎬 Vidéo indisponible</span>';
  }
  if(isLogged){
    return `<a class="primary premium-primary" href="${getWatchUrl(item)}">▶ Entrer dans la salle</a>`;
  }
  return '<a class="primary premium-primary" href="account.html">🔐 Connexion requise pour la  vidéo</a>';
}

function getMediaType(item){
  const value = String(item?.mediaType || item?.media_type || item?.type || '').toLowerCase();
  if(['tv','serie','series','manga','anime'].includes(value)) return 'tv';
  return 'movie';
}

function isSeries(item){
  return getMediaType(item) === 'tv';
}

function getSeasonsArray(item){
  if(Array.isArray(item?.seasons)) return item.seasons;
  if(Array.isArray(item?.seasonsData)) return item.seasonsData;
  if(Array.isArray(item?.seasonList)) return item.seasonList;
  return [];
}

function getSeasonNumber(season, index=0){
  return Number(season?.seasonNumber || season?.number || season?.season || index + 1) || index + 1;
}

function getEpisodeNumber(episode, index=0){
  return Number(episode?.episodeNumber || episode?.number || episode?.episode || index + 1) || index + 1;
}

function getEpisodeEmbed(episode){
  return String(episode?.videoEmbed || episode?.embed || episode?.video_embed || '').trim();
}

function getFirstEpisode(item){
  const seasons = getSeasonsArray(item);
  const sortedSeasons = [...seasons].sort((a,b) => getSeasonNumber(a) - getSeasonNumber(b));
  for(const season of sortedSeasons){
    const episodes = Array.isArray(season.episodes) ? [...season.episodes] : [];
    episodes.sort((a,b) => getEpisodeNumber(a) - getEpisodeNumber(b));
    const episode = episodes.find(ep => getEpisodeEmbed(ep));
    if(episode) return {season, episode};
  }
  return null;
}

function getPrimaryVideoEmbed(item){
  const firstEpisode = getFirstEpisode(item);
  if(firstEpisode) return getEpisodeEmbed(firstEpisode.episode);
  return String(item?.videoEmbed || item?.video_embed || '').trim();
}

function hasBetaVideo(item){
  return Boolean(getPrimaryVideoEmbed(item));
}

function getWatchUrl(item){
  const firstEpisode = getFirstEpisode(item);
  const base = `watch.html?slug=${encodeURIComponent(item.slug)}&autoplay=1`;
  if(!firstEpisode) return base;
  const seasonNumber = getSeasonNumber(firstEpisode.season);
  const episodeNumber = getEpisodeNumber(firstEpisode.episode);
  return `${base}&season=${encodeURIComponent(seasonNumber)}&episode=${encodeURIComponent(episodeNumber)}`;
}

function getRuntimeLabel(item){
  if(isSeries(item)){
    const seasonsCount = Number(item.seasonCount || item.seasonsCount || (Array.isArray(item.seasons) ? item.seasons.length : item.seasons) || 0);
    const episodesCount = Number(item.episodeCount || item.episodesCount || item.episodes || 0);
    return [
      seasonsCount ? `${seasonsCount} saison${seasonsCount > 1 ? 's' : ''}` : '',
      episodesCount ? `${episodesCount} épisode${episodesCount > 1 ? 's' : ''}` : ''
    ].filter(Boolean).join(' • ');
  }
  return item.runtime ? `${item.runtime} min` : '';
}

async function isMemberLoggedIn(){
  try{
    if(window.PS?.ready) await window.PS.ready;
    const state = window.PS?.refreshAuthState
      ? await window.PS.refreshAuthState({force:false})
      : await window.PSAuth?.getAuthState?.();
    return Boolean(state?.isAuthenticated && state?.viewer?.id);
  }catch(error){
    return false;
  }
}

function showPremiumError(message){
  premiumPage.innerHTML = `
    <section class="container detail-error premium-error">
      <h1>Fiche premium indisponible</h1>
      <p>${escapeHtml(message)}</p>
      <a class="primary" href="index.html#catalogue">Retour au catalogue</a>
    </section>
  `;
}

function escapeHtml(str=''){
  return String(str).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[c]));
}

function escapeAttr(str=''){
  return escapeHtml(str).replace(/`/g, '&#096;');
}

function formatDate(dateString){
  if(!dateString) return '';
  const date = new Date(dateString);
  if(Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'});
}

function formatCountry(country=''){
  const countries = {
    'United States of America': '🇺🇸 États-Unis',
    'United Kingdom': '🇬🇧 Royaume-Uni',
    'France': '🇫🇷 France',
    'Canada': '🇨🇦 Canada',
    'Germany': '🇩🇪 Allemagne',
    'Italy': '🇮🇹 Italie',
    'Spain': '🇪🇸 Espagne',
    'Japan': '🇯🇵 Japon',
    'South Korea': '🇰🇷 Corée du Sud',
    'China': '🇨🇳 Chine',
    'Australia': '🇦🇺 Australie'
  };
  return countries[country] || country;
}

function formatType(type=''){
  const value = String(type).toLowerCase();
  return {movie:'Film', film:'Film', tv:'Série', serie:'Série', series:'Série', manga:'Manga', anime:'Anime'}[value] || type;
}

function formatLanguage(language=''){
  const languages = {
    en: '🇬🇧 Anglais',
    fr: '🇫🇷 Français',
    ja: '🇯🇵 Japonais',
    ko: '🇰🇷 Coréen',
    es: '🇪🇸 Espagnol',
    de: '🇩🇪 Allemand',
    it: '🇮🇹 Italien',
    zh: '🇨🇳 Chinois'
  };
  return languages[language] || language;
}

initPremiumPage();
