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

    renderDetail(item, catalogue);
    document.title = `${item.title} | Planète Stream`;

  } catch (err) {
    console.error(err);
    showError('Impossible de charger le catalogue.');
  }
}

function renderDetail(item, catalogue) {
  const poster = item.poster || '';
  const backdrop = item.backdrop || poster || '';
  const genres = item.genres || [];

  const year =
    item.year ||
    (item.releaseDate ? String(item.releaseDate).slice(0, 4) : '') ||
    '';

  const runtime = item.runtime ? `${item.runtime} min` : '';
  const rating = item.rating ? `⭐ ${Number(item.rating).toFixed(1)} / 10` : '';

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
    <section class="detail-hero" style="background-image:url('${backdrop}')">
      <div class="detail-hero-overlay">
        <div class="container detail-hero-content">

          <div class="detail-poster">
            ${poster ? `<img src="${poster}" alt="${escapeHtml(item.title)}">` : ''}
          </div>

          <div class="detail-main">
            <p class="eyebrow">Fiche catalogue</p>
            <h1>${escapeHtml(item.title)}</h1>

            <div class="detail-meta">
              ${year ? `<span>${escapeHtml(year)}</span>` : ''}
              ${item.type ? `<span>${escapeHtml(item.type === 'serie' ? 'Série' : 'Film')}</span>` : ''}
${item.category && item.category.toLowerCase() !== item.type ? `<span>${escapeHtml(item.category)}</span>` : ''}
              ${runtime ? `<span>${runtime}</span>` : ''}
              ${rating ? `<span>${rating}</span>` : ''}
            </div>

            <div class="detail-genres">
              ${genres.map(g => `<span>${escapeHtml(g)}</span>`).join('')}
            </div>

            <p class="detail-overview">
              ${escapeHtml(item.overview || 'Aucun synopsis disponible.')}
            </p>

            <div class="detail-actions">
              <button class="primary">▶ Regarder</button>
              <button class="ghost">+ Ma liste</button>
              <a class="ghost" href="index.html#catalogue">Retour catalogue</a>
            </div>
          </div>

        </div>
      </div>
    </section>

    <section class="container detail-info">
      <div class="detail-block">
        <h2>Synopsis</h2>
        <p>${escapeHtml(item.overview || 'Aucun synopsis disponible.')}</p>
      </div>

      <div class="detail-grid">
        <article>
          <h3>Réalisation / Création</h3>
          <p>${escapeHtml(item.director || 'À compléter')}</p>
        </article>

        <article>
          <h3>Casting</h3>
          <p>${escapeHtml((item.cast || []).join(', ') || 'Non renseigné')}</p>
        </article>

        <article>
          <h3>Classification</h3>
          <p>${escapeHtml(item.category || item.type || 'Non renseignée')}</p>
        </article>

        <article>
          <h3>Popularité TMDb</h3>
          <p>${item.popularity || 'Non renseignée'}</p>
        </article>
      </div>
    </section>

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

function createRelatedCard(item) {
  const poster = item.poster || '';
  return `
    <button class="card" data-related-slug="${escapeHtml(item.slug)}">
      <div class="poster" data-title="${escapeHtml(item.title)}" style="background-image:url('${poster}')"></div>
      <div class="info">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="meta">
          <span>${escapeHtml(item.type || 'film')}</span>
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

initDetail();