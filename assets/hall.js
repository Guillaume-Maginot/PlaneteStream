/* Planète Stream v2.3 · Hall du Cinéma
   Module autonome branché sur window.PS : lit l'activité communautaire et transforme
   critiques, réponses, likes et nouveaux membres en contenu vivant sur l'accueil.
*/
(function initCinemaHallModule(){
  const root = document.querySelector('#hall-cinema');
  if(!root) return;

  const state = {
    catalogue: [],
    comments: [],
    viewers: [],
    likes: [],
    viewerMap: new Map(),
    movieMap: new Map(),
    busy:false,
    timer:null
  };

  const qs = selector => root.querySelector(selector);
  const escape = value => window.PS?.escapeHtml ? window.PS.escapeHtml(value || '') : String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  async function boot(){
    if(window.PS?.ready) await window.PS.ready;
    await loadHall();
    state.timer = setInterval(loadHall, 30000);
  }

  async function loadHall(){
    if(state.busy) return;
    state.busy = true;
    try{
      const cataloguePromise = state.catalogue.length ? Promise.resolve(state.catalogue) : fetch('data/catalogue.json').then(r => r.json());
      const [catalogue, commentsResult, viewersResult, likesResult] = await Promise.all([
        cataloguePromise,
        select('comments', 'select=id,movie_id,viewer_uuid,parent_id,comment,rating,created_at,edited_at,likes_count&order=created_at.desc&limit=220'),
        select('viewers', 'select=id,pseudo,avatar,role,created_at,last_seen&order=created_at.desc&limit=80'),
        select('comment_likes', 'select=comment_id,viewer_id,created_at&order=created_at.desc&limit=360')
      ]);

      state.catalogue = Array.isArray(catalogue) ? catalogue : [];
      state.comments = Array.isArray(commentsResult.data) ? commentsResult.data : [];
      state.viewers = Array.isArray(viewersResult.data) ? viewersResult.data : [];
      state.likes = Array.isArray(likesResult.data) ? likesResult.data : [];
      state.viewerMap = new Map(state.viewers.map(v => [v.id, v]));
      state.movieMap = new Map(state.catalogue.map(movie => [movie.slug, movie]));

      renderHall();
    }catch(error){
      console.error('Hall du Cinéma error', error);
      renderError();
    }finally{
      state.busy = false;
    }
  }

  async function select(table, query){
    if(window.PS?.restSelect) return window.PS.restSelect(table, query, {auth:false});
    return {ok:false, data:null};
  }

  function renderHall(){
    renderStats();
    renderHotDiscussions();
    renderPopularReview();
    renderWelcome();
    renderActiveMembers();
    renderTimeline();
    renderDivisiveMovies();
    const updated = qs('#hallUpdatedAt');
    if(updated) updated.textContent = `Mis à jour ${relativeDate(new Date().toISOString())}`;
  }

  function renderStats(){
    const today = isRecent(24);
    const commentsToday = roots().filter(c => today(c.created_at)).length;
    const repliesToday = replies().filter(c => today(c.created_at)).length;
    const likesToday = state.likes.filter(l => today(l.created_at)).length;
    const viewersToday = state.viewers.filter(v => today(v.created_at)).length;

    const el = qs('#hallStats');
    if(!el) return;
    el.innerHTML = [
      [commentsToday, 'critiques aujourd’hui'],
      [repliesToday, 'réponses'],
      [likesToday, 'likes'],
      [viewersToday, 'nouveaux membres']
    ].map(([value, label]) => `<span><strong>${escape(value)}</strong><small>${escape(label)}</small></span>`).join('');
  }

  function renderHotDiscussions(){
    const container = qs('#hallHotDiscussions');
    if(!container) return;
    const grouped = new Map();
    for(const comment of state.comments){
      const movie = state.movieMap.get(comment.movie_id);
      if(!movie) continue;
      if(!grouped.has(comment.movie_id)) grouped.set(comment.movie_id, {movie, roots:0, replies:0, latest:comment.created_at, likes:0});
      const entry = grouped.get(comment.movie_id);
      if(comment.parent_id) entry.replies += 1;
      else entry.roots += 1;
      entry.latest = newer(entry.latest, comment.created_at);
      entry.likes += likeCount(comment.id);
    }

    const items = [...grouped.values()]
      .map(item => ({...item, score:item.replies * 3 + item.roots * 2 + item.likes + recentBonus(item.latest)}))
      .sort((a,b) => b.score - a.score)
      .slice(0,3);

    container.innerHTML = `<h3>🔥 Discussions du moment</h3>${items.length ? items.map(item => `
      <a class="hall-mini-row" href="watch.html?slug=${encodeURIComponent(item.movie.slug)}">
        <span class="hall-poster-dot" style="${posterStyle(item.movie)}"></span>
        <span><strong>${escape(item.movie.title)}</strong><small>${item.replies} réponse${item.replies > 1 ? 's' : ''} · ${relativeDate(item.latest)}</small></span>
        <em>Voir</em>
      </a>
    `).join('') : empty('Aucune discussion pour l’instant. Le hall attend son premier débat au sabre laser.')}`;
  }

  function renderPopularReview(){
    const container = qs('#hallPopularReview');
    if(!container) return;
    const item = roots()
      .map(comment => ({comment, likes:likeCount(comment.id), movie:state.movieMap.get(comment.movie_id), viewer:state.viewerMap.get(comment.viewer_uuid)}))
      .filter(entry => entry.movie)
      .sort((a,b) => b.likes - a.likes || new Date(b.comment.created_at) - new Date(a.comment.created_at))[0];

    if(!item){
      container.innerHTML = `<h3>❤️ Critique populaire</h3>${empty('Pas encore de critique populaire. Les projecteurs patientent.')}`;
      return;
    }

    container.innerHTML = `
      <h3>❤️ Critique populaire</h3>
      <a class="hall-feature-review" href="watch.html?slug=${encodeURIComponent(item.movie.slug)}#comment-${encodeURIComponent(item.comment.id)}">
        <span class="viewer-avatar">${escape(item.viewer?.avatar || '🍿')}</span>
        <strong>${escape(item.viewer?.pseudo || 'Spectateur')}</strong>
        <small>sur ${escape(item.movie.title)}</small>
        <p>${escape(shorten(item.comment.comment, 150))}</p>
        <em>❤️ ${item.likes} · ${item.comment.rating ? `${item.comment.rating}/10` : 'réponse'}</em>
      </a>
    `;
  }

  function renderWelcome(){
    const container = qs('#hallWelcome');
    if(!container) return;
    const latest = state.viewers[0];
    if(!latest){
      container.innerHTML = `<h3>🆕 Bienvenue</h3>${empty('Aucun Planétien recensé pour le moment.')}`;
      return;
    }
    const stats = viewerStats(latest.id);
    container.innerHTML = `
      <h3>🆕 Bienvenue</h3>
      <div class="hall-welcome-card">
        <span class="viewer-avatar big">${escape(latest.avatar || '🪐')}</span>
        <strong>${escape(latest.pseudo || 'Nouveau membre')}</strong>
        <small>${relativeDate(latest.created_at)}</small>
        <p>${stats.roots ? 'Premier avis publié, entrée réussie dans l’orbite.' : 'Nouveau Planétien arrivé dans le hall.'}</p>
      </div>
    `;
  }

  function renderActiveMembers(){
    const container = qs('#hallActiveMembers');
    if(!container) return;
    const rows = state.viewers
      .map(viewer => ({viewer, stats:viewerStats(viewer.id)}))
      .map(row => ({...row, score:row.stats.roots * 4 + row.stats.replies * 2 + row.stats.likesReceived}))
      .filter(row => row.score > 0)
      .sort((a,b) => b.score - a.score)
      .slice(0,4);

    container.innerHTML = `<h3>🏆 Membres actifs</h3>${rows.length ? rows.map((row, index) => `
      <div class="hall-member-row">
        <span>${['🥇','🥈','🥉','⭐'][index] || '⭐'}</span>
        <strong>${escape(row.viewer.avatar || '🍿')} ${escape(row.viewer.pseudo)}</strong>
        <small>${row.stats.roots} critique${row.stats.roots > 1 ? 's' : ''} · ${row.stats.likesReceived} like${row.stats.likesReceived > 1 ? 's' : ''}</small>
      </div>
    `).join('') : empty('Les membres actifs s’échauffent encore en coulisses.')}`;
  }

  function renderTimeline(){
    const container = qs('#hallTimeline');
    if(!container) return;
    const events = [];

    state.comments.slice(0,40).forEach(comment => {
      const viewer = state.viewerMap.get(comment.viewer_uuid);
      const movie = state.movieMap.get(comment.movie_id);
      if(!movie) return;
      events.push({
        at:comment.created_at,
        icon:comment.parent_id ? '💬' : '🎬',
        title:comment.parent_id ? `${viewerName(viewer)} a répondu sur ${movie.title}` : `${viewerName(viewer)} a publié une critique`,
        text:comment.parent_id ? shorten(comment.comment, 120) : `${movie.title} · ${comment.rating || '—'}/10`,
        href:`watch.html?slug=${encodeURIComponent(movie.slug)}#comment-${encodeURIComponent(comment.id)}`
      });
    });

    state.viewers.slice(0,12).forEach(viewer => {
      events.push({
        at:viewer.created_at,
        icon:'🆕',
        title:`${viewerName(viewer)} a rejoint les Planétiens`,
        text:'Un nouveau siège vient de s’allumer dans la salle.',
        href:'account.html'
      });
    });

    events.sort((a,b) => new Date(b.at) - new Date(a.at));
    container.innerHTML = events.slice(0,7).map(event => `
      <a class="hall-event" href="${escape(event.href)}">
        <span>${escape(event.icon)}</span>
        <div><strong>${escape(event.title)}</strong><small>${escape(event.text)}</small><em>${relativeDate(event.at)}</em></div>
      </a>
    `).join('') || empty('Rien à signaler. Même les popcorns font silence.');
  }

  function renderDivisiveMovies(){
    const container = qs('#hallDivisiveMovies');
    if(!container) return;
    const rows = [];
    for(const movie of state.catalogue){
      const movieRoots = roots().filter(c => c.movie_id === movie.slug && Number(c.rating));
      const unique = uniqueViewerRatings(movieRoots);
      if(unique.length < 1) continue;
      const psRating = average(unique);
      const tmdbRating = Number(movie.rating || 0);
      const gap = tmdbRating ? Math.abs(psRating - tmdbRating) : 0;
      rows.push({movie, psRating, tmdbRating, gap, comments:movieRoots.length, likes:movieRoots.reduce((sum,c) => sum + likeCount(c.id), 0)});
    }

    const items = rows.sort((a,b) => b.gap - a.gap || b.comments - a.comments).slice(0,3);
    container.innerHTML = `<h3>🎭 Films qui divisent</h3>${items.length ? items.map(item => `
      <a class="hall-mini-row" href="watch.html?slug=${encodeURIComponent(item.movie.slug)}">
        <span class="hall-poster-dot" style="${posterStyle(item.movie)}"></span>
        <span><strong>${escape(item.movie.title)}</strong><small>TMDb ${item.tmdbRating ? item.tmdbRating.toFixed(1) : '—'} · PS ${item.psRating.toFixed(1)} · écart ${item.gap.toFixed(1)}</small></span>
        <em>🎭</em>
      </a>
    `).join('') : empty('Pas encore assez de votes pour provoquer un débat élégant.')}`;
  }

  function renderError(){
    ['#hallHotDiscussions','#hallPopularReview','#hallWelcome','#hallActiveMembers','#hallTimeline','#hallDivisiveMovies'].forEach(selector => {
      const el = qs(selector);
      if(el) el.innerHTML = empty('Impossible de charger le Hall pour le moment.');
    });
  }

  function roots(){ return state.comments.filter(comment => !comment.parent_id); }
  function replies(){ return state.comments.filter(comment => comment.parent_id); }

  function viewerStats(viewerId){
    const own = state.comments.filter(comment => comment.viewer_uuid === viewerId);
    const ids = new Set(own.map(comment => comment.id));
    return {
      roots: own.filter(comment => !comment.parent_id).length,
      replies: own.filter(comment => comment.parent_id).length,
      likesReceived: state.likes.filter(like => ids.has(like.comment_id)).length
    };
  }

  function likeCount(commentId){
    return state.likes.filter(like => like.comment_id === commentId).length;
  }

  function uniqueViewerRatings(comments){
    const latest = new Map();
    comments.forEach(comment => {
      if(!comment.viewer_uuid || !Number(comment.rating)) return;
      const current = latest.get(comment.viewer_uuid);
      if(!current || new Date(comment.created_at) > new Date(current.created_at)) latest.set(comment.viewer_uuid, comment);
    });
    return [...latest.values()].map(comment => Number(comment.rating));
  }

  function average(values){
    return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  }

  function viewerName(viewer){
    return viewer?.pseudo || 'Un Planétien';
  }

  function posterStyle(movie){
    const image = movie?.poster || movie?.backdrop || '';
    return image ? `background-image:url('${escapeAttr(image)}')` : '';
  }

  function escapeAttr(str=''){
    return String(str).replace(/[\\'"()]/g, '');
  }

  function shorten(text='', max=120){
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  function newer(a, b){
    return new Date(a || 0) > new Date(b || 0) ? a : b;
  }

  function recentBonus(date){
    const hours = (Date.now() - new Date(date || 0).getTime()) / 36e5;
    if(hours < 1) return 20;
    if(hours < 6) return 12;
    if(hours < 24) return 7;
    if(hours < 72) return 3;
    return 0;
  }

  function isRecent(hours){
    return date => date && (Date.now() - new Date(date).getTime()) <= hours * 36e5;
  }

  function relativeDate(value){
    if(!value) return 'à l’instant';
    const diff = Date.now() - new Date(value).getTime();
    if(!Number.isFinite(diff)) return 'à l’instant';
    const minute = 60000;
    const hour = minute * 60;
    const day = hour * 24;
    if(diff < minute) return 'à l’instant';
    if(diff < hour) return `il y a ${Math.floor(diff / minute)} min`;
    if(diff < day) return `il y a ${Math.floor(diff / hour)} h`;
    if(diff < day * 2) return 'hier';
    if(diff < day * 7) return `il y a ${Math.floor(diff / day)} j`;
    return new Intl.DateTimeFormat('fr-FR', {day:'2-digit', month:'short', year:'numeric'}).format(new Date(value));
  }

  function empty(text){
    return `<p class="hall-muted">${escape(text)}</p>`;
  }

  document.addEventListener('visibilitychange', () => {
    if(document.hidden) clearInterval(state.timer);
    else{
      loadHall();
      state.timer = setInterval(loadHall, 30000);
    }
  });

  boot();
})();
