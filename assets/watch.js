const watchPage = document.querySelector('#watchPage');
const storePrefix = 'planetestream';

const SUPABASE_URL = 'https://bdtktrbtawalniamalcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QLnbv7xRodnpeCXWNZ1q0w_ySaZLElI';
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY);

const dbTables = {
  comments: null,
  movie_stats: null,
  movie_views: null,
  viewers: null,
  comment_likes: null,
  movie_favorites: null,
  viewer_history: null
};

let currentItem = null;
let currentCatalogue = [];
let currentViewer = null;
let currentComments = [];
let likedCommentIds = new Set();

async function initWatch(){
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if(!slug){
    showWatchError('Aucun film sélectionné. La salle est belle, mais vide.');
    return;
  }

  try{
    currentViewer = loadViewer();
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
    renderViewerBox();
    await refreshCommunity(item);
    await saveViewerHistory(item.slug, 0);
    document.title = `${item.title} | Salle de projection`;
  }catch(error){
    console.error('Planete Stream watch init error:', error);
    showWatchError('Impossible d’ouvrir la salle pour le moment. Réessaie dans quelques instants.');
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
            <button class="ghost" id="favoriteBtn" type="button">♡ Ajouter à ma liste</button>
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
        <p class="soft-note" id="supabaseStatus">Connexion aux avis des spectateurs...</p>
      </article>

      <article class="watch-panel viewer-panel" id="viewerBox">
        <p class="eyebrow">Spectateur</p>
        <strong>Chargement...</strong>
      </article>
    </section>

    <section class="container comments-section">
      <div class="section-head comments-title-row">
        <div>
          <h2 class="section-title">Critiques des spectateurs</h2>
          <p>Chaque spectateur dispose maintenant d’une petite identité Planète Stream. Les avis peuvent recevoir des likes et des réponses.</p>
        </div>
      </div>

      <form class="comment-form watch-panel" id="commentForm">
        <p class="eyebrow">Écrire une nouvelle critique</p>
        <div class="viewer-mini" id="formViewerLabel">Publier en tant que spectateur</div>
        <div class="form-row one-col">
          <select id="commentRating" required>
            <option value="">Note</option>
            ${Array.from({length:10}, (_,i) => `<option value="${i+1}">${i+1}/10</option>`).join('')}
          </select>
        </div>
        <textarea id="commentText" placeholder="Votre critique après cette séance..." maxlength="700" required></textarea>
        <p class="soft-note form-help" id="viewerHelpText">Les likes restent silencieux. Le pseudo sert uniquement à signer une critique ou une réponse.</p>
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
    saveViewerHistory(item.slug, 10);
  });

  document.querySelector('#commentForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const rating = Number(document.querySelector('#commentRating').value);
    const text = document.querySelector('#commentText').value.trim();

    if(!rating || !text) return;

    const viewer = await ensureViewerForComment();
    if(!viewer) return;

    setStatus('Publication de la critique...', 'pending');
    const ok = await addReview(item.slug, viewer, rating, text, null);

    if(ok){
      event.target.reset();
      setStatus('Critique publiée. Merci pour la trace laissée en orbite.', 'ok');
      await refreshCommunity(item);
    }else{
      const localComments = getLocalComments(item.slug);
      localComments.unshift({
        id: `local-${Date.now()}`,
        name: viewer.pseudo,
        avatar: viewer.avatar,
        rating,
        text,
        date: new Date().toISOString(),
        likes_count: 0
      });
      saveLocalComments(item.slug, localComments);
      document.querySelector('#commentsList').innerHTML = renderComments(localComments);
      setStatus('La critique est gardée sur cet appareil. La publication en ligne n’a pas répondu.', 'error');
    }
  });

  document.querySelector('#commentsList')?.addEventListener('click', async event => {
    const likeBtn = event.target.closest('[data-like-comment]');
    if(likeBtn){
      const commentId = likeBtn.dataset.likeComment;
      await toggleCommentLike(commentId);
      return;
    }

    const replyBtn = event.target.closest('[data-reply-comment]');
    if(replyBtn){
      const commentId = replyBtn.dataset.replyComment;
      await openReplyBox(commentId);
      return;
    }

    const cancelBtn = event.target.closest('[data-cancel-reply]');
    if(cancelBtn){
      cancelBtn.closest('.reply-form')?.remove();
    }
  });

  document.querySelector('#commentsList')?.addEventListener('submit', async event => {
    const form = event.target.closest('.reply-form');
    if(!form) return;
    event.preventDefault();

    const viewer = await ensureViewerForComment();
    if(!viewer) return;

    const text = form.querySelector('textarea')?.value.trim();
    const parentId = form.dataset.parentId;
    if(!text || !parentId) return;

    setStatus('Publication de la réponse...', 'pending');
    const ok = await addReview(currentItem.slug, viewer, null, text, parentId);
    if(ok){
      setStatus('Réponse publiée. La conversation prend forme.', 'ok');
      await refreshCommunity(currentItem);
    }else{
      setStatus('Impossible de publier cette réponse pour le moment.', 'error');
    }
  });

  document.querySelector('#favoriteBtn')?.addEventListener('click', async () => {
    await toggleFavorite(item.slug);
  });
}

async function refreshCommunity(item){
  const [comments, stats, views] = await Promise.all([
    fetchComments(item.slug),
    fetchMovieStats(item.slug),
    recordAndFetchMovieViews(item.slug)
  ]);

  currentComments = comments.online ? comments.data : getLocalComments(item.slug);

  if(comments.online && currentViewer?.id){
    likedCommentIds = await fetchLikedCommentIds(currentViewer.id, currentComments.map(comment => comment.id).filter(Boolean));
  }else{
    likedCommentIds = new Set();
  }

  document.querySelector('#commentsList').innerHTML = renderComments(currentComments);

  if(stats.online){
    const stat = stats.data;
    document.querySelector('#communityRatingLabel').textContent =
      stat && stat.average_rating
        ? `${Number(stat.average_rating).toFixed(1)}/10 (${stat.total_votes} vote${Number(stat.total_votes) > 1 ? 's' : ''})`
        : 'Pas encore';
  }else{
    document.querySelector('#communityRatingLabel').textContent = 'Hors ligne';
  }

  if(views.online && views.total_views){
    const viewLabel = document.querySelector('#viewCountLabel');
    if(viewLabel) viewLabel.textContent = `${formatNumber(views.total_views)} vue${Number(views.total_views) > 1 ? 's' : ''} totale${Number(views.total_views) > 1 ? 's' : ''}`;
  }

  const moodComments = comments.online ? comments.data : getLocalComments(item.slug);
  document.querySelector('#moodLine').textContent = getMoodLine(item, moodComments);

  if(comments.online || stats.online){
    setStatus('Avis synchronisés. Les critiques vivent maintenant en ligne.', 'ok');
  }else{
    setStatus('Mode local. Les avis en ligne ne répondent pas encore.', 'error');
  }

  await refreshFavoriteButton(item.slug);
  renderViewerBox();
}

async function addReview(slug, viewer, rating, text, parentId=null){
  const basePayload = {
    movie_id: slug,
    user_id: viewer.id || viewer.pseudo,
    viewer_uuid: viewer.id || null,
    display_name: viewer.pseudo,
    comment: text,
    rating,
    parent_id: parentId,
    likes_count: 0,
    created_at: new Date().toISOString()
  };

  const inserted = await supabaseInsert('comments', basePayload);
  if(inserted) return true;

  // Compatibilité si viewer_uuid ou parent_id n’existe pas sur une ancienne base.
  const fallbackPayload = {...basePayload};
  delete fallbackPayload.viewer_uuid;
  delete fallbackPayload.parent_id;
  delete fallbackPayload.likes_count;
  fallbackPayload.user_id = viewer.pseudo;
  return supabaseInsert('comments', fallbackPayload);
}

async function fetchComments(slug){
  const result = await supabaseSelect('comments', `movie_id=eq.${encodeURIComponent(slug)}&select=*&order=created_at.desc&limit=120`);
  if(!result.ok) return {online:false, data:getLocalComments(slug)};

  const rows = result.data || [];
  const viewerIds = [...new Set(rows.map(row => row.viewer_uuid).filter(Boolean))];
  const viewerMap = await fetchViewersMap(viewerIds);
  const likeCounts = await fetchCommentLikeCounts(rows.map(row => row.id).filter(Boolean));

  return {online:true, data:normalizeComments(rows, viewerMap, likeCounts)};
}

async function fetchViewersMap(ids){
  if(!ids.length) return new Map();
  const cleanIds = ids.filter(id => /^[0-9a-f-]{36}$/i.test(String(id)));
  if(!cleanIds.length) return new Map();

  const result = await supabaseSelect('viewers', `id=in.(${cleanIds.join(',')})&select=id,pseudo,avatar`);
  if(!result.ok) return new Map();

  return new Map((result.data || []).map(viewer => [viewer.id, viewer]));
}

async function fetchMovieStats(slug){
  const result = await supabaseSelect('movie_stats', `movie_id=eq.${encodeURIComponent(slug)}&select=movie_id,average_rating,total_votes&limit=1`);
  if(!result.ok) return {online:false, data:null};
  const row = Array.isArray(result.data) ? result.data[0] : null;
  return {online:true, data:row || null};
}

async function recordAndFetchMovieViews(slug){
  if(!SUPABASE_ENABLED) return {online:false, total_views:null};

  const table = await resolveTable('movie_views');
  if(!table) return {online:false, total_views:null};

  const viewKey = `${storePrefix}:viewed:${slug}:${new Date().toISOString().slice(0,10)}`;
  const alreadyCountedToday = localStorage.getItem(viewKey) === '1';

  const current = await supabaseSelect('movie_views', `movie_id=eq.${encodeURIComponent(slug)}&select=movie_id,total_views&limit=1`);
  if(!current.ok) return {online:false, total_views:null};

  const row = Array.isArray(current.data) ? current.data[0] : null;
  let total = Number(row?.total_views) || 0;

  if(!alreadyCountedToday){
    const nextTotal = total + 1;
    const saved = row
      ? await supabaseUpdate('movie_views', `movie_id=eq.${encodeURIComponent(slug)}`, {total_views: nextTotal, updated_at: new Date().toISOString()})
      : await supabaseInsert('movie_views', {movie_id: slug, total_views: nextTotal, updated_at: new Date().toISOString()});

    if(saved){
      total = nextTotal;
      localStorage.setItem(viewKey, '1');
    }
  }

  return {online:true, total_views:total};
}

async function ensureViewer({silent=false}={}){
  if(currentViewer?.id) return currentViewer;

  const stored = loadViewer();
  if(stored?.id){
    currentViewer = stored;
    renderViewerBox();
    return stored;
  }

  const viewer = silent ? await createAutoViewer() : await askViewerPseudo(false);
  if(viewer){
    currentViewer = viewer;
    saveViewer(viewer);
    renderViewerBox();
  }
  return viewer;
}

async function ensureViewerForComment(){
  const viewer = await ensureViewer({silent:false});
  if(!viewer) return null;

  if(isAutoViewer(viewer)){
    const personalized = await askViewerPseudo(true);
    if(personalized){
      currentViewer = personalized;
      saveViewer(personalized);
      renderViewerBox();
      return personalized;
    }
  }

  return currentViewer || viewer;
}

async function createAutoViewer(){
  let lastPseudo = '';
  let lastAvatar = '🪐';

  for(let attempt = 0; attempt < 5; attempt += 1){
    const token = Math.floor(1000 + Math.random() * 9000);
    const pseudo = `Spectateur ${token}`;
    const avatar = pickAvatar(pseudo);
    const id = makeUuid();
    lastPseudo = pseudo;
    lastAvatar = avatar;

    const created = await supabaseInsert('viewers', {
      id,
      pseudo,
      avatar,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    });

    if(created) return normalizeViewer({id, pseudo, avatar, auto:true});
  }

  return {
    id: `local-${makeUuid()}`,
    pseudo: lastPseudo || `Spectateur ${Date.now().toString().slice(-4)}`,
    avatar: lastAvatar,
    auto: true
  };
}

function isAutoViewer(viewer){
  return /^Spectateur \d{4}$/.test(String(viewer?.pseudo || '')) || Boolean(viewer?.auto);
}

async function askViewerPseudo(force=false){
  const existing = force ? currentViewer?.pseudo || '' : '';
  const pseudo = window.prompt('Choisis ton pseudo Planète Stream :', existing)?.trim();
  if(!pseudo) return null;

  if(pseudo.length < 2){
    alert('Le pseudo doit contenir au moins 2 caractères. Même les astéroïdes ont un nom plus long.');
    return null;
  }

  const cleanedPseudo = pseudo.slice(0, 32);
  const avatar = currentViewer?.avatar || pickAvatar(cleanedPseudo);
  const existingViewer = await findViewerByPseudo(cleanedPseudo);

  if(existingViewer){
    const viewer = normalizeViewer(existingViewer);
    await supabaseUpdate('viewers', `id=eq.${encodeURIComponent(viewer.id)}`, {last_seen: new Date().toISOString()});
    return viewer;
  }

  const id = makeUuid();
  const created = await supabaseInsert('viewers', {
    id,
    pseudo: cleanedPseudo,
    avatar,
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString()
  });

  if(created){
    return normalizeViewer({id, pseudo: cleanedPseudo, avatar});
  }

  // Mode secours : utile en local si Supabase est indisponible.
  return {
    id: `local-${makeUuid()}`,
    pseudo: cleanedPseudo,
    avatar
  };
}

async function findViewerByPseudo(pseudo){
  const result = await supabaseSelect('viewers', `pseudo=eq.${encodeURIComponent(pseudo)}&select=id,pseudo,avatar,created_at,last_seen&limit=1`);
  if(!result.ok) return null;
  return Array.isArray(result.data) ? result.data[0] : null;
}

function normalizeViewer(row){
  const pseudo = row.pseudo || 'Spectateur';
  return {
    id: row.id,
    pseudo,
    avatar: row.avatar || pickAvatar(pseudo),
    created_at: row.created_at || null,
    auto: /^Spectateur \d{4}$/.test(String(pseudo))
  };
}

function pickAvatar(seed=''){
  const avatars = ['🪐','🚀','👾','🤖','🦊','🐼','🐙','🦉','🎬','🍿','🌙','⚡'];
  const score = String(seed).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return avatars[score % avatars.length];
}

function loadViewer(){
  try{
    return JSON.parse(localStorage.getItem(`${storePrefix}:viewer`) || 'null');
  }catch{
    return null;
  }
}

function saveViewer(viewer){
  localStorage.setItem(`${storePrefix}:viewer`, JSON.stringify(viewer));
}

function renderViewerBox(){
  const box = document.querySelector('#viewerBox');
  const label = document.querySelector('#formViewerLabel');
  const helpText = document.querySelector('#viewerHelpText');
  const viewer = currentViewer || loadViewer();

  if(box){
    if(viewer?.pseudo){
      box.innerHTML = `
        <p class="eyebrow">Spectateur</p>
        <div class="viewer-card-mini">
          <span class="viewer-avatar">${escapeHtml(viewer.avatar || '🪐')}</span>
          <div>
            <strong>${escapeHtml(viewer.pseudo)}</strong>
            <small id="viewCountLabel">Audience connectée</small>
            <p id="moodLine">${getMoodLine(currentItem || {}, currentComments)}</p>
          </div>
        </div>
      `;
    }else{
      box.innerHTML = `
        <p class="eyebrow">Spectateur</p>
        <strong id="viewCountLabel">Invité</strong>
        <p id="moodLine">Tu peux liker sans interruption. Le pseudo n’est demandé que si tu publies une critique.</p>
      `;
    }
  }

  if(label){
    label.innerHTML = viewer?.pseudo
      ? `<span class="viewer-avatar small">${escapeHtml(viewer.avatar || '🪐')}</span> Publication en tant que <strong>${escapeHtml(viewer.pseudo)}</strong>`
      : 'Pseudo demandé uniquement au moment de publier.';
  }

  if(helpText){
    helpText.textContent = viewer?.pseudo
      ? isAutoViewer(viewer)
        ? 'Tu peux liker en silence. Si tu publies une critique, tu pourras choisir un vrai pseudo.'
        : `Tu es connecté en tant que ${viewer.pseudo}.`
      : 'Les likes sont silencieux. Le pseudo sera demandé uniquement si tu publies une critique ou une réponse.';
  }

}

async function toggleCommentLike(commentId){
  const viewer = await ensureViewer({silent:true});
  if(!viewer || !commentId || String(commentId).startsWith('local-')) return;

  const wasLiked = likedCommentIds.has(commentId);
  const comment = currentComments.find(item => item.id === commentId);
  const currentCount = Number(comment?.likes_count) || 0;
  const optimisticCount = Math.max(0, currentCount + (wasLiked ? -1 : 1));

  setCommentLikeState(commentId, !wasLiked, optimisticCount);
  setStatus(wasLiked ? 'Retrait du like...' : 'Like envoyé...', 'pending');

  let ok = false;
  if(wasLiked){
    ok = await supabaseDelete('comment_likes', `viewer_id=eq.${encodeURIComponent(viewer.id)}&comment_id=eq.${encodeURIComponent(commentId)}`);
  }else{
    ok = await supabaseInsert('comment_likes', {viewer_id: viewer.id, comment_id: commentId, created_at: new Date().toISOString()}, {acceptDuplicate:true});
  }

  if(!ok){
    setCommentLikeState(commentId, wasLiked, currentCount);
    setStatus('Impossible de mettre à jour ce like pour le moment. Vérifie les policies Supabase de comment_likes.', 'error');
    return;
  }

  const exactCount = await fetchSingleCommentLikeCount(commentId);
  const finalCount = exactCount === null ? optimisticCount : exactCount;
  setCommentLikeState(commentId, !wasLiked, finalCount);

  // Cache de compatibilité : si la policy UPDATE de comments refuse, ce n'est pas bloquant.
  await supabaseUpdate('comments', `id=eq.${encodeURIComponent(commentId)}`, {likes_count: finalCount});

  setStatus(wasLiked ? 'Like retiré.' : 'Like ajouté. Petite étincelle sociale validée.', 'ok');
}

function setCommentLikeState(commentId, liked, count){
  const safeCount = Math.max(0, Number(count) || 0);
  if(liked) likedCommentIds.add(commentId);
  else likedCommentIds.delete(commentId);

  const comment = currentComments.find(item => item.id === commentId);
  if(comment) comment.likes_count = safeCount;

  const button = document.querySelector(`[data-like-comment="${cssEscape(commentId)}"]`);
  if(button){
    button.classList.toggle('is-active', liked);
    button.innerHTML = `${liked ? '♥' : '♡'} ${safeCount}`;
  }
}

async function fetchLikedCommentIds(viewerId, commentIds){
  if(!viewerId || !commentIds.length || String(viewerId).startsWith('local-')) return new Set();
  const cleanIds = commentIds.filter(id => /^[0-9a-f-]{36}$/i.test(String(id)));
  if(!cleanIds.length) return new Set();

  const result = await supabaseSelect('comment_likes', `viewer_id=eq.${encodeURIComponent(viewerId)}&comment_id=in.(${cleanIds.join(',')})&select=comment_id`);
  if(!result.ok) return new Set();
  return new Set((result.data || []).map(row => row.comment_id));
}

async function fetchCommentLikeCounts(commentIds){
  const counts = new Map();
  const cleanIds = [...new Set((commentIds || []).filter(id => /^[0-9a-f-]{36}$/i.test(String(id))))];
  if(!cleanIds.length) return counts;

  const result = await supabaseSelect('comment_likes', `comment_id=in.(${cleanIds.join(',')})&select=comment_id`);
  if(!result.ok) return counts;

  (result.data || []).forEach(row => {
    counts.set(row.comment_id, (counts.get(row.comment_id) || 0) + 1);
  });

  return counts;
}

async function fetchSingleCommentLikeCount(commentId){
  if(!commentId || !/^[0-9a-f-]{36}$/i.test(String(commentId))) return null;
  const result = await supabaseSelect('comment_likes', `comment_id=eq.${encodeURIComponent(commentId)}&select=comment_id`);
  if(!result.ok) return null;
  return Array.isArray(result.data) ? result.data.length : null;
}

async function openReplyBox(commentId){
  const card = document.querySelector(`[data-comment-id="${cssEscape(commentId)}"]`);
  if(!card) return;

  const existing = card.querySelector('.reply-form');
  if(existing){
    existing.querySelector('textarea')?.focus();
    return;
  }


  const form = document.createElement('form');
  form.className = 'reply-form';
  form.dataset.parentId = commentId;
  form.innerHTML = `
    <textarea maxlength="500" required placeholder="Répondre à cet avis..."></textarea>
    <div class="reply-actions">
      <button class="primary" type="submit">Publier la réponse</button>
      <button class="ghost" type="button" data-cancel-reply>Annuler</button>
    </div>
  `;
  card.appendChild(form);
  form.querySelector('textarea')?.focus();
}

async function toggleFavorite(slug){
  const viewer = await ensureViewer({silent:true});
  if(!viewer || String(viewer.id).startsWith('local-')) return;

  const isFav = await isFavorite(viewer.id, slug);
  const ok = isFav
    ? await supabaseDelete('movie_favorites', `viewer_id=eq.${encodeURIComponent(viewer.id)}&movie_id=eq.${encodeURIComponent(slug)}`)
    : await supabaseInsert('movie_favorites', {viewer_id: viewer.id, movie_id: slug, created_at: new Date().toISOString()});

  if(ok){
    setStatus(isFav ? 'Retiré de ta liste.' : 'Ajouté à ta liste.', 'ok');
    await refreshFavoriteButton(slug);
  }
}

async function isFavorite(viewerId, slug){
  if(!viewerId || String(viewerId).startsWith('local-')) return false;
  const result = await supabaseSelect('movie_favorites', `viewer_id=eq.${encodeURIComponent(viewerId)}&movie_id=eq.${encodeURIComponent(slug)}&select=viewer_id&limit=1`);
  return result.ok && Array.isArray(result.data) && result.data.length > 0;
}

async function refreshFavoriteButton(slug){
  const btn = document.querySelector('#favoriteBtn');
  if(!btn) return;
  const viewer = currentViewer || loadViewer();
  if(!viewer?.id || String(viewer.id).startsWith('local-')){
    btn.textContent = '♡ Ajouter à ma liste';
    btn.classList.remove('is-active');
    return;
  }
  const fav = await isFavorite(viewer.id, slug);
  btn.textContent = fav ? '♥ Dans ma liste' : '♡ Ajouter à ma liste';
  btn.classList.toggle('is-active', fav);
}

async function saveViewerHistory(slug, progress=0){
  const viewer = currentViewer || loadViewer();
  if(!viewer?.id || String(viewer.id).startsWith('local-')) return false;

  const payload = {viewer_id: viewer.id, movie_id: slug, progress, updated_at: new Date().toISOString()};
  const updated = await supabaseUpdate('viewer_history', `viewer_id=eq.${encodeURIComponent(viewer.id)}&movie_id=eq.${encodeURIComponent(slug)}`, payload);
  if(updated) return true;
  return supabaseInsert('viewer_history', payload);
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
    return {ok:true, data};
  }catch(error){
    console.error(`Supabase SELECT ${table} network error`, error);
    return {ok:false, data:null};
  }
}

async function supabaseInsert(kind, payload, options={}){
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
        Prefer:'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if(response.ok) return true;

    const data = await response.json().catch(() => null);
    const duplicate = response.status === 409 || String(data?.code || '').includes('23505');
    if(options.acceptDuplicate && duplicate) return true;

    console.error(`Supabase INSERT ${table} failed`, response.status, data, payload);
    return false;
  }catch(error){
    console.error(`Supabase INSERT ${table} network error`, error);
    return false;
  }
}

async function supabaseInsertReturning(kind, payload){
  if(!SUPABASE_ENABLED) return null;
  const table = await resolveTable(kind);
  if(!table) return null;

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
      return null;
    }
    return Array.isArray(data) ? data[0] : data;
  }catch(error){
    console.error(`Supabase INSERT ${table} network error`, error);
    return null;
  }
}

async function supabaseUpdate(kind, filter, payload){
  if(!SUPABASE_ENABLED) return false;
  const table = await resolveTable(kind);
  if(!table) return false;

  const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?${filter}`;
  try{
    const response = await fetch(url, {
      method:'PATCH',
      headers: {
        ...supabaseHeaders(),
        'Content-Type':'application/json',
        Prefer:'return=representation'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if(!response.ok){
      console.error(`Supabase UPDATE ${table} failed`, response.status, data, payload);
      return false;
    }
    return true;
  }catch(error){
    console.error(`Supabase UPDATE ${table} network error`, error);
    return false;
  }
}

async function supabaseDelete(kind, filter){
  if(!SUPABASE_ENABLED) return false;
  const table = await resolveTable(kind);
  if(!table) return false;

  const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?${filter}`;
  try{
    const response = await fetch(url, {
      method:'DELETE',
      headers: {
        ...supabaseHeaders(),
        Prefer:'return=representation'
      }
    });
    const data = await response.json().catch(() => null);
    if(!response.ok){
      console.error(`Supabase DELETE ${table} failed`, response.status, data);
      return false;
    }
    return true;
  }catch(error){
    console.error(`Supabase DELETE ${table} network error`, error);
    return false;
  }
}

async function resolveTable(kind){
  if(dbTables[kind]) return dbTables[kind];

  const candidatesByKind = {
    comments: ['comments'],
    movie_stats: ['movie_stats'],
    movie_views: ['movie_views'],
    viewers: ['viewers'],
    comment_likes: ['comment_likes'],
    movie_favorites: ['movie_favorites'],
    viewer_history: ['viewer_history']
  };

  const candidates = candidatesByKind[kind] || [kind];

  for(const table of candidates){
    try{
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, {
        headers: supabaseHeaders()
      });
      if(response.ok){
        dbTables[kind] = table;
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

function normalizeComments(rows, viewerMap=new Map(), likeCounts=new Map()){
  return (rows || []).map(row => {
    const viewer = viewerMap.get(row.viewer_uuid);
    const computedLikes = likeCounts.has(row.id) ? likeCounts.get(row.id) : Number(row.likes_count) || 0;
    return {
      id: row.id,
      parent_id: row.parent_id || null,
      viewer_uuid: row.viewer_uuid || null,
      name: viewer?.pseudo || row.display_name || readableUserName(row.user_id),
      avatar: viewer?.avatar || pickAvatar(row.display_name || row.user_id || 'Spectateur'),
      rating: row.rating === null || row.rating === undefined ? null : Number(row.rating) || 0,
      text: row.comment || '',
      date: row.created_at,
      likes_count: computedLikes
    };
  }).filter(comment => comment.text);
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

function getRelated(item, catalogue){
  const genres = item.genres || [];
  return catalogue.filter(entry => entry.slug !== item.slug && (
    entry.type === item.type || (entry.genres || []).some(g => genres.includes(g))
  )).slice(0,5);
}

function renderComments(comments){
  const list = comments.length ? comments : getDemoComments();
  const topLevel = list.filter(comment => !comment.parent_id);
  const repliesByParent = list.reduce((map, comment) => {
    if(comment.parent_id){
      if(!map.has(comment.parent_id)) map.set(comment.parent_id, []);
      map.get(comment.parent_id).push(comment);
    }
    return map;
  }, new Map());

  return topLevel.map(comment => renderCommentCard(comment, repliesByParent.get(comment.id) || [])).join('');
}

function renderCommentCard(comment, replies=[]){
  const liked = likedCommentIds.has(comment.id);
  const isReply = Boolean(comment.parent_id);
  return `
    <article class="comment-card ${isReply ? 'is-reply' : ''}" data-comment-id="${escapeHtml(comment.id || '')}">
      <div class="comment-head community-head">
        <div class="comment-author">
          <span class="viewer-avatar">${escapeHtml(comment.avatar || '🪐')}</span>
          <div>
            <strong>${escapeHtml(comment.name)}</strong>
            <small>${formatCommentDate(comment.date)}</small>
          </div>
        </div>
        ${comment.rating ? `<span class="comment-stars">${renderStars(comment.rating)}</span>` : '<span class="comment-reply-pill">Réponse</span>'}
      </div>
      <p>${escapeHtml(comment.text)}</p>
      <div class="comment-actions">
        <button class="comment-action ${liked ? 'is-active' : ''}" type="button" data-like-comment="${escapeHtml(comment.id || '')}">${liked ? '♥' : '♡'} ${Number(comment.likes_count) || 0}</button>
        ${!isReply ? `<button class="comment-action" type="button" data-reply-comment="${escapeHtml(comment.id || '')}">↩ Répondre</button>` : ''}
      </div>
      ${replies.length ? `<div class="comment-replies">${replies.reverse().map(reply => renderCommentCard(reply, [])).join('')}</div>` : ''}
    </article>
  `;
}

function getDemoComments(){
  return [
    {id:'demo-comment', name:'Planète Stream', avatar:'🪐', rating:8, text:'La zone de critiques est prête. Les vrais avis prendront la place de ce message dès qu’un spectateur publiera sa critique.', date:new Date().toISOString(), likes_count:0}
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

function getEstimatedViews(item){
  const base = String(item.slug || item.title || 'planetestream').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return formatNumber(120 + (base % 850));
}

function formatNumber(value){
  return Number(value || 0).toLocaleString('fr-FR');
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

function cssEscape(value=''){
  if(window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function makeUuid(){
  if(window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

function escapeHtml(str=''){
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

initWatch();
