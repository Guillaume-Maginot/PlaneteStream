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
  viewer_history: null,
  movie_ratings: null,
  reports: null,
  notifications: null
};

let currentItem = null;
let currentCatalogue = [];
let currentViewer = null;
let currentComments = [];
let currentRatings = [];
let currentUserRating = null;
let likedCommentIds = new Set();
let commentSortMode = 'recent';
let profileStatsCache = new Map();
let communityPollTimer = null;
let communityPollSignature = '';
let communityPollBusy = false;
let realtimeCommentsClient = null;
let realtimeCommentsChannel = null;
let realtimeCommentsMovieId = '';
let realtimeCommentsRefreshTimer = null;
let realtimeLikesClient = null;
let realtimeLikesChannel = null;
let realtimeLikesMovieId = '';
let realtimeLikesRefreshTimers = new Map();
let realtimeRatingsClient = null;
let realtimeRatingsChannel = null;
let realtimeRatingsMovieId = '';
let realtimeRatingsRefreshTimer = null;
let reviewFormDirty = false;
let reviewFormModeKey = '';
const COMMENT_MAX_VISUAL_DEPTH = 2;

async function initWatch(){
  if(window.PS?.ready){
    await window.PS.ready;
  }
  if(window.PS?.refreshAuthState){
    await window.PS.refreshAuthState({force:false});
  }

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if(!slug){
    showWatchError('Aucun film sélectionné. La salle est belle, mais vide.');
    return;
  }

  try{
    currentViewer = await getAuthenticatedViewerForPage();
    const res = await fetch('data/catalogue.json');
    const catalogue = await res.json();
    const item = catalogue.find(entry => entry.slug === slug);

    if(!item){
      showWatchError('Ce contenu est introuvable dans le catalogue.');
      return;
    }

    currentItem = item;
    currentCatalogue = catalogue;

    if(!hasBetaVideo(item)){
      showWatchError('Aucune vidéo bêta n’est disponible pour ce contenu. La salle reste fermée, les fauteuils râlent.');
      return;
    }

    if(!currentViewer?.id){
      showWatchLoginRequired(item);
      return;
    }

    await renderWatch(item, catalogue);
    bindWatchEvents(item);
    renderViewerBox();
    await refreshCommunity(item);
    startCommunityPolling(item);
    startRealtimeComments(item);
    startRealtimeLikes(item);
    startRealtimeRatings(item);
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
          <p>Critiques, réponses, édition et suppression passent par le compte connecté. Le club devient sérieux, les pantoufles restent acceptées.</p>
        </div>
        <div class="comments-toolbar" aria-label="Tri des critiques">
          <label for="commentsSort">Trier par</label>
          <select id="commentsSort">
            <option value="recent">Plus récentes</option>
            <option value="popular">Plus likées</option>
            <option value="rated">Mieux notées</option>
            <option value="replies">Plus commentées</option>
          </select>
        </div>
      </div>

      <form class="quick-rating-form watch-panel" id="quickRatingForm">
        <div>
          <p class="eyebrow">Votre note</p>
          <h3>Noter ce film</h3>
          <p class="soft-note">Un clic suffit. La critique reste optionnelle, parce que tout le monde n'a pas envie d'écrire un traité diplomatique sur les explosions.</p>
        </div>
        <div class="quick-rating-controls">
          <select id="quickRating" required>
            <option value="">Choisir une note</option>
            ${Array.from({length:10}, (_,i) => `<option value="${i+1}">${i+1}/10</option>`).join('')}
          </select>
          <button class="primary" type="submit" id="quickRatingBtn">Enregistrer ma note</button>
        </div>
        <p class="soft-note form-help" id="quickRatingHelp">Connexion obligatoire pour noter.</p>
      </form>

      <form class="comment-form watch-panel" id="commentForm">
        <p class="eyebrow" id="commentFormTitle">Écrire une nouvelle critique</p>
        <div class="viewer-mini" id="formViewerLabel">Publier en tant que spectateur</div>
        <textarea id="commentText" placeholder="Votre critique après cette séance..." maxlength="700" required></textarea>
        <p class="soft-note form-help" id="viewerHelpText">Connexion obligatoire pour publier une critique ou une réponse.</p>
        <button class="primary" type="submit" id="commentSubmitBtn">Publier ma critique</button>
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
  const embed = String(item.videoEmbed || item.video_embed || '').trim();
  const src = extractEmbedSrc(embed);

  if(!src){
    return `
      <div class="watch-unavailable">
        <strong>Vidéo bêta indisponible</strong>
        <p>Le code embed n’a pas pu être lu. Le projecteur tousse, on vérifie la bobine.</p>
      </div>
    `;
  }

  return `
    <iframe
      id="watchPlayer"
      src="about:blank"
      data-src="${escapeAttr(src)}"
      title="Lecture ${escapeHtml(item.title)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
      allowfullscreen>
    </iframe>
  `;
}

function hasBetaVideo(item){
  return Boolean(String(item?.videoEmbed || item?.video_embed || '').trim());
}

function extractEmbedSrc(embed){
  if(!embed) return '';
  const raw = String(embed).trim();
  const iframeSrc = raw.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
  if(iframeSrc?.[1]) return iframeSrc[1].trim();
  if(/^https?:\/\//i.test(raw)) return raw;
  return '';
}

function showWatchLoginRequired(item){
  if(!watchPage) return;
  watchPage.innerHTML = `
    <section class="container watch-loading">
      <h1>🎬 Bêta vidéo réservée aux membres</h1>
      <p>La salle de cinéma est ouverte aux comptes enregistrés pendant les tests.</p>
      <div class="watch-controls" style="justify-content:center;margin-top:18px">
        <a class="primary" href="account.html">Se connecter</a>
        <a class="ghost" href="detail.html?slug=${encodeURIComponent(item.slug)}">Retour à la fiche</a>
      </div>
    </section>
  `;
}

function launchCinema(item, options = {}){
  const frame = document.querySelector('#cinemaFrame');
  const player = document.querySelector('#watchPlayer');
  const playerSrc = player?.dataset?.src || '';

  frame?.classList.add('is-playing');
  document.querySelector('#studioBumper')?.classList.add('hidden');

  if(player && playerSrc && player.getAttribute('src') !== playerSrc){
    player.setAttribute('src', playerSrc);
  }

  frame?.scrollIntoView({behavior: options.instant ? 'auto' : 'smooth', block:'center'});
  saveViewerHistory(item.slug, 10);

  if(options.fullscreen && frame?.requestFullscreen){
    frame.requestFullscreen().catch(() => {
      // Certains navigateurs refusent le plein écran après une navigation.
      // Le bouton “Lancer la projection” garde alors le comportement manuel.
    });
  }
}

function shouldAutoStartCinema(){
  const params = new URLSearchParams(window.location.search);
  return params.get('autoplay') === '1' || params.get('play') === '1';
}

function bindWatchEvents(item){
  document.querySelector('#startCinema')?.addEventListener('click', () => {
    launchCinema(item, {fullscreen:true});
  });

  if(shouldAutoStartCinema()){
    window.setTimeout(() => launchCinema(item, {fullscreen:true, instant:true}), 250);
  }

  document.querySelector('#quickRatingForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const rating = Number(document.querySelector('#quickRating')?.value || 0);
    if(!rating) return;

    const viewer = await ensureViewerForComment();
    if(!viewer) return;

    setStatus('Enregistrement de ta note...', 'pending');
    const ok = await saveQuickRating(item.slug, viewer, rating);

    if(ok){
      currentUserRating = rating;
      setStatus('Note enregistrée. Critique facultative, popcorn obligatoire.', 'ok');
      await refreshCommunity(item);
    }else{
      setStatus('Impossible d’enregistrer la note. Vérifie la table movie_ratings.', 'error');
    }
  });

  document.querySelector('#commentForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const text = document.querySelector('#commentText').value.trim();
    if(!text) return;

    const viewer = await ensureViewerForComment();
    if(!viewer) return;

    const rating = Number(currentUserRating || document.querySelector('#quickRating')?.value || 0) || null;
    const existingReview = findCurrentViewerMainReview(item.slug, viewer);

    if(rating){
      setStatus('Synchronisation de ta note...', 'pending');
      const ratingSaved = await saveQuickRating(item.slug, viewer, rating);
      if(!ratingSaved){
        setStatus('Impossible d’enregistrer la note. La critique n’a pas été publiée pour éviter une note fantôme.', 'error');
        return;
      }
      currentUserRating = rating;
    }

    setStatus(existingReview ? 'Mise à jour de ta critique...' : 'Publication de la critique...', 'pending');
    const ok = existingReview
      ? await updateOwnMainReview(existingReview.id, rating, text)
      : await addReview(item.slug, viewer, rating, text, null);

    if(ok){
      reviewFormDirty = false;
      reviewFormModeKey = '';
      setStatus(existingReview ? 'Critique mise à jour. Ta note reste indépendante.' : 'Critique publiée. Merci pour la trace laissée en orbite.', 'ok');
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

  const mainForm = document.querySelector('#commentForm');
  mainForm?.addEventListener('input', event => {
    if(event.target?.matches?.('#commentText')) reviewFormDirty = true;
  });

  document.querySelector('#commentsSort')?.addEventListener('change', event => {
    commentSortMode = event.target.value || 'recent';
    document.querySelector('#commentsList').innerHTML = renderComments(currentComments);
  communityPollSignature = commentsSignature(currentComments);
  });

  document.querySelector('#commentsList')?.addEventListener('click', async event => {
    const profileBtn = event.target.closest('[data-profile-viewer]');
    if(profileBtn){
      await openMiniProfile(profileBtn.dataset.profileViewer);
      return;
    }

    const editBtn = event.target.closest('[data-edit-comment]');
    if(editBtn){
      openEditBox(editBtn.dataset.editComment);
      return;
    }

    const deleteBtn = event.target.closest('[data-delete-comment]');
    if(deleteBtn){
      await deleteComment(deleteBtn.dataset.deleteComment);
      return;
    }

    const reportBtn = event.target.closest('[data-report-comment]');
    if(reportBtn){
      await reportComment(reportBtn.dataset.reportComment);
      return;
    }

    const cancelEditBtn = event.target.closest('[data-cancel-edit]');
    if(cancelEditBtn){
      cancelEditBtn.closest('.edit-form')?.remove();
      return;
    }

    const closeProfileBtn = event.target.closest('[data-close-profile]');
    if(closeProfileBtn){
      document.querySelector('#profileMiniModal')?.remove();
      return;
    }

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
    const editForm = event.target.closest('.edit-form');
    if(editForm){
      event.preventDefault();
      await submitEditComment(editForm);
      return;
    }

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
      await notifyReplyRecipient(parentId, viewer);
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
  const [comments, ratings, stats, views] = await Promise.all([
    fetchComments(item.slug),
    fetchMovieRatings(item.slug),
    fetchMovieStats(item.slug),
    recordAndFetchMovieViews(item.slug)
  ]);

  currentComments = comments.online ? comments.data : getLocalComments(item.slug);
  currentRatings = ratings.online ? ratings.data : [];
  currentUserRating = getCurrentViewerRating(currentRatings);
  syncQuickRatingSelect();

  if(comments.online && currentViewer?.id){
    likedCommentIds = await fetchLikedCommentIds(currentViewer.id, currentComments.map(comment => comment.id).filter(Boolean));
  }else{
    likedCommentIds = new Set();
  }

  const sortSelect = document.querySelector('#commentsSort');
  if(sortSelect) sortSelect.value = commentSortMode;
  document.querySelector('#commentsList').innerHTML = renderComments(currentComments);
  scrollToCommentFromHash();

  updateCommunityRatingLabel(currentComments, stats, currentRatings);

  if(views.online && views.total_views){
    const viewLabel = document.querySelector('#viewCountLabel');
    if(viewLabel) viewLabel.textContent = `${formatNumber(views.total_views)} vue${Number(views.total_views) > 1 ? 's' : ''} totale${Number(views.total_views) > 1 ? 's' : ''}`;
  }

  const moodComments = comments.online ? comments.data : getLocalComments(item.slug);
  document.querySelector('#moodLine').textContent = getMoodLine(item, moodComments);

  if(comments.online || ratings.online || stats.online){
    setStatus('Avis synchronisés. Notes et critiques vivent maintenant en ligne.', 'ok');
  }else{
    setStatus('Mode local. Les avis en ligne ne répondent pas encore.', 'error');
  }

  await refreshFavoriteButton(item.slug);
  renderViewerBox();
  updateQuickRatingForm();
  updateReviewFormMode();
}

function updateQuickRatingForm(){
  const form = document.querySelector('#quickRatingForm');
  if(!form) return;

  const select = document.querySelector('#quickRating');
  const button = document.querySelector('#quickRatingBtn');
  const help = document.querySelector('#quickRatingHelp');
  const viewer = currentViewer;

  if(!viewer?.id){
    if(select) select.disabled = true;
    if(button) button.disabled = true;
    if(help) help.innerHTML = 'Connexion requise pour noter · <a href="account.html">Ouvrir la page compte</a>';
    return;
  }

  if(select){
    select.disabled = false;
    select.value = currentUserRating ? String(currentUserRating) : '';
  }
  if(button){
    button.disabled = false;
    button.textContent = currentUserRating ? 'Mettre à jour ma note' : 'Enregistrer ma note';
  }
  if(help){
    help.textContent = currentUserRating
      ? `Ta note actuelle : ${currentUserRating}/10. Tu peux la modifier sans toucher à ta critique.`
      : 'Tu peux noter sans écrire de critique. Deux secondes, zéro dissertation.';
  }
}

function updateReviewFormMode({force=false}={}){
  const form = document.querySelector('#commentForm');
  if(!form || !currentItem) return;

  const title = document.querySelector('#commentFormTitle');
  const textInput = document.querySelector('#commentText');
  const submitBtn = document.querySelector('#commentSubmitBtn');
  const helpText = document.querySelector('#viewerHelpText');

  if(!currentViewer?.id){
    if(title) title.textContent = 'Écrire une nouvelle critique';
    if(submitBtn) submitBtn.textContent = 'Publier ma critique';
    if(textInput) textInput.disabled = true;
    if(helpText) helpText.innerHTML = 'Connexion requise · <a href="account.html">Ouvrir la page compte</a>';
    reviewFormModeKey = 'guest';
    return;
  }

  if(textInput) textInput.disabled = false;

  const existingReview = findCurrentViewerMainReview(currentItem.slug, currentViewer);
  const replyCount = existingReview ? countRepliesForComment(existingReview.id) : 0;
  const modeKey = existingReview ? `edit:${existingReview.id}:${existingReview.edited_at || existingReview.date || ''}` : 'create';
  const formHasFocus = form.contains(document.activeElement);
  const shouldHydrate = force || !reviewFormDirty || reviewFormModeKey !== modeKey || !formHasFocus;

  if(existingReview){
    if(title) title.textContent = 'Modifier ma critique';
    if(submitBtn) submitBtn.textContent = 'Mettre à jour ma critique';
    if(helpText){
      helpText.textContent = replyCount > 0
        ? `Tu modifies ta critique existante. ${replyCount} réponse${replyCount > 1 ? 's' : ''} rester${replyCount > 1 ? 'ont' : 'a'} attachée${replyCount > 1 ? 's' : ''} à cette discussion.`
        : 'Tu modifies ta critique existante. La note se gère séparément juste au-dessus.';
    }
    if(shouldHydrate){
      if(textInput) textInput.value = existingReview.text || '';
      reviewFormDirty = false;
    }
  }else{
    if(title) title.textContent = 'Écrire une nouvelle critique';
    if(submitBtn) submitBtn.textContent = 'Publier ma critique';
    if(helpText) helpText.textContent = `Tu es connecté en tant que ${currentViewer.pseudo}. La critique est facultative et peut compléter ta note.`;
    if(shouldHydrate){
      if(textInput) textInput.value = '';
      reviewFormDirty = false;
    }
  }

  reviewFormModeKey = modeKey;
}

function countRepliesForComment(commentId){
  return (currentComments || []).filter(comment => String(comment.parent_id || '') === String(commentId || '')).length;
}

async function addReview(slug, viewer, rating, text, parentId=null){
  const state = window.PS?.refreshAuthState
    ? await window.PS.refreshAuthState({force:true})
    : await window.PSAuth?.getAuthState?.();

  const authUserId = state?.user?.id || viewer?.auth_user_id || null;
  const officialViewer = state?.viewer?.id ? state.viewer : viewer;

  if(!authUserId || !officialViewer?.id){
    setStatus('Session Auth introuvable. Reconnecte-toi depuis la page Compte.', 'error');
    showAuthRequiredNotice();
    return false;
  }

  if(isViewerCurrentlyBanned(officialViewer)){
    setStatus(banActionMessage(officialViewer), 'error');
    return false;
  }

  currentViewer = officialViewer;
  renderViewerBox();

  const basePayload = {
    movie_id: slug,
    user_id: authUserId,
    auth_user_id: authUserId,
    viewer_uuid: officialViewer.id,
    display_name: officialViewer.pseudo,
    comment: text,
    rating: parentId ? null : rating,
    parent_id: parentId,
    likes_count: 0,
    created_at: new Date().toISOString()
  };

  return supabaseInsert('comments', basePayload);
}


async function notifyReplyRecipient(parentId, actorViewer){
  if(!window.PS?.createNotification || !parentId || !actorViewer?.id || !currentItem?.slug) return false;
  const parent = (currentComments || []).find(comment => String(comment.id) === String(parentId));
  if(!parent?.viewer_uuid || String(parent.viewer_uuid) === String(actorViewer.id)) return false;

  return window.PS.createNotification({
    type:'reply',
    recipient_viewer_id:parent.viewer_uuid,
    actor_viewer_id:actorViewer.id,
    movie_id:currentItem.slug,
    comment_id:parentId,
    parent_comment_id:parent.parent_id || null,
    message:`${actorViewer.pseudo || 'Un Planétien'} vous a répondu sur ${currentItem.title || 'Planète Stream'}`
  });
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

  const result = await supabaseSelect('viewers', `id=in.(${cleanIds.join(',')})&select=id,pseudo,avatar,badge,created_at,last_seen,role,banned_at,banned_until,ban_reason,banned_by`);
  if(!result.ok) return new Map();

  return new Map((result.data || []).map(viewer => [viewer.id, viewer]));
}

async function fetchMovieStats(slug){
  const result = await supabaseSelect('movie_stats', `movie_id=eq.${encodeURIComponent(slug)}&select=movie_id,average_rating,total_votes&limit=1`);
  if(!result.ok) return {online:false, data:null};
  const row = Array.isArray(result.data) ? result.data[0] : null;
  return {online:true, data:row || null};
}


async function fetchMovieRatings(slug){
  const result = await supabaseSelect('movie_ratings', `movie_id=eq.${encodeURIComponent(slug)}&select=movie_id,viewer_id,auth_user_id,rating,updated_at,created_at&order=updated_at.desc&limit=500`);
  if(!result.ok) return {online:false, data:[]};
  return {online:true, data:(result.data || []).map(row => ({
    movie_id: row.movie_id,
    viewer_id: row.viewer_id || null,
    auth_user_id: row.auth_user_id || null,
    rating: Number(row.rating) || 0,
    updated_at: row.updated_at || row.created_at || null
  })).filter(row => row.rating > 0)};
}

function getCurrentViewerRating(ratings=[]){
  const viewerId = currentViewer?.id || null;
  const authUserId = getCurrentAuthUserId();
  const match = (ratings || []).find(row => {
    if(viewerId && row.viewer_id === viewerId) return true;
    if(authUserId && row.auth_user_id === authUserId) return true;
    return false;
  });
  return match ? Number(match.rating) || null : null;
}

async function saveQuickRating(slug, viewer, rating){
  const state = window.PS?.refreshAuthState
    ? await window.PS.refreshAuthState({force:true})
    : await window.PSAuth?.getAuthState?.();

  const authUserId = state?.user?.id || viewer?.auth_user_id || getCurrentAuthUserId();
  const officialViewer = state?.viewer?.id ? state.viewer : viewer;

  if(!authUserId || !officialViewer?.id){
    showAuthRequiredNotice();
    return false;
  }

  if(isViewerCurrentlyBanned(officialViewer)){
    setStatus(banActionMessage(officialViewer), 'error');
    return false;
  }

  currentViewer = officialViewer;
  const payload = {
    movie_id: slug,
    viewer_id: officialViewer.id,
    auth_user_id: authUserId,
    rating: Number(rating),
    updated_at: new Date().toISOString()
  };

  const filter = `movie_id=eq.${encodeURIComponent(slug)}&viewer_id=eq.${encodeURIComponent(officialViewer.id)}`;
  const existing = await supabaseSelect('movie_ratings', `${filter}&select=movie_id,viewer_id&limit=1`);
  const hasExisting = existing.ok && Array.isArray(existing.data) && existing.data.length > 0;
  const saved = hasExisting
    ? await supabaseUpdate('movie_ratings', filter, payload)
    : await supabaseInsert('movie_ratings', {...payload, created_at: new Date().toISOString()}, {acceptDuplicate:true});

  if(saved){
    const ownReview = findCurrentViewerMainReview(slug, officialViewer);
    if(ownReview?.id && canManageComment(ownReview)){
      await supabaseUpdate('comments', `id=eq.${encodeURIComponent(ownReview.id)}`, {rating:Number(rating), edited_at: ownReview.edited_at || new Date().toISOString()});
    }
  }

  return saved;
}

function updateCommunityRatingLabel(comments=[], stats={online:false, data:null}, ratings=[]){
  const label = document.querySelector('#communityRatingLabel');
  if(!label) return;

  const rootRatings = getCombinedMovieRatings(comments, ratings);

  if(rootRatings.length){
    const average = rootRatings.reduce((sum, value) => sum + value, 0) / rootRatings.length;
    const reviewCount = (comments || []).filter(comment => !comment.parent_id && String(comment.text || '').trim()).length;
    label.textContent = `${average.toFixed(1)}/10 (${rootRatings.length} note${rootRatings.length > 1 ? 's' : ''}${reviewCount ? ` · ${reviewCount} critique${reviewCount > 1 ? 's' : ''}` : ''})`;
    return;
  }

  const stat = stats?.data || null;
  const statAverage = Number(stat?.average_rating);
  const statVotes = Number(stat?.total_votes) || 0;

  if(stats?.online && Number.isFinite(statAverage) && statAverage > 0 && statVotes > 0){
    label.textContent = `${statAverage.toFixed(1)}/10 (${statVotes} vote${statVotes > 1 ? 's' : ''})`;
    return;
  }

  label.textContent = stats?.online ? 'Pas encore' : 'Hors ligne';
}


function getUniqueMovieRatings(ratings=[]){
  const latestByViewer = new Map();

  (ratings || []).forEach(row => {
    const rating = Number(row.rating);
    if(!Number.isFinite(rating) || rating <= 0) return;
    const key = row.viewer_id || row.auth_user_id;
    if(!key) return;
    const date = dateScore(row.updated_at || row.created_at);
    const previous = latestByViewer.get(key);
    if(!previous || date >= previous.date){
      latestByViewer.set(key, {rating, date});
    }
  });

  return [...latestByViewer.values()].map(entry => entry.rating);
}

function getCombinedMovieRatings(comments=[], ratings=[]){
  const latestByViewer = new Map();

  (ratings || []).forEach(row => {
    const rating = Number(row.rating);
    if(!Number.isFinite(rating) || rating <= 0) return;
    const key = row.viewer_id || row.auth_user_id;
    if(!key) return;
    const date = dateScore(row.updated_at || row.created_at);
    const previous = latestByViewer.get(key);
    if(!previous || date >= previous.date){
      latestByViewer.set(key, {rating, date, source:'movie_ratings'});
    }
  });

  (comments || [])
    .filter(comment => !comment.parent_id)
    .forEach(comment => {
      const rating = Number(comment.rating);
      if(!Number.isFinite(rating) || rating <= 0) return;
      const key = comment.viewer_uuid || comment.auth_user_id || comment.name || comment.id;
      if(!key || latestByViewer.has(key)) return;
      const date = dateScore(comment.edited_at || comment.date);
      latestByViewer.set(key, {rating, date, source:'comments_fallback'});
    });

  return [...latestByViewer.values()].map(entry => entry.rating);
}

function getUniqueViewerRatings(comments=[]){
  const latestByViewer = new Map();

  (comments || [])
    .filter(comment => !comment.parent_id)
    .forEach(comment => {
      const rating = Number(comment.rating);
      if(!Number.isFinite(rating) || rating <= 0) return;

      const key = comment.viewer_uuid || comment.auth_user_id || comment.name || comment.id;
      const date = dateScore(comment.edited_at || comment.date);
      const previous = latestByViewer.get(key);

      if(!previous || date >= previous.date){
        latestByViewer.set(key, {rating, date});
      }
    });

  return [...latestByViewer.values()].map(entry => entry.rating);
}

function findCurrentViewerMainReview(slug, viewer){
  const viewerId = viewer?.id || currentViewer?.id || null;
  const authUserId = window.PS?.user?.id || window.PS?.session?.user?.id || null;

  return (currentComments || [])
    .filter(comment => !comment.parent_id)
    .filter(comment => {
      if(viewerId && comment.viewer_uuid === viewerId) return true;
      if(authUserId && comment.auth_user_id === authUserId) return true;
      return false;
    })
    .sort((a,b) => dateScore(b.edited_at || b.date) - dateScore(a.edited_at || a.date))[0] || null;
}

async function updateOwnMainReview(commentId, rating, text){
  const comment = findCommentById(commentId);
  if(!comment || !canManageComment(comment) || comment.parent_id) return false;

  return supabaseUpdate('comments', `id=eq.${encodeURIComponent(commentId)}`, {
    comment: text,
    rating: rating === null || rating === undefined ? null : Number(rating) || null,
    edited_at: new Date().toISOString()
  });
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
  const viewer = await getAuthenticatedViewerForPage();
  if(viewer?.id){
    if(isViewerCurrentlyBanned(viewer)){
      currentViewer = viewer;
      renderViewerBox();
      if(!silent) setStatus(banActionMessage(viewer), 'error');
      return null;
    }
    currentViewer = viewer;
    renderViewerBox();
    return viewer;
  }

  if(!silent){
    showAuthRequiredNotice();
    setStatus('Connexion requise pour cette action.', 'error');
  }

  return null;
}

async function ensureViewerForComment(){
  const viewer = await getAuthenticatedViewerForPage();

  if(!viewer?.id){
    setStatus('Connexion requise : ouvre la page Compte puis reconnecte-toi.', 'error');
    showAuthRequiredNotice();
    return null;
  }

  if(isViewerCurrentlyBanned(viewer)){
    currentViewer = viewer;
    renderViewerBox();
    setStatus(banActionMessage(viewer), 'error');
    return null;
  }

  currentViewer = viewer;
  renderViewerBox();
  return viewer;
}

async function getAuthenticatedViewerForPage(){
  if(window.PS?.ready){
    await window.PS.ready;
  }

  const state = window.PS?.refreshAuthState
    ? await window.PS.refreshAuthState({force:false})
    : await window.PSAuth?.getAuthState?.();

  if(state?.isAuthenticated && state.viewer?.id){
    currentViewer = state.viewer;
    return state.viewer;
  }

  currentViewer = null;
  return null;
}

function showAuthRequiredNotice(profileOnly=false){
  const helpText = document.querySelector('#viewerHelpText');
  if(helpText){
    helpText.innerHTML = `${profileOnly ? 'Profil à finaliser' : 'Connexion requise'} · <a href="account.html">Ouvrir la page compte</a>`;
  }
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
  const result = await supabaseSelect('viewers', `pseudo=eq.${encodeURIComponent(pseudo)}&select=id,pseudo,avatar,badge,role,created_at,last_seen&limit=1`);
  if(!result.ok) return null;
  return Array.isArray(result.data) ? result.data[0] : null;
}

function normalizeViewer(row){
  const pseudo = row.pseudo || 'Spectateur';
  return {
    id: row.id,
    pseudo,
    avatar: row.avatar || pickAvatar(pseudo),
    badge: String(row.badge || 'none').toLowerCase(),
    created_at: row.created_at || null,
    last_seen: row.last_seen || null,
    role: row.role || 'viewer',
    auto: /^Spectateur \d{4}$/.test(String(pseudo))
  };
}

function pickAvatar(seed=''){
  if(window.PSAuth?.pickAvatar) return PSAuth.pickAvatar(seed);
  const avatars = ['orbiteur','robot','explorateur','renard','hibou','cosmonaute','masques','projectionniste','chat','kraken','cyberpunk','vip'];
  const score = String(seed).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return avatars[score % avatars.length];
}

function loadViewer(){
  if(window.PSAuth?.loadViewer) return PSAuth.loadViewer();
  try{
    return JSON.parse(localStorage.getItem(`${storePrefix}:viewer`) || 'null');
  }catch{
    return null;
  }
}

function saveViewer(viewer){
  if(window.PSAuth?.saveViewer) return PSAuth.saveViewer(viewer);
  localStorage.setItem(`${storePrefix}:viewer`, JSON.stringify(viewer));
}

function renderViewerBox(){
  const box = document.querySelector('#viewerBox');
  const label = document.querySelector('#formViewerLabel');
  const helpText = document.querySelector('#viewerHelpText');
  const viewer = currentViewer;

  if(box){
    if(viewer?.pseudo){
      box.innerHTML = `
        <p class="eyebrow">Spectateur</p>
        <div class="viewer-card-mini">
          ${PSAuth.avatarHtml(PSAuth.displayAvatar?.(viewer) || viewer.avatar || 'orbiteur', 'viewer-avatar')}
          <div>
            <strong>${escapeHtml(viewer.pseudo)}</strong>
            <small id="viewCountLabel">${isViewerCurrentlyBanned(viewer) ? escapeHtml(banShortLabel(viewer)) : 'Audience connectée'}</small>
            <p id="moodLine">${getMoodLine(currentItem || {}, currentComments)}</p>
          </div>
        </div>
      `;
    }else{
      box.innerHTML = `
        <p class="eyebrow">Spectateur</p>
        <strong id="viewCountLabel">Invité</strong>
        <p id="moodLine">Lecture libre. Critiques et réponses demandent un compte sécurisé.</p>
      `;
    }
  }

  if(label){
    label.innerHTML = viewer?.pseudo
      ? `${PSAuth.avatarHtml(PSAuth.displayAvatar?.(viewer) || viewer.avatar || 'orbiteur', 'viewer-avatar small')} Publication en tant que <strong>${escapeHtml(viewer.pseudo)}</strong>`
      : '<a href="account.html">Se connecter pour publier</a>';
  }

  if(helpText){
    helpText.textContent = viewer?.pseudo
      ? isViewerCurrentlyBanned(viewer)
        ? banActionMessage(viewer)
        : isAutoViewer(viewer)
          ? 'Compte temporaire : crée un compte sécurisé pour publier.'
          : `Tu es connecté en tant que ${viewer.pseudo}.`
      : 'Pour publier, connecte-toi ou crée un compte sécurisé.';
  }

}



function isViewerCurrentlyBanned(viewer={}){
  if(window.PSAuth?.isBanActive) return PSAuth.isBanActive(viewer);
  if(!viewer?.banned_at) return false;
  if(!viewer.banned_until) return true;
  return new Date(viewer.banned_until).getTime() > Date.now();
}

function banShortLabel(viewer={}){
  if(!isViewerCurrentlyBanned(viewer)) return '';
  if(viewer.banned_until) return `Banni jusqu’au ${new Date(viewer.banned_until).toLocaleString('fr-FR')}`;
  return 'Banni définitivement';
}

function banActionMessage(viewer={}){
  if(!isViewerCurrentlyBanned(viewer)) return '';
  const reason = viewer.ban_reason ? ` Motif : ${viewer.ban_reason}.` : '';
  return `${banShortLabel(viewer)}. Les actions communautaires sont temporairement verrouillées.${reason}`;
}

function getCurrentAuthUserId(){
  return window.PS?.state?.user?.id || window.PS?.getState?.()?.user?.id || null;
}

function canManageComment(comment){
  const authUserId = getCurrentAuthUserId();
  if(!comment || !authUserId) return false;
  if(comment.auth_user_id && comment.auth_user_id === authUserId) return true;
  if(currentViewer?.id && comment.viewer_uuid && comment.viewer_uuid === currentViewer.id) return true;
  return isModerationViewer(window.PS?.state?.viewer || currentViewer);
}

function isModerationViewer(viewer={}){
  const role = String(viewer?.role || '').toLowerCase();
  const badge = String(viewer?.badge || '').toLowerCase();
  return ['admin','founder','fondateur','moderator','moderateur','architecte'].includes(role) || ['founder','fondateur','moderator','moderateur','architecte'].includes(badge);
}

function canReportComment(comment){
  // Le signalement est ouvert à tous les Planétiens connectés.
  // Les invités voient les critiques, mais doivent se connecter pour signaler.
  return Boolean(comment?.id && currentViewer?.id && !isViewerCurrentlyBanned(currentViewer));
}


function findCommentById(commentId){
  return currentComments.find(comment => String(comment.id) === String(commentId));
}

function openEditBox(commentId){
  const comment = findCommentById(commentId);
  const card = document.querySelector(`[data-comment-id="${cssEscape(commentId)}"]`);
  if(!comment || !card || !canManageComment(comment)) return;

  const existing = card.querySelector('.edit-form');
  if(existing){
    existing.querySelector('textarea')?.focus();
    return;
  }

  const form = document.createElement('form');
  form.className = 'edit-form';
  form.dataset.commentId = commentId;
  form.innerHTML = `
    <p class="eyebrow">Modifier ${comment.parent_id ? 'la réponse' : 'la critique'}</p>
    ${comment.parent_id ? '' : `
      <select name="rating" required>
        ${Array.from({length:10}, (_,i) => `<option value="${i+1}" ${Number(comment.rating) === i+1 ? 'selected' : ''}>${i+1}/10</option>`).join('')}
      </select>
    `}
    <textarea maxlength="700" required>${escapeHtml(comment.text || '')}</textarea>
    <div class="reply-actions">
      <button class="primary" type="submit">Enregistrer</button>
      <button class="ghost" type="button" data-cancel-edit>Annuler</button>
    </div>
  `;
  card.appendChild(form);
  form.querySelector('textarea')?.focus();
}

async function submitEditComment(form){
  const commentId = form.dataset.commentId;
  const comment = findCommentById(commentId);
  if(!comment || !canManageComment(comment)){
    setStatus('Impossible de modifier cette critique avec ce compte.', 'error');
    return;
  }

  const text = form.querySelector('textarea')?.value.trim();
  if(!text) return;

  const payload = {
    comment: text,
    edited_at: new Date().toISOString()
  };

  if(!comment.parent_id){
    payload.rating = Number(form.querySelector('select[name="rating"]')?.value || comment.rating || 0) || null;
  }

  const viewer = await getAuthenticatedViewerForPage();
  if(!viewer?.id){
    setStatus('Connexion requise pour modifier cette critique.', 'error');
    return;
  }

  if(!comment.parent_id && payload.rating){
    setStatus('Synchronisation de ta note...', 'pending');
    const ratingSaved = await saveQuickRating(currentItem.slug, viewer, payload.rating);
    if(!ratingSaved){
      setStatus('Impossible d’enregistrer la note. Modification annulée pour éviter une note fantôme.', 'error');
      return;
    }
    currentUserRating = payload.rating;
  }

  setStatus('Modification de la critique...', 'pending');
  const ok = await supabaseUpdate('comments', `id=eq.${encodeURIComponent(commentId)}`, payload);
  if(ok){
    setStatus('Critique modifiée. Le parchemin est à jour.', 'ok');
    await refreshCommunity(currentItem);
  }else{
    setStatus('Modification refusée. Vérifie les policies UPDATE de comments.', 'error');
  }
}


async function reportComment(commentId){
  const comment = findCommentById(commentId);
  const viewer = await getAuthenticatedViewerForPage();
  if(!comment || !viewer?.id || !getCurrentAuthUserId()){
    setStatus('Connexion requise pour signaler ce message.', 'error');
    return;
  }

  const reasons = [
    ['spam', '📢 Spam'],
    ['insulte', '🤬 Insulte ou harcèlement'],
    ['spoiler', '🎬 Spoiler non signalé'],
    ['inapproprie', '⚠️ Contenu inapproprié'],
    ['autre', '❓ Autre']
  ];
  const selectedReason = await openReportReasonDialog(reasons);
  if(!selectedReason) return;

  setStatus('Envoi du signalement...', 'pending');
  const existing = await supabaseSelect('reports', `reporter_viewer_id=eq.${encodeURIComponent(viewer.id)}&target_type=eq.comment&target_id=eq.${encodeURIComponent(comment.id)}&select=id&limit=1`);
  if(existing.ok && Array.isArray(existing.data) && existing.data.length){
    setStatus('Tu as déjà signalé ce message. Les modos ont reçu le pigeon rouge.', 'ok');
    return;
  }

  const row = await supabaseInsertReturning('reports', {
    reporter_viewer_id: viewer.id,
    target_type: 'comment',
    target_id: comment.id,
    movie_id: currentItem?.slug || comment.movie_id || null,
    reason: selectedReason[0],
    details: null,
    status: 'new',
    created_at: new Date().toISOString()
  });

  if(!row?.id){
    setStatus('Impossible d’enregistrer le signalement. Vérifie la table reports/RLS.', 'error');
    return;
  }

  await notifyModeratorsOfReport(row, comment, viewer, selectedReason[1].replace(/^[^\wÀ-ÿ]+\s*/, ''));
  setStatus('Signalement envoyé. L’équipe a reçu l’alerte rouge.', 'ok');
}

function openReportReasonDialog(reasons){
  return new Promise(resolve => {
    const previous = document.querySelector('.report-modal');
    if(previous) previous.remove();

    const overlay = document.createElement('div');
    overlay.className = 'report-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'reportModalTitle');

    overlay.innerHTML = `
      <div class="report-card-dialog">
        <button class="report-modal-close" type="button" aria-label="Fermer">×</button>
        <div class="report-modal-head">
          <span class="report-modal-icon">🚩</span>
          <div>
            <h3 id="reportModalTitle">Signaler ce message</h3>
            <p>Pourquoi souhaitez-vous le signaler ?</p>
          </div>
        </div>
        <div class="report-reasons" role="radiogroup" aria-label="Motif du signalement">
          ${reasons.map(([value, label], index) => `
            <label class="report-reason">
              <input type="radio" name="report-reason" value="${escapeAttr(value)}" ${index === 0 ? 'checked' : ''}>
              <span>${escapeHtml(label)}</span>
            </label>
          `).join('')}
        </div>
        <p class="report-hint">Les signalements sont examinés par l’équipe de modération.</p>
        <div class="report-modal-actions">
          <button class="ghost" type="button" data-report-cancel>Annuler</button>
          <button class="primary" type="button" data-report-submit>Envoyer</button>
        </div>
      </div>
    `;

    const close = (value = null) => {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      resolve(value);
    };

    const onKeydown = event => {
      if(event.key === 'Escape') close(null);
    };

    overlay.addEventListener('click', event => {
      if(event.target === overlay) close(null);
      if(event.target.closest('[data-report-cancel]') || event.target.closest('.report-modal-close')) close(null);
      if(event.target.closest('[data-report-submit]')){
        const checked = overlay.querySelector('input[name="report-reason"]:checked');
        const reason = reasons.find(([value]) => value === checked?.value);
        close(reason || null);
      }
    });

    document.addEventListener('keydown', onKeydown);
    document.body.appendChild(overlay);
    overlay.querySelector('input[name="report-reason"]')?.focus();
  });
}

async function notifyModeratorsOfReport(report, comment, reporter, reasonLabel){
  if(!window.PS?.createNotification || !report?.id || !comment?.id) return false;

  const staff = await fetchModerationViewers();
  const movieTitle = currentItem?.title || currentItem?.slug || 'Planète Stream';

  // Anti-doublon intelligent :
  // - un même planétien ne peut signaler qu'une fois le même message ;
  // - plusieurs planétiens peuvent signaler le même message ;
  // - côté équipe, on garde une seule alerte par message et par modo, avec un compteur.
  const reportsCountResult = await supabaseSelect(
    'reports',
    `target_type=eq.comment&target_id=eq.${encodeURIComponent(comment.id)}&status=eq.new&select=id`
  );
  const reportsCount = reportsCountResult.ok && Array.isArray(reportsCountResult.data)
    ? reportsCountResult.data.length
    : 1;

  const label = reportsCount > 1
    ? `🚩 ${reportsCount} signalements sur ${movieTitle} · dernier motif : ${reasonLabel}`
    : `🚩 Signalement sur ${movieTitle} · ${reasonLabel}`;

  await Promise.all(staff
    .filter(member => member?.id && String(member.id) !== String(reporter.id))
    .map(async member => {
      const existing = await supabaseSelect(
        'notifications',
        `recipient_viewer_id=eq.${encodeURIComponent(member.id)}&type=eq.report&comment_id=eq.${encodeURIComponent(comment.id)}&read_at=is.null&select=id&limit=1`
      );

      if(existing.ok && Array.isArray(existing.data) && existing.data.length){
        await supabaseUpdate('notifications', `id=eq.${encodeURIComponent(existing.data[0].id)}`, {
          actor_viewer_id: reporter.id,
          message: label,
          created_at: new Date().toISOString()
        });
        return true;
      }

      return window.PS.createNotification({
        type:'report',
        recipient_viewer_id:member.id,
        actor_viewer_id:reporter.id,
        movie_id:currentItem?.slug || comment.movie_id || null,
        comment_id:comment.id,
        parent_comment_id:comment.parent_id || null,
        message:label
      });
    }));

  await window.PS?.refreshNotificationsCount?.();
  return true;
}

async function fetchModerationViewers(){
  const query = 'or=(role.in.(admin,founder,fondateur,moderator,moderateur,architecte),badge.in.(founder,fondateur,moderator,moderateur,architecte))&select=id,pseudo,avatar,badge,role';
  const result = await supabaseSelect('viewers', query);
  if(!result.ok || !Array.isArray(result.data)) return [];
  return result.data.filter(isModerationViewer);
}

async function deleteComment(commentId){
  const comment = findCommentById(commentId);
  if(!comment || !canManageComment(comment)){
    setStatus('Impossible de supprimer cette critique avec ce compte.', 'error');
    return;
  }

  const isMainReview = !comment.parent_id;
  const label = isMainReview
    ? 'cette critique, sa note et ses réponses'
    : 'cette réponse';
  if(!window.confirm(`Supprimer ${label} ?`)) return;

  setStatus('Suppression en cours...', 'pending');
  const ok = await supabaseDelete('comments', `id=eq.${encodeURIComponent(commentId)}`);
  if(ok){
    if(isMainReview){
      await deleteIndependentRatingForComment(comment);
    }
    await closeReportsAndAlertsForComment(comment.id);
    setStatus('Critique supprimée. Le balai cosmique a fait son œuvre.', 'ok');
    await refreshCommunity(currentItem);
  }else{
    setStatus('Suppression refusée. Vérifie les policies DELETE de comments.', 'error');
  }
}


async function closeReportsAndAlertsForComment(commentId){
  if(!commentId) return false;
  const viewer = await getAuthenticatedViewerForPage();
  const now = new Date().toISOString();

  // Quand un modérateur supprime directement un message signalé depuis la page film,
  // on clôt aussi les signalements et les alertes associées chez toute l'équipe.
  await supabaseUpdate('reports', `target_type=eq.comment&target_id=eq.${encodeURIComponent(commentId)}&status=eq.new`, {
    status:'reviewed',
    handled_by: viewer?.id || null,
    handled_at: now
  });

  await supabaseUpdate('notifications', `type=eq.report&comment_id=eq.${encodeURIComponent(commentId)}&read_at=is.null`, {read_at:now});
  await supabaseUpdate('notifications', `type=eq.report&parent_comment_id=eq.${encodeURIComponent(commentId)}&read_at=is.null`, {read_at:now});
  await window.PS?.refreshNotificationsCount?.();
  return true;
}

async function deleteIndependentRatingForComment(comment){
  const movieId = comment?.movie_id || currentItem?.slug;
  const viewerId = comment?.viewer_uuid || currentViewer?.id;
  if(!movieId || !viewerId) return false;

  const deleted = await supabaseDelete(
    'movie_ratings',
    `movie_id=eq.${encodeURIComponent(movieId)}&viewer_id=eq.${encodeURIComponent(viewerId)}`
  );

  if(currentItem?.slug === movieId && currentViewer?.id === viewerId){
    currentUserRating = null;
    const quickRating = document.querySelector('#quickRating');
    if(quickRating) quickRating.value = '';
  }

  return deleted;
}

async function openMiniProfile(viewerId){
  if(!viewerId) return;
  const viewer = await fetchSingleViewer(viewerId);
  if(!viewer) return;
  const [stats, recentReviews] = await Promise.all([
    fetchViewerStats(viewerId),
    fetchViewerRecentReviews(viewerId)
  ]);
  const badges = buildProfileBadges(viewer, stats);
  const score = PSAuth.reputationScore ? PSAuth.reputationScore(stats) : (stats.comments * 12 + stats.replies * 5 + stats.likes * 8);
  const level = PSAuth.reputationLevel ? PSAuth.reputationLevel(score) : {icon:'🌱', label:'Nouveau Planétien', progress:0};

  document.querySelector('#profileMiniModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'profileMiniModal';
  modal.className = 'profile-mini-modal';
  modal.innerHTML = `
    <div class="profile-mini-card profile-mini-card-wide" role="dialog" aria-label="Mini profil ${escapeHtml(viewer.pseudo)}">
      <button class="profile-close" type="button" data-close-profile>×</button>
      <div class="profile-mini-head">
        ${PSAuth.avatarHtml(PSAuth.displayAvatar?.(viewer) || viewer.avatar || 'orbiteur', 'viewer-avatar big')}
        <div>
          <p class="eyebrow">Profil spectateur</p>
          <h3>${escapeHtml(viewer.pseudo || 'Spectateur')}</h3>
          <small>${viewer.created_at ? `Membre depuis ${formatCommentDate(viewer.created_at)}` : 'Membre Planète Stream'} · ${escapeHtml(PSAuth.avatarLabel?.(PSAuth.displayAvatar?.(viewer) || viewer.avatar) || 'Orbiteur')}</small>
        </div>
      </div>
      <div class="profile-badges" aria-label="Badges du spectateur">
        ${badges.map(badge => `<span title="${escapeHtml(badge.description)}">${escapeHtml(badge.icon)} ${escapeHtml(badge.label)}</span>`).join('') || '<span>🛰️ Observateur</span>'}
      </div>
      <div class="reputation-panel profile-reputation">
        <div><span>${escapeHtml(level.icon)} ${escapeHtml(level.label)}</span><strong>${score} pts</strong></div>
        <div class="reputation-bar"><i style="width:${Math.max(0, Math.min(100, level.progress || 0))}%"></i></div>
      </div>
      <div class="profile-mini-stats">
        <span><strong>${stats.comments}</strong><small>critiques</small></span>
        <span><strong>${stats.replies}</strong><small>réponses</small></span>
        <span><strong>${stats.likes}</strong><small>likes reçus</small></span>
      </div>
      <p>${stats.comments ? 'Ce spectateur a déjà laissé une trace dans le catalogue.' : 'Ce spectateur observe encore l’orbite avant de graver sa première critique.'}</p>
      ${recentReviews.length ? `
        <div class="profile-recent">
          <h4>Dernières critiques</h4>
          ${recentReviews.map(renderProfileReviewItem).join('')}
        </div>
      ` : ''}
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', event => {
    if(event.target === modal || event.target.closest('[data-close-profile]')) modal.remove();
  });
}

async function fetchSingleViewer(viewerId){
  if(!viewerId || !/^[0-9a-f-]{36}$/i.test(String(viewerId))) return null;
  const result = await supabaseSelect('viewers', `id=eq.${encodeURIComponent(viewerId)}&select=id,pseudo,avatar,badge,created_at,last_seen,role,banned_at,banned_until,ban_reason,banned_by&limit=1`);
  if(!result.ok) return null;
  const row = Array.isArray(result.data) ? result.data[0] : null;
  return row ? normalizeViewer(row) : null;
}

async function fetchViewerStats(viewerId){
  const cacheKey = `stats:${viewerId}`;
  if(profileStatsCache.has(cacheKey)) return profileStatsCache.get(cacheKey);

  const result = await supabaseSelect('comments', `viewer_uuid=eq.${encodeURIComponent(viewerId)}&select=id,parent_id`);
  const rows = result.ok && Array.isArray(result.data) ? result.data : [];
  const commentIds = rows.map(row => row.id).filter(Boolean);
  const likeCounts = await fetchCommentLikeCounts(commentIds);
  const stats = {
    comments: rows.filter(row => !row.parent_id).length,
    replies: rows.filter(row => row.parent_id).length,
    likes: [...likeCounts.values()].reduce((sum, value) => sum + Number(value || 0), 0)
  };
  profileStatsCache.set(cacheKey, stats);
  return stats;
}

async function fetchViewerRecentReviews(viewerId){
  const cacheKey = `recent:${viewerId}`;
  if(profileStatsCache.has(cacheKey)) return profileStatsCache.get(cacheKey);

  const result = await supabaseSelect('comments', `viewer_uuid=eq.${encodeURIComponent(viewerId)}&parent_id=is.null&select=id,movie_id,comment,rating,created_at,edited_at&order=created_at.desc&limit=4`);
  const rows = result.ok && Array.isArray(result.data) ? result.data : [];
  const reviews = rows.map(row => ({
    id: row.id,
    movie_id: row.movie_id,
    movie_title: getCatalogueTitle(row.movie_id),
    comment: row.comment || '',
    rating: Number(row.rating) || 0,
    created_at: row.created_at,
    edited_at: row.edited_at || null
  }));
  profileStatsCache.set(cacheKey, reviews);
  return reviews;
}

function getCatalogueTitle(slug){
  const found = currentCatalogue.find(item => item.slug === slug);
  return found?.title || slug || 'Titre inconnu';
}

function renderProfileReviewItem(review){
  return `
    <a class="profile-review-item" href="watch.html?slug=${encodeURIComponent(review.movie_id)}#comment-${encodeURIComponent(review.id)}">
      <span class="profile-review-rating">${escapeHtml(String(review.rating || '-'))}/10</span>
      <span>
        <strong>${escapeHtml(review.movie_title)}</strong>
        <small>${formatCommentDate(review.created_at)}${review.edited_at ? ' · modifié' : ''}</small>
        <em>${escapeHtml(truncateText(review.comment, 96))}</em>
      </span>
    </a>
  `;
}

function buildProfileBadges(viewer, stats){
  if(PSAuth.badgeDefinitions) return PSAuth.badgeDefinitions(viewer, stats);
  const badges = [];
  const role = String(viewer?.role || 'viewer').toLowerCase();
  if(String(viewer?.badge || '').toLowerCase() === 'architecte' || String(viewer?.avatar || '').toLowerCase() === 'architecte' || (String(viewer?.pseudo || '').toLowerCase().trim() === 'spoofle' && role === 'admin')) badges.push({icon:'🛰️', label:'Architecte', description:'Celui qui a dessiné les premiers plans de la station orbitale'});
  else if(role === 'admin') badges.push({icon:'👑', label:'Fondateur', description:'Administrateur Planète Stream'});
  if(role === 'moderator') badges.push({icon:'🛡️', label:'Modérateur', description:'Aide à garder la salle propre'});
  if(stats.comments >= 1) badges.push({icon:'🎬', label:'Premier avis', description:'A publié au moins une critique'});
  if(stats.comments >= 5) badges.push({icon:'🍿', label:'Cinéphile actif', description:'A publié au moins 5 critiques'});
  if(stats.replies >= 3) badges.push({icon:'💬', label:'Conversateur', description:'Participe aux échanges'});
  if(stats.likes >= 5) badges.push({icon:'⭐', label:'Critique appréciée', description:'Ses avis reçoivent des likes'});
  if(stats.likes >= 25) badges.push({icon:'🏆', label:'Top critique', description:'Ses critiques sont très appréciées'});
  return badges.slice(0, 6);
}

function getInlineAuthorBadges(comment){
  const badges = [];
  const role = String(comment.role || 'viewer').toLowerCase();
  if(String(comment.badge || '').toLowerCase() === 'architecte' || String(comment.avatar || '').toLowerCase() === 'architecte' || (String(comment.author || comment.pseudo || comment.name || '').toLowerCase().trim() === 'spoofle' && role === 'admin')) badges.push('🛰️ Architecte');
  else if(role === 'admin') badges.push('👑 Fondateur');
  else if(role === 'moderator') badges.push('🛡️ Modérateur');
  if(currentViewer?.id && comment.viewer_uuid === currentViewer.id) badges.push('Vous');
  if(!comment.parent_id && Number(comment.rating) >= 9) badges.push('⭐ Coup de cœur');
  if(Number(comment.likes_count) >= 5) badges.push('❤️ Apprécié');
  return badges.slice(0, 2);
}

function truncateText(text='', limit=100){
  const clean = String(text || '').trim();
  if(clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

async function toggleCommentLike(commentId){
  const viewer = await ensureViewer({silent:true});
  if(!viewer){
    setStatus('Connecte-toi pour liker une critique.', 'error');
    showAuthRequiredNotice();
    return;
  }
  if(!commentId || String(commentId).startsWith('local-')) return;

  const wasLiked = likedCommentIds.has(commentId);
  const comment = currentComments.find(item => item.id === commentId);
  const currentCount = Number(comment?.likes_count) || 0;
  const optimisticCount = Math.max(0, currentCount + (wasLiked ? -1 : 1));

  setCommentLikeState(commentId, !wasLiked, optimisticCount);
  setStatus(wasLiked ? 'Retrait du like...' : 'Like envoyé...', 'pending');
  const likeButton = document.querySelector(`[data-like-comment="${cssEscape(commentId)}"]`);
  likeButton?.classList.remove('like-pop');
  void likeButton?.offsetWidth;
  likeButton?.classList.add('like-pop');

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

  // Le compteur visible vient de comment_likes. Pas besoin de modifier comments.likes_count côté client.

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
    button.innerHTML = `${liked ? '❤️' : '🤍'} <span>${safeCount}</span>${liked ? '<small>Aimé par vous</small>' : ''}`;
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

  const existing = card.querySelector(':scope > .reply-form');
  if(existing){
    existing.querySelector('textarea')?.focus();
    return;
  }

  const targetComment = (currentComments || []).find(comment => String(comment.id) === String(commentId));
  const targetName = targetComment?.name ? ` à ${targetComment.name}` : '';

  const form = document.createElement('form');
  form.className = 'reply-form';
  form.dataset.parentId = commentId;
  form.innerHTML = `
    <textarea maxlength="500" required placeholder="Répondre${escapeHtml(targetName)}..."></textarea>
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
  const viewer = currentViewer;
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
  const viewer = currentViewer;
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
    viewer_history: ['viewer_history'],
    movie_ratings: ['movie_ratings', 'ratings'],
    reports: ['reports'],
    notifications: ['notifications']
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
  if(window.PS?.authHeaders){
    return window.PS.authHeaders();
  }
  if(window.PSAuth?.authHeaders){
    return PSAuth.authHeaders();
  }
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
      auth_user_id: row.auth_user_id || null,
      name: viewer?.pseudo || row.display_name || readableUserName(row.user_id),
      avatar: viewer?.avatar || pickAvatar(row.display_name || row.user_id || 'Spectateur'),
      badge: String(viewer?.badge || 'none').toLowerCase(),
      role: viewer?.role || 'viewer',
      viewer_created_at: viewer?.created_at || null,
      viewer_banned_at: viewer?.banned_at || null,
      viewer_banned_until: viewer?.banned_until || null,
      rating: row.rating === null || row.rating === undefined ? null : Number(row.rating) || 0,
      text: row.comment || '',
      date: row.created_at,
      edited_at: row.edited_at || null,
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

function renderRatingBadge(rating=0){
  const value = Math.max(0, Math.min(10, Number(rating) || 0));
  return `<span class="comment-rating-badge"><span class="comment-stars">${renderStars(value)}</span><strong>${value}/10</strong></span>`;
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
  const list = Array.isArray(comments) ? comments : [];
  if(!list.length) return '';

  const repliesByParent = buildRepliesTree(list);
  const commentsById = buildCommentsIndex(list);

  const topLevel = list
    .filter(comment => !comment.parent_id)
    .map(comment => ({...comment, replies_count: countNestedReplies(comment.id, repliesByParent)}))
    .sort((a,b) => sortTopLevelComments(a,b));

  return topLevel.map((comment, index) => {
    const threadTone = index % 2 === 0 ? 'light' : 'dark';
    return renderCommentCard(comment, repliesByParent, commentsById, 0, null, {threadTone});
  }).join('');
}

function buildRepliesTree(list=[]){
  return list.reduce((map, comment) => {
    if(comment.parent_id){
      const key = String(comment.parent_id);
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(comment);
    }
    return map;
  }, new Map());
}

function buildCommentsIndex(list=[]){
  return list.reduce((map, comment) => {
    if(comment?.id) map.set(String(comment.id), comment);
    return map;
  }, new Map());
}

function countNestedReplies(commentId, repliesByParent){
  const replies = repliesByParent.get(String(commentId)) || [];
  return replies.reduce((total, reply) => total + 1 + countNestedReplies(reply.id, repliesByParent), 0);
}

function sortTopLevelComments(a,b){
  if(commentSortMode === 'popular') return (Number(b.likes_count)||0) - (Number(a.likes_count)||0) || dateScore(b.date) - dateScore(a.date);
  if(commentSortMode === 'rated') return (Number(b.rating)||0) - (Number(a.rating)||0) || dateScore(b.date) - dateScore(a.date);
  if(commentSortMode === 'replies') return (Number(b.replies_count)||0) - (Number(a.replies_count)||0) || dateScore(b.date) - dateScore(a.date);
  return dateScore(b.date) - dateScore(a.date);
}

function dateScore(date){
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function renderCommentCard(comment, repliesByParent=new Map(), commentsById=new Map(), depth=0, parentComment=null, options={}){
  const liked = likedCommentIds.has(comment.id);
  const isReply = Boolean(comment.parent_id);
  const visualDepth = Math.min(Number(depth) || 0, COMMENT_MAX_VISUAL_DEPTH);
  const parent = parentComment || commentsById.get(String(comment.parent_id || ''));
  const parentName = parent?.name || '';
  const owner = canManageComment(comment);
  const childReplies = (repliesByParent.get(String(comment.id)) || []).sort((a,b) => dateScore(a.date) - dateScore(b.date));
  const replyCount = countNestedReplies(comment.id, repliesByParent);
  const profileAttr = comment.viewer_uuid ? `data-profile-viewer="${escapeHtml(comment.viewer_uuid)}"` : '';
  const count = Number(comment.likes_count) || 0;
  const replyLabel = isReply ? 'Répondre à cette réponse' : 'Répondre';
  const flatMode = Boolean(options.flatMode);
  const threadTone = options.threadTone || 'light';
  const replyMarkup = (!flatMode && childReplies.length)
    ? `<div class="comment-replies is-flat-thread">${flattenThreadReplies(comment.id, repliesByParent, commentsById, depth + 1).map(item => renderCommentCard(item.comment, repliesByParent, commentsById, item.depth, item.parent, {flatMode:true, threadTone})).join('')}</div>`
    : '';

  return `
    <article class="comment-card thread-tone-${threadTone} ${isReply ? 'is-reply' : 'is-root-review'} depth-${visualDepth} ${depth >= COMMENT_MAX_VISUAL_DEPTH ? 'is-flat-depth' : ''}" id="comment-${escapeHtml(comment.id || '')}" data-comment-id="${escapeHtml(comment.id || '')}" data-depth="${visualDepth}" data-actual-depth="${Math.min(Number(depth) || 0, 20)}">
      <div class="comment-head community-head">
        <button class="comment-author profile-trigger" type="button" ${profileAttr} ${comment.viewer_uuid ? '' : 'disabled'}>
          ${PSAuth.avatarHtml(PSAuth.displayAvatar?.(comment) || comment.avatar || 'orbiteur', 'viewer-avatar')}
          <span class="comment-author-copy">
            <strong>${escapeHtml(comment.name)}</strong>
            <small>${formatCommentDate(comment.date)}${comment.edited_at ? ' · modifié' : ''}</small>
            ${getInlineAuthorBadges(comment).length ? `<span class="comment-inline-badges">${getInlineAuthorBadges(comment).map(badge => `<em>${escapeHtml(badge)}</em>`).join('')}</span>` : ''}
          </span>
        </button>
        ${comment.rating ? renderRatingBadge(comment.rating) : '<span class="comment-reply-pill">💬 Réponse</span>'}
      </div>
      ${isReply && parentName ? `<div class="reply-target">↳ Réponse à <strong>@${escapeHtml(parentName)}</strong></div>` : ''}
      <p>${escapeHtml(comment.text)}</p>
      <div class="comment-actions">
        <button class="comment-action like-action ${liked ? 'is-active' : ''}" type="button" data-like-comment="${escapeHtml(comment.id || '')}">${liked ? '❤️' : '🤍'} <span>${count}</span>${liked ? '<small>Aimé par vous</small>' : ''}</button>
        <button class="comment-action" type="button" data-reply-comment="${escapeHtml(comment.id || '')}">💬 ${replyLabel}${replyCount ? ` · ${replyCount}` : ''}</button>
        ${canReportComment(comment) ? `<button class="comment-action report-action" type="button" data-report-comment="${escapeHtml(comment.id || '')}">🚩 Signaler</button>` : ''}
        ${owner ? `<button class="comment-action" type="button" data-edit-comment="${escapeHtml(comment.id || '')}">✏ Modifier</button><button class="comment-action danger" type="button" data-delete-comment="${escapeHtml(comment.id || '')}">🗑 Supprimer</button>` : ''}
      </div>
      ${replyMarkup}
    </article>
  `;
}

function flattenThreadReplies(parentId, repliesByParent=new Map(), commentsById=new Map(), depth=1){
  // V2.5.6 : la base conserve l'arborescence complète, mais l'affichage reste plat
  // dans un même fil sous la critique principale. Cela évite l'effet escalier lorsqu'une
  // discussion part en ping-pong sur une sous-réponse.
  const collected = [];

  function walk(sourceId, currentDepth){
    const children = (repliesByParent.get(String(sourceId)) || []).sort((a,b) => dateScore(a.date) - dateScore(b.date));
    children.forEach(child => {
      const parent = commentsById.get(String(child.parent_id || '')) || null;
      collected.push({
        comment: child,
        parent,
        depth: Math.min(Number(currentDepth) || 1, COMMENT_MAX_VISUAL_DEPTH)
      });
      walk(child.id, currentDepth + 1);
    });
  }

  walk(parentId, depth);

  return collected.sort((a,b) => dateScore(a.comment?.date) - dateScore(b.comment?.date));
}

function getDemoComments(){
  return [
    {id:'demo-comment', name:'Planète Stream', avatar:'orbiteur', rating:8, text:'La zone de critiques est prête. Les vrais avis prendront la place de ce message dès qu’un spectateur publiera sa critique.', date:new Date().toISOString(), likes_count:0}
  ];
}

function createRelatedCard(item){
  return `
    <article class="card">
      <a class="poster poster-link" href="watch.html?slug=${encodeURIComponent(item.slug)}" data-title="${escapeHtml(item.title)}" style="background-image:url('${item.poster || ''}')" aria-label="Lire ${escapeHtml(item.title)}"></a>
      <div class="info">
        <div class="compact-meta" aria-label="Informations ${escapeHtml(item.title)}">
          <span>${escapeHtml(formatType(item.type || 'film'))}</span>
          ${item.year ? `<span>${escapeHtml(String(item.year))}</span>` : ''}
        </div>
        <div class="compact-genres">
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


async function startRealtimeComments(item){
  if(!item?.slug || !SUPABASE_ENABLED) return false;
  if(!window.supabase?.createClient) return false;
  if(realtimeCommentsChannel && realtimeCommentsMovieId === item.slug) return true;

  await stopRealtimeComments();
  realtimeCommentsMovieId = item.slug;

  try{
    const token = window.PSAuth?.getAccessToken?.() || window.PS?.state?.accessToken || SUPABASE_KEY;
    realtimeCommentsClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      global:{headers:{Authorization:`Bearer ${token || SUPABASE_KEY}`}},
      realtime:{params:{eventsPerSecond:8}}
    });

    const table = await resolveTable('comments') || 'comments';
    realtimeCommentsChannel = realtimeCommentsClient
      .channel(`ps-comments-${item.slug}`)
      .on('postgres_changes', {
        event:'*',
        schema:'public',
        table,
        filter:`movie_id=eq.${item.slug}`
      }, payload => {
        scheduleRealtimeCommentsRefresh(payload);
      })
      .subscribe(status => {
        if(status === 'SUBSCRIBED'){
          setStatus('Temps réel activé pour cette salle. Les échanges arrivent sans F5.', 'ok');
          if(communityPollTimer){
            clearInterval(communityPollTimer);
            communityPollTimer = null;
            startCommunityPolling(item);
          }
        }
      });
    return true;
  }catch(error){
    console.warn('Realtime comments indisponible, polling conservé.', error);
    realtimeCommentsChannel = null;
    realtimeCommentsClient = null;
    realtimeCommentsMovieId = '';
    return false;
  }
}

async function stopRealtimeComments(){
  if(realtimeCommentsRefreshTimer){
    clearTimeout(realtimeCommentsRefreshTimer);
    realtimeCommentsRefreshTimer = null;
  }
  if(realtimeCommentsChannel && realtimeCommentsClient){
    try{ await realtimeCommentsClient.removeChannel(realtimeCommentsChannel); }
    catch(error){ console.warn('Realtime comments remove warning', error); }
  }
  realtimeCommentsChannel = null;
  realtimeCommentsClient = null;
  realtimeCommentsMovieId = '';
}

function scheduleRealtimeCommentsRefresh(payload){
  if(!currentItem?.slug) return;
  if(realtimeCommentsRefreshTimer) clearTimeout(realtimeCommentsRefreshTimer);
  realtimeCommentsRefreshTimer = setTimeout(async () => {
    realtimeCommentsRefreshTimer = null;
    await applyRealtimeCommentsUpdate(payload);
  }, 180);
}

async function applyRealtimeCommentsUpdate(payload){
  if(!currentItem?.slug || communityPollBusy) return;
  communityPollBusy = true;
  try{
    const comments = await fetchComments(currentItem.slug);
    if(!comments.online) return;
    const signature = commentsSignature(comments.data);
    if(signature === communityPollSignature) return;

    currentComments = comments.data;
    communityPollSignature = signature;
    if(currentViewer?.id){
      likedCommentIds = await fetchLikedCommentIds(currentViewer.id, currentComments.map(comment => comment.id).filter(Boolean));
    }

    updateCommunityRatingLabel(currentComments, {online:false, data:null}, currentRatings);
    const moodLine = document.querySelector('#moodLine');
    if(moodLine) moodLine.textContent = getMoodLine(currentItem, currentComments);

    if(shouldDeferCommunityRefresh()){
      showNewCommentsNotice();
      setStatus('Nouveaux échanges détectés. Ils attendent sagement que tu finisses ta saisie.', 'ok');
    }else{
      updateCommentsListWithoutJump();
      flashRealtimeComment(payload);
      setStatus('Conversation mise à jour en temps réel.', 'ok');
    }
  }catch(error){
    console.warn('Realtime comments refresh error', error);
  }finally{
    communityPollBusy = false;
  }
}

function showNewCommentsNotice(){
  const section = document.querySelector('.comments-section');
  if(!section) return;
  let notice = section.querySelector('[data-realtime-comments-notice]');
  if(!notice){
    notice = document.createElement('button');
    notice.type = 'button';
    notice.className = 'realtime-comments-notice';
    notice.dataset.realtimeCommentsNotice = 'true';
    notice.addEventListener('click', () => {
      notice.remove();
      updateCommentsListWithoutJump();
      setStatus('Conversation synchronisée.', 'ok');
    });
    const list = section.querySelector('#commentsList');
    section.insertBefore(notice, list || null);
  }
  notice.textContent = '💬 Nouveaux échanges disponibles · Afficher';
}

function flashRealtimeComment(payload){
  const id = payload?.new?.id || payload?.old?.id;
  if(!id) return;
  const card = document.querySelector(`[data-comment-id="${cssEscape(String(id))}"]`);
  if(!card) return;
  card.classList.add('is-realtime-new');
  setTimeout(() => card.classList.remove('is-realtime-new'), 1800);
}


async function startRealtimeLikes(item){
  if(!item?.slug || !SUPABASE_ENABLED) return false;
  if(!window.supabase?.createClient) return false;
  if(realtimeLikesChannel && realtimeLikesMovieId === item.slug) return true;

  await stopRealtimeLikes();
  realtimeLikesMovieId = item.slug;

  try{
    const token = window.PSAuth?.getAccessToken?.() || window.PS?.state?.accessToken || SUPABASE_KEY;
    realtimeLikesClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      global:{headers:{Authorization:`Bearer ${token || SUPABASE_KEY}`}},
      realtime:{params:{eventsPerSecond:8}}
    });

    const table = await resolveTable('comment_likes') || 'comment_likes';
    realtimeLikesChannel = realtimeLikesClient
      .channel(`ps-comment-likes-${item.slug}`)
      .on('postgres_changes', {
        event:'*',
        schema:'public',
        table
      }, payload => {
        scheduleRealtimeLikeRefresh(payload);
      })
      .subscribe(status => {
        if(status === 'SUBSCRIBED'){
          console.info('Planète Stream realtime likes actif. Les petits cœurs battent en direct.');
        }
      });
    return true;
  }catch(error){
    console.warn('Realtime likes indisponible, les compteurs restent mis à jour au prochain refresh.', error);
    realtimeLikesChannel = null;
    realtimeLikesClient = null;
    realtimeLikesMovieId = '';
    return false;
  }
}

async function stopRealtimeLikes(){
  for(const timer of realtimeLikesRefreshTimers.values()) clearTimeout(timer);
  realtimeLikesRefreshTimers.clear();
  if(realtimeLikesChannel && realtimeLikesClient){
    try{ await realtimeLikesClient.removeChannel(realtimeLikesChannel); }
    catch(error){ console.warn('Realtime likes remove warning', error); }
  }
  realtimeLikesChannel = null;
  realtimeLikesClient = null;
  realtimeLikesMovieId = '';
}

function scheduleRealtimeLikeRefresh(payload){
  const commentId = payload?.new?.comment_id || payload?.old?.comment_id;
  if(!commentId) return;
  if(!currentComments.some(comment => String(comment.id) === String(commentId))) return;

  const key = String(commentId);
  if(realtimeLikesRefreshTimers.has(key)) clearTimeout(realtimeLikesRefreshTimers.get(key));
  const timer = setTimeout(async () => {
    realtimeLikesRefreshTimers.delete(key);
    await applyRealtimeLikeUpdate(key, payload);
  }, 120);
  realtimeLikesRefreshTimers.set(key, timer);
}

async function applyRealtimeLikeUpdate(commentId, payload){
  if(!commentId || !currentComments.some(comment => String(comment.id) === String(commentId))) return;
  try{
    const exactCount = await fetchSingleCommentLikeCount(commentId);
    const currentLiked = currentViewer?.id
      ? (await fetchLikedCommentIds(currentViewer.id, [commentId])).has(commentId)
      : likedCommentIds.has(commentId);

    const currentComment = currentComments.find(comment => String(comment.id) === String(commentId));
    const previousCount = Number(currentComment?.likes_count) || 0;
    const finalCount = exactCount === null ? previousCount : exactCount;

    setCommentLikeState(commentId, currentLiked, finalCount);
    pulseLikeButton(commentId);

    if(finalCount !== previousCount){
      setStatus(finalCount > previousCount ? 'Un cœur vient de s’allumer dans la salle.' : 'Un like a été retiré.', 'ok');
    }
  }catch(error){
    console.warn('Realtime like update error', error);
  }
}

function pulseLikeButton(commentId){
  const button = document.querySelector(`[data-like-comment="${cssEscape(commentId)}"]`);
  if(!button) return;
  button.classList.remove('like-pop');
  void button.offsetWidth;
  button.classList.add('like-pop');
}


async function startRealtimeRatings(item){
  if(!item?.slug || !SUPABASE_ENABLED) return false;
  if(!window.supabase?.createClient) return false;
  if(realtimeRatingsChannel && realtimeRatingsMovieId === item.slug) return true;

  await stopRealtimeRatings();
  realtimeRatingsMovieId = item.slug;

  try{
    const token = window.PSAuth?.getAccessToken?.() || window.PS?.state?.accessToken || SUPABASE_KEY;
    realtimeRatingsClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      global:{headers:{Authorization:`Bearer ${token || SUPABASE_KEY}`}},
      realtime:{params:{eventsPerSecond:8}}
    });

    const table = await resolveTable('movie_ratings') || 'movie_ratings';
    realtimeRatingsChannel = realtimeRatingsClient
      .channel(`ps-movie-ratings-${item.slug}`)
      .on('postgres_changes', {
        event:'INSERT',
        schema:'public',
        table,
        filter:`movie_id=eq.${item.slug}`
      }, payload => {
        scheduleRealtimeRatingRefresh(payload);
      })
      .on('postgres_changes', {
        event:'UPDATE',
        schema:'public',
        table,
        filter:`movie_id=eq.${item.slug}`
      }, payload => {
        scheduleRealtimeRatingRefresh(payload);
      })
      .on('postgres_changes', {
        event:'DELETE',
        schema:'public',
        table
      }, payload => {
        const deletedMovieId = payload?.old?.movie_id;
        // Sur DELETE, Supabase ne fournit parfois que la clé primaire selon la config
        // Postgres. Dans ce cas, on rafraîchit quand même la fiche ouverte : c'est léger
        // et cela évite une note fantôme après suppression d'une critique.
        if(!deletedMovieId || deletedMovieId === item.slug){
          scheduleRealtimeRatingRefresh(payload);
        }
      })
      .subscribe(status => {
        if(status === 'SUBSCRIBED'){
          console.info('Planète Stream realtime ratings actif. Les étoiles se recalculent en direct.');
        }
      });
    return true;
  }catch(error){
    console.warn('Realtime ratings indisponible, les moyennes restent mises à jour au prochain refresh.', error);
    realtimeRatingsChannel = null;
    realtimeRatingsClient = null;
    realtimeRatingsMovieId = '';
    return false;
  }
}

async function stopRealtimeRatings(){
  if(realtimeRatingsRefreshTimer){
    clearTimeout(realtimeRatingsRefreshTimer);
    realtimeRatingsRefreshTimer = null;
  }
  if(realtimeRatingsChannel && realtimeRatingsClient){
    try{ await realtimeRatingsClient.removeChannel(realtimeRatingsChannel); }
    catch(error){ console.warn('Realtime ratings remove warning', error); }
  }
  realtimeRatingsChannel = null;
  realtimeRatingsClient = null;
  realtimeRatingsMovieId = '';
}

function scheduleRealtimeRatingRefresh(payload){
  if(!currentItem?.slug) return;
  if(realtimeRatingsRefreshTimer) clearTimeout(realtimeRatingsRefreshTimer);
  realtimeRatingsRefreshTimer = setTimeout(async () => {
    realtimeRatingsRefreshTimer = null;
    await applyRealtimeRatingUpdate(payload);
  }, 160);
}

async function applyRealtimeRatingUpdate(payload){
  if(!currentItem?.slug) return;
  try{
    const previousSignature = ratingsSignature(currentRatings);
    const [ratings, stats] = await Promise.all([
      fetchMovieRatings(currentItem.slug),
      fetchMovieStats(currentItem.slug)
    ]);

    if(ratings.online){
      currentRatings = ratings.data;
      currentUserRating = getCurrentViewerRating(currentRatings);
      syncQuickRatingSelect();
    }

    updateCommunityRatingLabel(currentComments, stats, currentRatings);

    const nextSignature = ratingsSignature(currentRatings);
    if(nextSignature !== previousSignature){
      pulseCommunityRatingLabel();
      setStatus('La note Planète Stream vient de bouger en temps réel.', 'ok');
    }
  }catch(error){
    console.warn('Realtime rating update error', error);
  }
}

function ratingsSignature(ratings=[]){
  return (ratings || [])
    .map(row => [row.movie_id || currentItem?.slug || '', row.viewer_id || row.auth_user_id || '', Number(row.rating) || 0, row.updated_at || ''].join(':'))
    .sort()
    .join('|');
}

function syncQuickRatingSelect(){
  const select = document.querySelector('#quickRating');
  if(!select) return;
  const active = document.activeElement;
  if(active === select) return;
  select.value = currentUserRating ? String(currentUserRating) : '';
}

function pulseCommunityRatingLabel(){
  const label = document.querySelector('#communityRatingLabel');
  if(!label) return;
  label.classList.remove('rating-pop');
  void label.offsetWidth;
  label.classList.add('rating-pop');
}

function startCommunityPolling(item){
  if(communityPollTimer){
    clearInterval(communityPollTimer);
    communityPollTimer = null;
  }
  if(!item?.slug || !SUPABASE_ENABLED) return;

  communityPollSignature = commentsSignature(currentComments);
  communityPollTimer = setInterval(async () => {
    if(communityPollBusy || !currentItem?.slug) return;
    communityPollBusy = true;
    try{
      const comments = await fetchComments(currentItem.slug);
      if(comments.online){
        const signature = commentsSignature(comments.data);
        if(signature !== communityPollSignature){
          const shouldDefer = shouldDeferCommunityRefresh();
          currentComments = comments.data;
          communityPollSignature = signature;
          if(currentViewer?.id){
            likedCommentIds = await fetchLikedCommentIds(currentViewer.id, currentComments.map(comment => comment.id).filter(Boolean));
          }

          if(shouldDefer){
            setStatus('Nouveaux échanges détectés. Synchronisation en pause pendant ta saisie.', 'ok');
          }else{
            updateCommentsListWithoutJump();
            setStatus('Conversation synchronisée. Les nouveaux avis arrivent sans lever le petit doigt.', 'ok');
          }
        }
      }
    }finally{
      communityPollBusy = false;
    }
  }, realtimeCommentsChannel ? 45000 : 12000);
}

function shouldDeferCommunityRefresh(){
  const active = document.activeElement;
  const commentsSection = document.querySelector('.comments-section');
  if(reviewFormDirty) return true;
  if(document.querySelector('.reply-form')) return true;
  if(active && commentsSection?.contains(active) && ['TEXTAREA','INPUT','SELECT'].includes(active.tagName)) return true;
  return false;
}

function updateCommentsListWithoutJump(){
  const list = document.querySelector('#commentsList');
  if(!list) return;

  const active = document.activeElement;
  const activeId = active?.id || '';
  const activeComment = active?.closest?.('[data-comment-id]')?.dataset?.commentId || '';
  const beforeTop = list.getBoundingClientRect().top;
  const scrollY = window.scrollY;

  list.innerHTML = renderComments(currentComments);

  const afterTop = list.getBoundingClientRect().top;
  const delta = afterTop - beforeTop;
  if(Math.abs(delta) > 1) window.scrollTo({top:scrollY + delta, left:window.scrollX, behavior:'auto'});

  if(activeId){
    document.getElementById(activeId)?.focus?.({preventScroll:true});
  }else if(activeComment){
    document.querySelector(`[data-comment-id="${cssEscape(activeComment)}"]`)?.focus?.({preventScroll:true});
  }
}

function commentsSignature(comments=[]){
  return (comments || [])
    .map(comment => [comment.id, comment.parent_id || '', comment.text, comment.likes_count || 0, comment.edited_at || '', comment.date || ''].join(':'))
    .sort()
    .join('|');
}

window.addEventListener('beforeunload', () => {
  if(communityPollTimer) clearInterval(communityPollTimer);
  stopRealtimeComments();
  stopRealtimeLikes();
});


function scrollToCommentFromHash(){
  const hash = decodeURIComponent(window.location.hash || '');
  if(!hash || !hash.startsWith('#comment-')) return;
  const target = document.querySelector(hash);
  if(!target) return;
  setTimeout(() => {
    target.classList.add('is-highlighted');
    target.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(() => target.classList.remove('is-highlighted'), 2600);
  }, 120);
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

  const diff = Date.now() - parsed.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if(diff < minute) return 'À l’instant';
  if(diff < hour){
    const value = Math.max(1, Math.floor(diff / minute));
    return `Il y a ${value} minute${value > 1 ? 's' : ''}`;
  }
  if(diff < day){
    const value = Math.max(1, Math.floor(diff / hour));
    return `Il y a ${value} heure${value > 1 ? 's' : ''}`;
  }
  if(diff < 2 * day) return 'Hier';
  if(diff < 7 * day){
    const value = Math.max(2, Math.floor(diff / day));
    return `Il y a ${value} jours`;
  }
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

function escapeAttr(str=''){
  return escapeHtml(str);
}

initWatch();
