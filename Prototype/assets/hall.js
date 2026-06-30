/* Planète Stream v2.9.5 · Hall du Cinéma Realtime
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
    ratings: [],
    viewerMap: new Map(),
    movieMap: new Map(),
    busy:false,
    timer:null,
    realtimeClient:null,
    realtimeChannel:null,
    realtimeTimer:null,
    realtimeActive:false
  };

  const qs = selector => root.querySelector(selector);
  const escape = value => window.PS?.escapeHtml ? window.PS.escapeHtml(value == null ? '' : value) : String(value == null ? '' : value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  async function boot(){
    if(window.PS?.ready) await window.PS.ready;
    await loadHall();
    startRealtimeHall();
    state.timer = setInterval(loadHall, 90000);
  }

  async function loadHall(){
    if(state.busy) return;
    state.busy = true;
    try{
      const cataloguePromise = state.catalogue.length ? Promise.resolve(state.catalogue) : fetch('data/catalogue.json').then(r => r.json());
      const [catalogue, commentsResult, viewersResult, likesResult, ratingsResult] = await Promise.all([
        cataloguePromise,
        select('comments', 'select=id,movie_id,viewer_uuid,parent_id,comment,rating,created_at,edited_at,likes_count&order=created_at.desc&limit=220'),
        select('viewers', 'select=id,pseudo,avatar,badge,role,created_at,last_seen&order=created_at.desc&limit=80'),
        select('comment_likes', 'select=comment_id,viewer_id,created_at&order=created_at.desc&limit=360'),
        select('movie_ratings', 'select=viewer_id,movie_id,rating,created_at,updated_at&order=updated_at.desc&limit=600')
      ]);

      state.catalogue = Array.isArray(catalogue) ? catalogue : [];
      state.comments = Array.isArray(commentsResult.data) ? commentsResult.data : [];
      state.viewers = Array.isArray(viewersResult.data) ? viewersResult.data : [];
      state.likes = Array.isArray(likesResult.data) ? likesResult.data : [];
      state.ratings = Array.isArray(ratingsResult.data) ? ratingsResult.data : [];
      state.viewerMap = new Map(state.viewers.map(v => [v.id, v]));
      state.movieMap = new Map(state.catalogue.map(movie => [movie.slug, movie]));

      renderHall();
      root.classList.remove('is-hall-live-refresh');
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
    renderJourneyMoments();
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
    const rows = [
      [commentsToday, 'critiques aujourd’hui'],
      [repliesToday, 'réponses'],
      [likesToday, 'likes'],
      [viewersToday, 'nouveaux membres']
    ];
    el.replaceChildren();
    rows.forEach(([value, label]) => {
      const card = document.createElement('span');
      const strong = document.createElement('strong');
      const small = document.createElement('small');
      const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
      strong.textContent = String(safeValue);
      small.textContent = label;
      card.append(strong, small);
      el.appendChild(card);
    });
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
        ${PSAuth.avatarHtml(PSAuth.displayAvatar?.(item.viewer) || item.viewer?.avatar || 'orbiteur', 'viewer-avatar')}
        <strong>${escape(item.viewer?.pseudo || 'Spectateur')}</strong>
        <small>sur ${escape(item.movie.title)}</small>
        <p>${renderTextWithEmotes(shorten(item.comment.comment, 150))}</p>
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
        ${PSAuth.avatarHtml(PSAuth.displayAvatar?.(latest) || latest.avatar || 'orbiteur', 'viewer-avatar big')}
        <strong>${escape(latest.pseudo || 'Nouveau membre')}</strong>
        <small>${relativeDate(latest.created_at)} · ${escape(PSAuth.publicTitle?.(latest) || PSAuth.avatarLabel?.(latest.avatar) || 'Orbiteur')}</small>
        <p>${stats.roots ? 'Premier avis publié, entrée réussie dans l’orbite.' : 'Nouveau Planétien arrivé dans le hall.'}</p>
      </div>
    `;
  }

  function renderActiveMembers(){
    const container = qs('#hallActiveMembers');
    if(!container) return;
    const rows = state.viewers
      .map(viewer => ({viewer, stats:viewerStats(viewer.id)}))
      .map(row => ({...row, score:PSAuth.reputationScore ? PSAuth.reputationScore({comments:row.stats.roots, replies:row.stats.replies, likes:row.stats.likesReceived}) : row.stats.roots * 12 + row.stats.replies * 5 + row.stats.likesReceived * 8}))
      .filter(row => row.score > 0)
      .sort((a,b) => b.score - a.score)
      .slice(0,4);

    container.innerHTML = `<h3>🏆 Membres actifs</h3>${rows.length ? rows.map((row, index) => `
      <div class="hall-member-row hall-member-row-rich">
        <span>${['🥇','🥈','🥉','⭐'][index] || '⭐'}</span>
        <span class="hall-member-avatar">${PSAuth.avatarHtml(PSAuth.displayAvatar?.(row.viewer) || row.viewer.avatar || 'orbiteur', 'viewer-avatar small')}</span>
        <strong>${escape(row.viewer.pseudo)}</strong>
        <small>${escape((PSAuth.reputationLevel ? PSAuth.reputationLevel(row.score).label : 'Planétien'))} · ${row.score} pts</small>
      </div>
    `).join('') : empty('Les membres actifs s’échauffent encore en coulisses.')}`;
  }


  function timelineIcon(type){
    const icons = {
      review: {src:'assets/ic_clap.png', alt:'Critique publiée'},
      reply: {src:'assets/ic_clap.png', alt:'Réponse publiée'},
      join: {src:'assets/ic_fauteuil.png', alt:'Nouveau Planétien'}
    };
    const icon = icons[type] || icons.review;
    return `<span class="hall-event-icon hall-event-icon--${escape(type || 'review')}"><img src="${icon.src}" alt="${icon.alt}" loading="lazy"></span>`;
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
        iconType:comment.parent_id ? 'reply' : 'review',
        title:comment.parent_id ? `${viewerName(viewer)} a répondu sur ${movie.title}` : `${viewerName(viewer)} a publié une critique`,
        text:comment.parent_id ? shorten(comment.comment, 120) : `${movie.title} · ${comment.rating || '—'}/10`,
        href:`watch.html?slug=${encodeURIComponent(movie.slug)}#comment-${encodeURIComponent(comment.id)}`
      });
    });

    state.viewers.slice(0,12).forEach(viewer => {
      events.push({
        at:viewer.created_at,
        iconType:'join',
        title:`${viewerName(viewer)} a rejoint les Planétiens`,
        text:'Un nouveau siège vient de s’allumer dans la salle.',
        href:'account.html'
      });
    });

    events.sort((a,b) => new Date(b.at) - new Date(a.at));
    container.innerHTML = events.slice(0,4).map(event => `
      <a class="hall-event" href="${escape(event.href)}">
        ${timelineIcon(event.iconType)}
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


  function renderJourneyMoments(){
    const container = qs('#hallJourneyTicker');
    if(!container) return;

    const rows = state.viewers
      .map(viewer => ({viewer, stats:viewerStats(viewer.id)}))
      .map(row => {
        const moment = bestJourneyMoment(row.viewer, row.stats);
        return {...row, moment, rank:journeyMomentScore(row.stats)};
      })
      .filter(row => row.moment)
      .sort((a,b) => b.rank - a.rank || new Date(b.viewer.last_seen || b.viewer.created_at || 0) - new Date(a.viewer.last_seen || a.viewer.created_at || 0))
      .slice(0,12);

    const items = rows.map(row => ({
      icon: row.moment.icon,
      pseudo: row.viewer?.pseudo || 'Planétien',
      label: row.moment.label,
      avatar: PSAuth.displayAvatar?.(row.viewer) || row.viewer?.avatar || 'orbiteur'
    }));

    if(!items.length){
      container.innerHTML = `<span class="hall-ticker-empty">Les carnets de bord attendent leurs premières lignes.</span>`;
      return;
    }

    const loopItems = items.length < 6 ? [...items, ...items, ...items] : [...items, ...items];
    container.innerHTML = loopItems.map(item => `
      <span class="hall-ticker-item">
        ${PSAuth.avatarHtml(item.avatar, 'viewer-avatar tiny')}
        <strong>${escape(item.pseudo)}</strong>
        <em>${escape(item.icon)} ${escape(item.label)}</em>
      </span>
    `).join('');
  }

  function bestJourneyMoment(viewer, stats){
    const role = String(viewer?.role || '').toLowerCase();
    const pseudo = String(viewer?.pseudo || '').toLowerCase().trim();
    const badge = String(viewer?.badge || '').toLowerCase().trim();
    const avatar = String(viewer?.avatar || '').toLowerCase().trim();
    if(badge === 'architecte' || avatar === 'architecte' || (pseudo === 'spoofle' && role === 'admin')) return {icon:'🛰️', label:'Architecte de l’orbite'};
    if(role === 'admin') return {icon:'👑', label:'Fondateur de l’orbite'};
    if(role === 'moderator') return {icon:'🛡️', label:'Gardien du Hall'};
    if(stats.likesReceived >= 100) return {icon:'🏆', label:'100 likes reçus'};
    if(stats.roots >= 50) return {icon:'📽️', label:'50 critiques publiées'};
    if(stats.ratings >= 100) return {icon:'🌌', label:'100 films notés'};
    if(stats.likesReceived >= 25) return {icon:'⭐', label:'Critique appréciée'};
    if(stats.replies >= 25) return {icon:'🗣️', label:'Débatteur du Hall'};
    if(stats.roots >= 10) return {icon:'🍿', label:'10 critiques publiées'};
    if(stats.ratings >= 10) return {icon:'🎬', label:'10 films notés'};
    if(stats.replies >= 1) return {icon:'💬', label:'Premier échange'};
    if(stats.roots >= 1) return {icon:'✍️', label:'Premier avis'};
    if(stats.ratings >= 1) return {icon:'⭐', label:'Première note'};
    return {icon:'🚀', label:'Nouveau Planétien'};
  }

  function journeyMomentScore(stats){
    return Number(stats.ratings || 0) * 2 + Number(stats.roots || 0) * 12 + Number(stats.replies || 0) * 5 + Number(stats.likesReceived || 0) * 8;
  }

  function renderError(){
    ['#hallHotDiscussions','#hallPopularReview','#hallWelcome','#hallActiveMembers','#hallTimeline','#hallDivisiveMovies','#hallJourneyTicker'].forEach(selector => {
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
      likesReceived: state.likes.filter(like => ids.has(like.comment_id)).length,
      ratings: new Set(state.ratings.filter(rating => rating.viewer_id === viewerId).map(rating => rating.movie_id)).size
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

  function renderTextWithEmotes(text=''){
    const escaped = escape(text);
    const emotes = {
      ':)': '🙂', ':-)': '🙂',
      ':d': '😄', ':-d': '😄',
      ';)': '😉', ';-)': '😉',
      ';d': '😆',
      ':(': '🙁', ':-(': '🙁',
      ":'(": '😢',
      ':p': '😛', ':-p': '😛',
      '&lt;3': '❤️',
      '(y)': '👍',
      '(n)': '👎',
      '(*)': '⭐',
      '(popcorn)': '🍿'
    };

    return escaped.replace(/(^|[\s([{])(:-\)|:\)|:-D|:D|;-\)|;\)|;D|:-\(|:\(|:'\(|:-P|:P|&lt;3|\(y\)|\(n\)|\(\*\)|\(popcorn\))(?=$|[\s.,!?;:)\]}])/gi, (match, prefix, token) => {
      const emoji = emotes[String(token).toLowerCase()];
      return emoji ? `${prefix}<span class="ps-emote">${emoji}</span>` : match;
    });
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


  function startRealtimeHall(){
    if(state.realtimeActive) return true;
    if(!window.supabase?.createClient || !window.PS?.config?.supabaseUrl || !window.PS?.config?.supabaseKey) return false;
    try{
      state.realtimeClient = window.supabase.createClient(window.PS.config.supabaseUrl, window.PS.config.supabaseKey, {
        auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false},
        realtime:{params:{eventsPerSecond:8}}
      });
      const token = window.PS?.getState?.()?.accessToken || window.PS?.state?.accessToken || null;
      if(token && state.realtimeClient?.realtime?.setAuth){
        try{ state.realtimeClient.realtime.setAuth(token); }catch(error){ console.warn('Hall realtime auth warning', error); }
      }

      state.realtimeChannel = state.realtimeClient
        .channel('ps-hall-realtime')
        .on('postgres_changes', {event:'*', schema:'public', table:'comments'}, payload => queueRealtimeHallRefresh('comments', payload))
        .on('postgres_changes', {event:'*', schema:'public', table:'comment_likes'}, payload => queueRealtimeHallRefresh('likes', payload))
        .on('postgres_changes', {event:'*', schema:'public', table:'movie_ratings'}, payload => queueRealtimeHallRefresh('ratings', payload))
        .on('postgres_changes', {event:'*', schema:'public', table:'notifications'}, payload => queueRealtimeHallRefresh('notifications', payload))
        .subscribe(status => {
          state.realtimeActive = status === 'SUBSCRIBED';
          if(status === 'SUBSCRIBED') console.info('Planète Stream Hall realtime actif. Le hall respire tout seul.');
        });
      return true;
    }catch(error){
      console.warn('Hall realtime indisponible', error);
      return false;
    }
  }

  function queueRealtimeHallRefresh(source='hall', payload=null){
    if(document.hidden) return;
    if(state.realtimeTimer) clearTimeout(state.realtimeTimer);
    state.realtimeTimer = setTimeout(async () => {
      state.realtimeTimer = null;
      root.classList.add('is-hall-live-refresh');
      await loadHall();
      flashHallRealtime(source);
    }, 650);
  }

  function flashHallRealtime(source){
    const updated = qs('#hallUpdatedAt');
    if(updated){
      const labels = {comments:'nouvel échange', likes:'nouveau like', ratings:'nouvelle note', notifications:'nouvelle activité'};
      updated.textContent = `Mis à jour à l’instant · ${labels[source] || 'activité du Hall'}`;
    }
    root.classList.add('is-hall-realtime-pulse');
    setTimeout(() => root.classList.remove('is-hall-realtime-pulse'), 900);
  }

  async function stopRealtimeHall(){
    if(state.realtimeTimer){ clearTimeout(state.realtimeTimer); state.realtimeTimer = null; }
    if(state.realtimeChannel && state.realtimeClient){
      try{ await state.realtimeClient.removeChannel(state.realtimeChannel); }catch(error){ console.warn('Hall realtime remove warning', error); }
    }
    state.realtimeChannel = null;
    state.realtimeClient = null;
    state.realtimeActive = false;
  }

  document.addEventListener('visibilitychange', () => {
    if(document.hidden){
      clearInterval(state.timer);
      stopRealtimeHall();
    }else{
      loadHall();
      startRealtimeHall();
      state.timer = setInterval(loadHall, 90000);
    }
  });

  boot();
})();
