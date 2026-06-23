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

  const runtime = item.runtime ? `${item.runtime} min` : '';
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

function hasBetaVideo(item){
  return Boolean(String(item?.videoEmbed || item?.video_embed || '').trim());
}

function renderWatchAction(item, isLogged){
  if(!hasBetaVideo(item)){
    return '<span class="ghost is-disabled" aria-disabled="true">🎬 Vidéo indisponible</span>';
  }
  if(isLogged){
    return `<a class="primary" href="watch.html?slug=${encodeURIComponent(item.slug)}&autoplay=1">▶ Regarder <span class="soft-note">bêta</span></a>`;
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