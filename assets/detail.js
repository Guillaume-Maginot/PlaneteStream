const detailPage = document.querySelector('#detailPage');

async function initDetail() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    showError('Aucun contenu sélectionné.');
    return;
  }

  try {
    const res = await fetch('data/catalogue.json');
    const catalogue = await res.json();

    const item = catalogue.find(entry => entry.slug === slug);

    if (!item) {
      showError('Contenu introuvable dans le catalogue.');
      return;
    }

    const isLogged = await isMemberLoggedIn();
    renderDetail(item, catalogue, isLogged);
    document.title = `${item.title} | Planète Stream`;

  } catch (err) {
    console.error(err);
    showError('Impossible de charger le catalogue.');
  }
}

function renderDetail(item, catalogue, isLogged=false) {
  const poster = item.poster || '';
 const backdrop = item.backdrop || '';
  const genres = item.genres || [];

  const year =
    item.year ||
    (item.releaseDate ? String(item.releaseDate).slice(0, 4) : '') ||
    '';

  const runtime = getRuntimeLabel(item);
  const rating = item.rating ? `⭐ ${Number(item.rating).toFixed(1)} / 10` : '';

  const badges = [];

if (year) badges.push(year);

if (item.type) {
  badges.push(formatType(item.type));
}

if (runtime) badges.push(runtime);
if (rating) badges.push(rating);

  const related = catalogue
    .filter(entry =>
      entry.slug !== item.slug &&
      (
        entry.type === item.type ||
        (entry.genres || []).some(g => genres.includes(g))
      )
    )
    .slice(0, 5);

  detailPage.innerHTML = `
    <section class="detail-hero ${backdrop ? '' : 'no-backdrop'}" style="${backdrop ? `background-image:url('${backdrop}')` : ''}">
      <div class="detail-hero-overlay">
        <div class="container detail-hero-content">

          <div class="detail-poster">
            ${poster ? `<img src="${poster}" alt="${escapeHtml(item.title)}">` : ''}
          </div>

          <div class="detail-main">
            <p class="eyebrow">Fiche catalogue</p>
            <h1>${escapeHtml(item.title)}</h1>
            ${item.tagline ? `<p class="detail-tagline">“${escapeHtml(item.tagline)}”</p>` : ''}

            <div class="detail-meta">
  ${badges.map(b => `<span>${escapeHtml(b)}</span>`).join('')}
</div>

            <div class="detail-genres">
              ${genres.map(g => `<span>${escapeHtml(g)}</span>`).join('')}
            </div>

            <p class="detail-overview">
              ${escapeHtml(item.overview || 'Aucun synopsis disponible.')}
            </p>

            <div class="detail-actions">
              ${renderWatchAction(item, isLogged)}
              <a class="ghost" href="index.html#catalogue">Retour catalogue</a>
            </div>
          </div>

        </div>
      </div>
    </section>

   <section class="container detail-layout">

    <div class="detail-left">

        <h2>Synopsis</h2>

        <p class="detail-synopsis">

            ${escapeHtml(item.overview || 'Aucun synopsis disponible.')}

        </p>

        ${isSeries(item) ? renderSeriesEpisodes(item, isLogged) : ''}

        <h2>Casting principal</h2>

        <div class="detail-cast-list">
  ${
    (item.cast || []).length
      ? item.cast.map(actor => `<span>${escapeHtml(actor)}</span>`).join('')
      : '<span>Non renseigné</span>'
  }
</div>

    </div>

    <aside class="detail-right">

        <h2>Informations</h2>

        <ul class="movie-info-list">

            <li>
                <span>🎬 Réalisation</span>
                <strong>${escapeHtml(item.director || 'À compléter')}</strong>
            </li>

            <li>
                <span>📅 Sortie</span>
                <strong>${escapeHtml(formatDate(item.releaseDate) || item.year || '-')}</strong>
            </li>

            <li>
                <span>⏱️ Durée</span>
                <strong>${item.runtime ? item.runtime + ' min' : '-'}</strong>
            </li>

            <li>
                <span>🌍 Pays</span>
                <strong>${escapeHtml(formatCountry(item.country) || '-')}</strong>
            </li>

            <li>
                <span>🗣️ Langue</span>
                <strong>${escapeHtml(formatLanguage(item.language) || '-')}</strong>
            </li>

            <li>
                <span>⭐ TMDb</span>
                <strong>${item.rating ? Number(item.rating).toFixed(1) + '/10' : '-'}</strong>
            </li>

            <li>
                <span>🎭 Genres</span>
                <strong>${escapeHtml((item.genres || []).join(' • '))}</strong>
            </li>

            ${
  (item.studios || []).length
    ? `
      <li>
        <span>🏛️ Studios</span>
        <strong>${escapeHtml(item.studios.join(' • '))}</strong>
      </li>
    `
    : ''
}

        </ul>

    </aside>

</section>

${
  item.trailer
    ? `
      <section class="container detail-trailer" id="trailer">
        <div class="section-head">
          <h2 class="section-title">Bande-annonce</h2>
        </div>

        <div class="trailer-frame">
          <iframe
            src="https://www.youtube.com/embed/${escapeHtml(item.trailer)}"
            title="Bande-annonce ${escapeHtml(item.title)}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen>
          </iframe>
        </div>
      </section>
    `
    : ''
}

    ${
      related.length
        ? `
        <section class="container detail-related">
          <div class="section-head">
            <h2 class="section-title">Vous pourriez aussi aimer</h2>
          </div>
          <div class="grid">
            ${related.map(createRelatedCard).join('')}
          </div>
        </section>
        `
        : ''
    }
  `;

  document.querySelectorAll('[data-related-slug]').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `detail.html?slug=${encodeURIComponent(card.dataset.relatedSlug)}`;
    });
  });
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

function getSeriesEpisodeStats(item){
  const seasons = getSeasonsArray(item);
  const seasonsCount = seasons.length || Number(item.seasonCount || item.seasonsCount || item.seasons || 0) || 0;
  const episodesCount = seasons.length
    ? seasons.reduce((total, season) => total + (Array.isArray(season.episodes) ? season.episodes.length : 0), 0)
    : Number(item.episodeCount || item.episodesCount || item.episodes || 0) || 0;
  const readyCount = seasons.reduce((total, season) => {
    const episodes = Array.isArray(season.episodes) ? season.episodes : [];
    return total + episodes.filter(ep => getEpisodeEmbed(ep)).length;
  }, 0);
  return {seasonsCount, episodesCount, readyCount};
}

function renderSeriesEpisodes(item, isLogged=false){
  const seasons = getSeasonsArray(item)
    .map((season, index) => ({...season, __seasonNumber: getSeasonNumber(season, index)}))
    .sort((a,b) => a.__seasonNumber - b.__seasonNumber);
  const stats = getSeriesEpisodeStats(item);

  if(!seasons.length){
    return `
      <section class="series-detail-panel">
        <div class="series-detail-head">
          <div>
            <p class="eyebrow">Guide des épisodes</p>
            <h2>Saisons & épisodes</h2>
          </div>
          <span class="series-pill">${stats.seasonsCount || '-'} saison${stats.seasonsCount > 1 ? 's' : ''} · ${stats.episodesCount || '-'} épisode${stats.episodesCount > 1 ? 's' : ''}</span>
        </div>
        <p class="series-empty">La fiche connaît le volume de la série, mais les épisodes détaillés ne sont pas encore enregistrés. Dès que l’admin sauvegarde les saisons, ils apparaîtront ici rangés au cordeau.</p>
      </section>
    `;
  }

  return `
    <section class="series-detail-panel" id="episodes">
      <div class="series-detail-head">
        <div>
          <p class="eyebrow">Guide des épisodes</p>
          <h2>Saisons & épisodes</h2>
        </div>
        <span class="series-pill">${stats.seasonsCount} saison${stats.seasonsCount > 1 ? 's' : ''} · ${stats.episodesCount} épisode${stats.episodesCount > 1 ? 's' : ''} · ${stats.readyCount} prêt${stats.readyCount > 1 ? 's' : ''}</span>
      </div>
      <div class="series-season-list">
        ${seasons.map((season, seasonIndex) => {
          const seasonNumber = season.__seasonNumber;
          const episodes = (Array.isArray(season.episodes) ? season.episodes : [])
            .map((episode, episodeIndex) => ({...episode, __episodeNumber: getEpisodeNumber(episode, episodeIndex)}))
            .sort((a,b) => a.__episodeNumber - b.__episodeNumber);
          const ready = episodes.filter(ep => getEpisodeEmbed(ep)).length;
          return `
            <details class="series-season-card" ${seasonIndex === 0 ? 'open' : ''}>
              <summary>
                <span>Saison ${escapeHtml(String(seasonNumber))}</span>
                <small>${episodes.length} épisode${episodes.length > 1 ? 's' : ''} · ${ready} prêt${ready > 1 ? 's' : ''}</small>
              </summary>
              <div class="series-episode-list">
                ${episodes.length ? episodes.map(episode => renderEpisodeRow(item, seasonNumber, episode, isLogged)).join('') : '<p class="series-empty small">Aucun épisode dans cette saison.</p>'}
              </div>
            </details>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderEpisodeRow(item, seasonNumber, episode, isLogged=false){
  const episodeNumber = episode.__episodeNumber || getEpisodeNumber(episode);
  const title = episode.title || `Épisode ${episodeNumber}`;
  const embed = getEpisodeEmbed(episode);
  const watchUrl = `watch.html?slug=${encodeURIComponent(item.slug)}&autoplay=1&season=${encodeURIComponent(seasonNumber)}&episode=${encodeURIComponent(episodeNumber)}`;
  const action = embed
    ? (isLogged ? `<a href="${watchUrl}">▶ Lire</a>` : '<a href="account.html">🔐 Connexion</a>')
    : '<span>Embed manquant</span>';
  return `
    <article class="series-episode-row ${embed ? 'is-ready' : 'is-missing'}">
      <div class="episode-code">S${escapeHtml(String(seasonNumber))}E${escapeHtml(String(episodeNumber)).padStart(2, '0')}</div>
      <div class="episode-copy">
        <strong>${escapeHtml(title)}</strong>
        ${episode.overview ? `<p>${escapeHtml(episode.overview)}</p>` : ''}
      </div>
      <div class="episode-state">${embed ? 'Disponible' : 'À compléter'}</div>
      <div class="episode-action">${action}</div>
    </article>
  `;
}

function getMediaType(item){
  const value = String(item?.mediaType || item?.media_type || item?.type || '').toLowerCase();
  if(['tv','serie','series'].includes(value)) return 'tv';
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

function getFirstEpisode(item){
  const seasons = getSeasonsArray(item);
  const sortedSeasons = [...seasons].sort((a,b) => getSeasonNumber(a) - getSeasonNumber(b));
  for(const season of sortedSeasons){
    const episodes = Array.isArray(season.episodes) ? [...season.episodes] : [];
    episodes.sort((a,b) => getEpisodeNumber(a) - getEpisodeNumber(b));
    const episode = episodes.find(ep => getEpisodeEmbed(ep));
    if(episode){
      return {season, episode};
    }
  }
  return null;
}

function getPrimaryVideoEmbed(item){
  const firstEpisode = getFirstEpisode(item);
  if(firstEpisode){
    return getEpisodeEmbed(firstEpisode.episode);
  }
  return String(item?.videoEmbed || item?.video_embed || '').trim();
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

function hasBetaVideo(item){
  return Boolean(getPrimaryVideoEmbed(item));
}

function renderWatchAction(item, isLogged){
  if(!hasBetaVideo(item)){
    return '<span class="ghost is-disabled" aria-disabled="true">🎬 Vidéo indisponible</span>';
  }
  if(isLogged){
    return `<a class="primary" href="${getWatchUrl(item)}">▶ Regarder <span class="soft-note">bêta</span></a>`;
  }
  return '<a class="primary" href="account.html">🔐 Connexion requise pour la bêta vidéo</a>';
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

function createRelatedCard(item) {
  const poster = item.poster || '';
  return `
    <button class="card" data-related-slug="${escapeHtml(item.slug)}">
      <div class="poster" data-title="${escapeHtml(item.title)}" style="background-image:url('${poster}')"></div>
      <div class="info">
        <div class="compact-meta" aria-label="Informations ${escapeHtml(item.title)}">
          <span>${escapeHtml(item.type || 'film')}</span>
          ${item.year ? `<span>${escapeHtml(String(item.year))}</span>` : ''}
        </div>
        <div class="compact-genres">
          ${(item.genres || []).slice(0, 2).map(g => `<span>${escapeHtml(g)}</span>`).join('')}
        </div>
      </div>
    </button>
  `;
}

function showError(message) {
  detailPage.innerHTML = `
    <section class="container detail-error">
      <h1>Contenu indisponible</h1>
      <p>${escapeHtml(message)}</p>
      <a class="primary" href="index.html">Retour à l’accueil</a>
    </section>
  `;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[c]));
}

function formatDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function formatCountry(country = '') {
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

function formatType(type = '') {
  const value = String(type).toLowerCase();
  return {movie:'Film', film:'Film', tv:'Série', serie:'Série', series:'Série', manga:'Manga', anime:'Anime'}[value] || type;
}

function formatLanguage(language = '') {
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

initDetail();