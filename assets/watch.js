const watchPage = document.querySelector('#watchPage');
const storePrefix = 'planetestream';

const SUPABASE_URL = 'https://bdtktrbtawalniamalcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QLnbv7xRodnpeCXWNZ1q0w_ySaZLElI';
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY);

const dbTables = {
  comments: null,
  movie_stats: null
};

let currentItem = null;
let currentCatalogue = [];

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

    currentItem = item;
    currentCatalogue = catalogue;
    await renderWatch(item, catalogue);
    bindWatchEvents(item);
    await refreshCommunity(item);
    document.title = `${item.title} | Salle de projection`;
  }catch(error){
    console.error('Planete Stream watch init error:', error);
    showWatchError('Impossible de charger le catalogue. Le projectionniste JSON est coincé dans l’ascenseur.');
  }
}

async function renderWatch(item, catalogue){
  const year = item.year || (item.releaseDate || '').slice(0,4) || '';
  const genres = (item.genres || []).slice(0,3).join(' • ');
  const tmdbRating = item.rating ? Number(item.rating).toFixed(1) : '-';
  const localComments = getLocalComments(item.slug);
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
            <span class="rating-label">Planète Stream</span>
            <strong id="communityRatingLabel">Chargement...</strong>
          </div>
        </div>
        <p class="soft-note" id="supabaseStatus">Connexion à Supabase...</p>
      </article>

      <article class="watch-panel viewer-panel">
        <p class="eyebrow">Ambiance</p>
        <strong>${getViewerCount(item)} spectateurs</strong>
        <p id="moodLine">${getMoodLine(item, localComments)}</p>
      </article>
    </section>

    <section class="container comments-section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Critiques des spectateurs</h2>
          <p>Chaque nouvelle critique garde une trace dans le temps. La moyenne utilise seulement la dernière note de chaque spectateur.</p>
        </div>
      </div>

      <form class="comment-form watch-panel" id="commentForm">
        <p class="eyebrow">Écrire une nouvelle critique</p>
        <div class="form-row">
          <input id="commentName" type="text" placeholder="Votre prénom" maxlength="40" required>
          <select id="commentRating" required>
            <option value="">Note</option>
            ${Array.from({length:10}, (_,i) => `<option value="${i+1}">${i+1}/10</option>`).join('')}
          </select>
        </div>
        <textarea id="commentText" placeholder="Votre critique après cette séance..." maxlength="700" required></textarea>
        <p class="soft-note form-help">Aucun ancien avis n’est modifié. Planète Stream garde l’évolution de votre ressenti, comme un petit carnet de cinéma avec moins de café renversé.</p>
        <button class="primary" type="submit">Publier ma critique</button>
      </form>

      <div class="comments-list" id="commentsList">
        ${renderComments(localComments)}
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

  document.querySelector('#commentForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const name = document.querySelector('#commentName').value.trim();
    const rating = Number(document.querySelector('#commentRating').value);
    const text = document.querySelector('#commentText').value.trim();

    if(!name || !rating || !text) return;

    const localComments = getLocalComments(item.slug);
    localComments.unshift({
      name,
      rating,
      text,
      date: new Date().toISOString()
    });
    saveLocalComments(item.slug, localComments);
    document.querySelector('#commentsList').innerHTML = renderComments(localComments);
    setStatus('Publication de la critique...', 'pending');

    const ok = await addReview(item.slug, name, rating, text);

    if(ok){
      event.target.reset();
      setStatus('Critique publiée dans Supabase.', 'ok');
      await refreshCommunity(item);
    }else{
      setStatus('Critique gardée en local. Vérifie la console et les policies Supabase.', 'error');
    }
  });
}

async function refreshCommunity(item){
  const [comments, stats] = await Promise.all([
    fetchComments(item.slug),
    fetchMovieStats(item.slug)
  ]);

  if(comments.online){
    document.querySelector('#commentsList').innerHTML = renderComments(comments.data);
  }

  if(stats.online){
    const stat = stats.data;
    document.querySelector('#communityRatingLabel').textContent =
      stat && stat.average_rating
        ? `${Number(stat.average_rating).toFixed(1)}/10 (${stat.total_votes} vote${Number(stat.total_votes) > 1 ? 's' : ''})`
        : 'Pas encore';
  }else{
    document.querySelector('#communityRatingLabel').textContent = 'Hors ligne';
  }

  const moodComments = comments.online ? comments.data : getLocalComments(item.slug);
  document.querySelector('#moodLine').textContent = getMoodLine(item, moodComments);

  if(comments.online || stats.online){
    setStatus('Connecté à Supabase. Les critiques vivent maintenant dans le cloud.', 'ok');
  }else{
    setStatus('Mode local. Supabase ne répond pas encore.', 'error');
  }
}

async function addReview(slug, name, rating, text){
  const basePayload = {
    movie_id: slug,
    user_id: getAnonymousUserId(),
    display_name: name,
    comment: text,
    rating,
    created_at: new Date().toISOString()
  };

  // Version propre : nécessite la colonne comments.display_name.
  const insertedWithName = await supabaseInsert('comments', basePayload);
  if(insertedWithName) return true;

  // Filet de sécurité pour une base pas encore migrée : on publie quand même,
  // mais le nom affiché sera moins joli. À éviter sur la version finale.
  const fallbackPayload = {...basePayload};
  delete fallbackPayload.display_name;
  fallbackPayload.user_id = name;
  return supabaseInsert('comments', fallbackPayload);
}

async function fetchComments(slug){
  const result = await supabaseSelect('comments', `movie_id=eq.${encodeURIComponent(slug)}&select=*&order=created_at.desc&limit=80`);
  if(!result.ok) return {online:false, data:getLocalComments(slug)};
  return {online:true, data:normalizeComments(result.data)};
}

async function fetchMovieStats(slug){
  const result = await supabaseSelect('movie_stats', `movie_id=eq.${encodeURIComponent(slug)}&select=movie_id,average_rating,total_votes&limit=1`);
  if(!result.ok) return {online:false, data:null};
  const row = Array.isArray(result.data) ? result.data[0] : null;
  return {online:true, data:row || null};
}

async function supabaseSelect(kind, query){
  if(!SUPABASE_ENABLED) return {ok:false, data:null};
  const table = await resolveTable(kind);
  if(!table) return {ok:false, data:null};

  const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?${query}`;
  try{
    const response = await fetch(url, {
      headers: {
        ...supabaseHeaders(),
        'Cache-Control':'no-cache'
      },
      cache:'no-store'
    });
    const data = await response.json().catch(() => null);
    if(!response.ok){
      console.error(`Supabase SELECT ${table} failed`, response.status, data);
      return {ok:false, data:null};
    }
    console.info(`✅ Supabase SELECT ${table}`, data);
    return {ok:true, data};
  }catch(error){
    console.error(`Supabase SELECT ${table} network error`, error);
    return {ok:false, data:null};
  }
}

async function supabaseInsert(kind, payload){
  if(!SUPABASE_ENABLED) return false;
  const table = await resolveTable(kind);
  if(!table) return false;

  const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}`;
  try{
    const response = await fetch(url, {
      method:'POST',
      headers: {
        ...supabaseHeaders(),
        'Content-Type':'application/json',
        Prefer:'return=representation'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if(!response.ok){
      console.error(`Supabase INSERT ${table} failed`, response.status, data, payload);
      return false;
    }
    console.info(`✅ Supabase INSERT ${table}`, data);
    return true;
  }catch(error){
    console.error(`Supabase INSERT ${table} network error`, error);
    return false;
  }
}

async function resolveTable(kind){
  if(dbTables[kind]) return dbTables[kind];

  const candidatesByKind = {
    comments: ['comments'],
    movie_stats: ['movie_stats']
  };

  const candidates = candidatesByKind[kind] || [kind];

  for(const table of candidates){
    try{
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, {
        headers: supabaseHeaders()
      });
      if(response.ok){
        dbTables[kind] = table;
        console.info(`✅ Ressource Supabase détectée: ${table}`);
        return table;
      }
      const data = await response.json().catch(() => null);
      console.warn(`Ressource test ${table}:`, response.status, data);
    }catch(error){
      console.error(`Impossible de tester la ressource ${table}`, error);
    }
  }

  console.error(`Aucune ressource Supabase valide trouvée pour ${kind}.`);
  return null;
}

function supabaseHeaders(){
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  };
}

function normalizeComments(rows){
  return (rows || []).map(row => ({
    name: row.display_name || readableUserName(row.user_id),
    rating: Number(row.rating) || 0,
    text: row.comment || '',
    date: row.created_at
  })).filter(comment => comment.text);
}

function readableUserName(value=''){
  const raw = String(value || '').trim();
  if(!raw) return 'Spectateur';
  if(raw.startsWith('visitor-')) return 'Spectateur';
  return raw;
}

function renderStars(rating=0){
  const value = Math.max(0, Math.min(10, Number(rating) || 0));
  return '★'.repeat(value) + '☆'.repeat(10 - value);
}

function setStatus(message, type=''){
  const status = document.querySelector('#supabaseStatus');
  if(!status) return;
  status.textContent = message;
  status.dataset.status = type;
}

function getAnonymousUserId(){
  const key = `${storePrefix}:anonymous-user`;
  let value = localStorage.getItem(key);
  if(!value){
    value = `visitor-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    localStorage.setItem(key, value);
  }
  return value;
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
        <span>${renderStars(comment.rating)}</span>
      </div>
      <p>${escapeHtml(comment.text)}</p>
      <small>${formatCommentDate(comment.date)}</small>
    </article>
  `).join('');
}

function getDemoComments(){
  return [
    {name:'Planète Stream', rating:8, text:'La zone de critiques est prête. Les vrais avis prendront la place de ce message dès qu’un spectateur publiera sa critique.', date:new Date().toISOString()}
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

function getMoodLine(item, comments){
  if(comments.length > 2) return 'Cette salle commence à avoir une vraie mémoire critique.';
  if(comments.length) return 'Les spectateurs commencent à laisser leurs traces dans cette salle.';
  if((item.genres || []).some(g => /science|fiction|fantastique/i.test(g))) return 'Très apprécié par les explorateurs de mondes étranges.';
  if(Number(item.rating) >= 7) return 'Un titre solide du catalogue, recommandé par les radars TMDb.';
  return 'Une séance prête à être découverte et jugée par les vrais spectateurs.';
}

function getStorageKey(slug, type){
  return `${storePrefix}:${type}:${slug}`;
}

function getLocalComments(slug){
  try{return JSON.parse(localStorage.getItem(getStorageKey(slug, 'comments')) || '[]');}
  catch{return [];}
}

function saveLocalComments(slug, comments){
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
