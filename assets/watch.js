const watchPage = document.querySelector('#watchPage');
const storePrefix = 'planetestream';

async function initWatch(){
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if(!slug){
    showWatchError('Aucun film sélectionné. La salle est belle, mais vide.');
    return;
  }

  try{
    const res = await fetch('data/catalogue.json');
    const catalogue = await res.json();
    const item = catalogue.find(entry => entry.slug === slug);

    if(!item){
      showWatchError('Ce contenu est introuvable dans le catalogue.');
      return;
    }

    renderWatch(item, catalogue);
    bindWatchEvents(item);
    document.title = `${item.title} | Salle de projection`;
  }catch(error){
    console.error(error);
    showWatchError('Impossible de charger le catalogue. Le projectionniste JSON est coincé dans l’ascenseur.');
  }
}

function renderWatch(item, catalogue){
  const year = item.year || (item.releaseDate || '').slice(0,4) || '';
  const genres = (item.genres || []).slice(0,3).join(' • ');
  const tmdbRating = item.rating ? Number(item.rating).toFixed(1) : '-';
  const userRating = getUserRating(item.slug);
  const comments = getComments(item.slug);
  const related = getRelated(item, catalogue);

  watchPage.innerHTML = `
    <section class="watch-hero" style="${item.backdrop ? `background-image:url('${item.backdrop}')` : ''}">
      <div class="watch-veil">
        <div class="container watch-shell">
          <div class="watch-intro">
            <p class="eyebrow">Salle de projection</p>
            <h1>${escapeHtml(item.title)}</h1>
            <p class="watch-meta-line">${[year, formatType(item.type), genres, item.runtime ? item.runtime + ' min' : ''].filter(Boolean).map(escapeHtml).join(' • ')}</p>
          </div>

          <div class="cinema-frame" id="cinemaFrame">
            <div class="studio-bumper" id="studioBumper">
              <div class="bumper-planet">🌍</div>
              <strong>PLANÈTE STREAM</strong>
            </div>
            ${renderVideo(item)}
          </div>

          <div class="watch-controls">
            <button class="primary" id="startCinema">▶ Lancer la projection</button>
            <a class="ghost" href="detail.html?slug=${encodeURIComponent(item.slug)}">Voir la fiche</a>
            <a class="ghost" href="index.html#catalogue">Retour</a>
          </div>
        </div>
      </div>
    </section>

    <section class="container watch-details-grid">
      <article class="watch-panel rating-panel">
        <p class="eyebrow">Notes</p>
        <div class="rating-split">
          <div>
            <span class="rating-label">TMDb</span>
            <strong>${escapeHtml(tmdbRating)}/10</strong>
          </div>
          <div>
            <span class="rating-label">Votre note</span>
            <strong id="userRatingLabel">${userRating ? userRating + '/10' : 'Non noté'}</strong>
          </div>
        </div>
        <div class="star-rating" id="starRating" aria-label="Noter ce film">
          ${Array.from({length:10}, (_,i) => `<button data-rate="${i+1}" class="${userRating >= i+1 ? 'active' : ''}">★</button>`).join('')}
        </div>
        <p class="soft-note">Votre note reste locale pour le moment. Elle sera prête pour les comptes utilisateurs plus tard.</p>
      </article>

      <article class="watch-panel viewer-panel">
        <p class="eyebrow">Ambiance</p>
        <strong>${getViewerCount(item)} spectateurs</strong>
        <p>${getMoodLine(item, comments, userRating)}</p>
      </article>
    </section>

    <section class="container comments-section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Avis des spectateurs</h2>
          <p>Des critiques courtes, propres, sans tunnel de réponses. Le cinéma respire mieux sans mégaphone.</p>
        </div>
      </div>

      <form class="comment-form watch-panel" id="commentForm">
        <div class="form-row">
          <input id="commentName" type="text" placeholder="Votre prénom" maxlength="40" required>
          <select id="commentRating" required>
            <option value="">Note</option>
            ${Array.from({length:10}, (_,i) => `<option value="${i+1}">${i+1}/10</option>`).join('')}
          </select>
        </div>
        <textarea id="commentText" placeholder="Votre avis sur le film..." maxlength="700" required></textarea>
        <button class="primary" type="submit">Publier l’avis</button>
      </form>

      <div class="comments-list" id="commentsList">
        ${renderComments(comments)}
      </div>
    </section>

    ${related.length ? `
      <section class="container detail-related">
        <div class="section-head">
          <h2 class="section-title">Après la séance</h2>
        </div>
        <div class="grid">
          ${related.map(createRelatedCard).join('')}
        </div>
      </section>
    ` : ''}
  `;
}

function renderVideo(item){
  const youtubeId = item.videoYoutube || item.trailer || 'dQw4w9WgXcQ';
  return `
    <iframe
      id="watchPlayer"
      src="https://www.youtube.com/embed/${escapeHtml(youtubeId)}?rel=0&modestbranding=1"
      title="Lecture ${escapeHtml(item.title)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  `;
}

function bindWatchEvents(item){
  document.querySelector('#startCinema')?.addEventListener('click', () => {
    const frame = document.querySelector('#cinemaFrame');
    frame?.classList.add('is-playing');
    setTimeout(() => document.querySelector('#studioBumper')?.classList.add('hidden'), 1150);
    frame?.scrollIntoView({behavior:'smooth', block:'center'});
  });

  document.querySelector('#starRating')?.addEventListener('click', event => {
    const btn = event.target.closest('[data-rate]');
    if(!btn) return;
    const rating = Number(btn.dataset.rate);
    saveUserRating(item.slug, rating);
    document.querySelector('#userRatingLabel').textContent = `${rating}/10`;
    document.querySelectorAll('#starRating button').forEach(star => {
      star.classList.toggle('active', Number(star.dataset.rate) <= rating);
    });
  });

  document.querySelector('#commentForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const name = document.querySelector('#commentName').value.trim();
    const rating = Number(document.querySelector('#commentRating').value);
    const text = document.querySelector('#commentText').value.trim();
    if(!name || !rating || !text) return;
    const comments = getComments(item.slug);
    comments.unshift({name, rating, text, date: new Date().toISOString()});
    saveComments(item.slug, comments);
    document.querySelector('#commentsList').innerHTML = renderComments(comments);
    event.target.reset();
  });
}

function getRelated(item, catalogue){
  const genres = item.genres || [];
  return catalogue.filter(entry => entry.slug !== item.slug && (
    entry.type === item.type || (entry.genres || []).some(g => genres.includes(g))
  )).slice(0,5);
}

function renderComments(comments){
  const list = comments.length ? comments : getDemoComments();
  return list.map(comment => `
    <article class="comment-card">
      <div class="comment-head">
        <strong>${escapeHtml(comment.name)}</strong>
        <span>${'★'.repeat(Number(comment.rating) || 0)}${'☆'.repeat(10 - (Number(comment.rating) || 0))}</span>
      </div>
      <p>${escapeHtml(comment.text)}</p>
      <small>${formatCommentDate(comment.date)}</small>
    </article>
  `).join('');
}

function getDemoComments(){
  return [
    {name:'Planète Stream', rating:8, text:'La zone d’avis est prête. Les vrais commentaires prendront la place de ce message dès qu’un spectateur publiera son avis.', date:new Date().toISOString()}
  ];
}

function createRelatedCard(item){
  return `
    <article class="card">
      <a class="poster poster-link" href="watch.html?slug=${encodeURIComponent(item.slug)}" data-title="${escapeHtml(item.title)}" style="background-image:url('${item.poster || ''}')" aria-label="Lire ${escapeHtml(item.title)}"></a>
      <div class="info">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="meta">
          <span>${escapeHtml(formatType(item.type || 'film'))}</span>
          ${(item.genres || []).slice(0,2).map(g => `<span>${escapeHtml(g)}</span>`).join('')}
        </div>
        <div class="card-actions">
          <a class="card-play" href="watch.html?slug=${encodeURIComponent(item.slug)}">▶ Lecture</a>
          <a class="card-detail" href="detail.html?slug=${encodeURIComponent(item.slug)}">Fiche</a>
        </div>
      </div>
    </article>
  `;
}

function getViewerCount(item){
  const base = String(item.slug || item.title || 'planetestream').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 120 + (base % 850);
}

function getMoodLine(item, comments, userRating){
  if(userRating >= 8) return 'Vous avez visiblement passé une bonne séance. Le pop-corn approuve en silence.';
  if(comments.length) return 'Les spectateurs commencent à laisser leurs traces dans cette salle.';
  if((item.genres || []).some(g => /science|fiction|fantastique/i.test(g))) return 'Très apprécié par les explorateurs de mondes étranges.';
  if(Number(item.rating) >= 7) return 'Un titre solide du catalogue, recommandé par les radars TMDb.';
  return 'Une séance prête à être découverte et jugée par les vrais spectateurs.';
}

function getStorageKey(slug, type){
  return `${storePrefix}:${type}:${slug}`;
}
function getUserRating(slug){
  return Number(localStorage.getItem(getStorageKey(slug, 'rating'))) || 0;
}
function saveUserRating(slug, rating){
  localStorage.setItem(getStorageKey(slug, 'rating'), String(rating));
}
function getComments(slug){
  try{return JSON.parse(localStorage.getItem(getStorageKey(slug, 'comments')) || '[]');}
  catch{return [];}
}
function saveComments(slug, comments){
  localStorage.setItem(getStorageKey(slug, 'comments'), JSON.stringify(comments.slice(0,50)));
}

function showWatchError(message){
  watchPage.innerHTML = `<section class="container detail-error"><h1>Salle indisponible</h1><p>${escapeHtml(message)}</p><a class="primary" href="index.html">Retour accueil</a></section>`;
}
function formatType(type=''){
  const value = String(type).toLowerCase();
  return {movie:'Film', film:'Film', tv:'Série', serie:'Série', series:'Série', manga:'Manga', anime:'Anime'}[value] || type;
}
function formatCommentDate(date){
  if(!date) return 'À l’instant';
  const parsed = new Date(date);
  if(Number.isNaN(parsed.getTime())) return 'À l’instant';
  return parsed.toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'});
}
function escapeHtml(str=''){
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

initWatch();
