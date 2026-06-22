/* Planète Stream v2 · Auth unique
   Une seule source de vérité : window.PS.state
   - session Supabase Auth vérifiée
   - profil public viewers lié à auth.users.id
   - navigation synchronisée sur toutes les pages
*/

const PS_AUTH_CONFIG = {
  storePrefix: 'planetestream',
  supabaseUrl: 'https://bdtktrbtawalniamalcs.supabase.co',
  supabaseKey: 'sb_publishable_QLnbv7xRodnpeCXWNZ1q0w_ySaZLElI'
};

(function bootstrapPlaneteStreamAuth(){
  const sessionKey = `${PS_AUTH_CONFIG.storePrefix}:authSession`;
  const viewerKey = `${PS_AUTH_CONFIG.storePrefix}:viewer`;
  const pendingKey = `${PS_AUTH_CONFIG.storePrefix}:pendingSignupProfile`;

  const state = {
    ready:false,
    session:null,
    user:null,
    viewer:null,
    accessToken:null,
    notificationsUnread:0,
    error:null
  };

  const listeners = new Map();
  let realtimeClient = null;
  let realtimeNotificationChannel = null;
  let realtimeNotificationViewerId = null;

  const AVATAR_CATALOG = [
    {id:'orbiteur', label:"L'Orbiteur", public:true},
    {id:'robot', label:'Robot cinéphile', public:true},
    {id:'explorateur', label:'Explorateur galactique', public:true},
    {id:'renard', label:'Renard critique', public:true},
    {id:'hibou', label:'Le Sage', public:true},
    {id:'cosmonaute', label:'Cosmonaute', public:true},
    {id:'masques', label:'Masques du drame', public:true},
    {id:'projectionniste', label:'Projectionniste', public:true},
    {id:'chat', label:'Chat noir', public:true},
    {id:'kraken', label:'Kraken', public:true},
    {id:'cyberpunk', label:'Cyberpunk', public:true},
    {id:'vip', label:'VIP', public:true},
    {id:'fondateur', label:'Fondateur', public:false, reserved:true},
    {id:'moderateur', label:'Modérateur', public:false, reserved:true},
    {id:'architecte', label:'Architecte', public:false, reserved:true}
  ];
  const AVATAR_IDS = new Set(AVATAR_CATALOG.map(item => item.id));
  const RESERVED_AVATARS = new Set(AVATAR_CATALOG.filter(item => item.reserved).map(item => item.id));


  function enabled(){
    return Boolean(PS_AUTH_CONFIG.supabaseUrl && PS_AUTH_CONFIG.supabaseKey);
  }

  function emit(event, detail={}){
    (listeners.get(event) || []).forEach(handler => {
      try{ handler(detail); }catch(error){ console.error(`PS listener ${event} error`, error); }
    });
    window.dispatchEvent(new CustomEvent(`ps:${event}`, {detail}));
  }

  function on(event, handler){
    if(!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => listeners.get(event)?.delete(handler);
  }

  function anonHeaders(){
    return {
      apikey: PS_AUTH_CONFIG.supabaseKey,
      Authorization: `Bearer ${PS_AUTH_CONFIG.supabaseKey}`
    };
  }

  function authHeaders(){
    const token = state.accessToken || readSession()?.access_token || null;
    return {
      apikey: PS_AUTH_CONFIG.supabaseKey,
      Authorization: `Bearer ${token || PS_AUTH_CONFIG.supabaseKey}`
    };
  }

  function readSession(){
    try{
      const session = JSON.parse(localStorage.getItem(sessionKey) || 'null');
      return session?.access_token ? session : null;
    }catch{
      return null;
    }
  }

  function persistSession(session){
    if(!session?.access_token) return null;
    const normalized = {
      access_token: session.access_token,
      refresh_token: session.refresh_token || null,
      expires_at: session.expires_at || null,
      user: session.user || null
    };
    localStorage.setItem(sessionKey, JSON.stringify(normalized));
    state.session = normalized;
    state.user = normalized.user || null;
    state.accessToken = normalized.access_token;
    return normalized;
  }

  function clearSession(){
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(viewerKey);
    state.session = null;
    state.user = null;
    state.viewer = null;
    state.accessToken = null;
    state.notificationsUnread = 0;
    state.error = null;
    stopRealtimeNotifications();
    updateNav();
    emit('logout', snapshot());
    emit('state', snapshot());
  }

  function loadViewer(){
    try{ return JSON.parse(localStorage.getItem(viewerKey) || 'null'); }
    catch{ return null; }
  }

  function saveViewer(viewer){
    if(viewer?.id){
      const normalized = normalizeViewer(viewer);
      localStorage.setItem(viewerKey, JSON.stringify(normalized));
      state.viewer = normalized;
    }
    updateNav();
    emit('viewer', snapshot());
  }

  function snapshot(){
    return {
      ready:state.ready,
      session:state.session,
      user:state.user,
      viewer:state.viewer,
      accessToken:state.accessToken,
      notificationsUnread:state.notificationsUnread || 0,
      isAuthenticated:Boolean(state.user?.id && state.accessToken),
      error:state.error
    };
  }

  function readAuthParamsFromUrl(){
    const sources = [window.location.hash, window.location.search]
      .filter(Boolean)
      .map(value => value.replace(/^[#?]/, ''));

    for(const source of sources){
      const params = new URLSearchParams(source);
      const access_token = params.get('access_token');
      if(access_token){
        return {
          access_token,
          refresh_token: params.get('refresh_token'),
          expires_at: params.get('expires_at') || (params.get('expires_in') ? Math.floor(Date.now()/1000) + Number(params.get('expires_in')) : null),
          type: params.get('type')
        };
      }
    }
    return null;
  }

  function cleanAuthUrl(){
    if(!window.history?.replaceState) return;
    const url = new URL(window.location.href);
    ['access_token','refresh_token','expires_at','expires_in','token_type','type'].forEach(key => url.searchParams.delete(key));
    url.hash = '';
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }

  async function fetchAuthUser(accessToken=state.accessToken || readSession()?.access_token){
    if(!enabled() || !accessToken) return null;
    try{
      const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/auth/v1/user`, {
        headers:{apikey: PS_AUTH_CONFIG.supabaseKey, Authorization:`Bearer ${accessToken}`},
        cache:'no-store'
      });
      const data = await response.json().catch(() => null);
      return response.ok ? data : null;
    }catch(error){
      console.error('PS auth user fetch error', error);
      return null;
    }
  }

  async function refreshSession(){
    const session = readSession();
    if(!enabled() || !session?.refresh_token) return null;
    try{
      const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method:'POST',
        headers:{...anonHeaders(), 'Content-Type':'application/json'},
        body: JSON.stringify({refresh_token: session.refresh_token}),
        cache:'no-store'
      });
      const data = await response.json().catch(() => null);
      if(!response.ok || !data?.access_token){
        console.warn('PS refresh refused', response.status, data);
        return null;
      }
      return persistSession(data);
    }catch(error){
      console.error('PS refresh error', error);
      return null;
    }
  }

  async function verifyStoredSession(){
    let session = readSession();
    if(!session?.access_token) return null;

    let user = await fetchAuthUser(session.access_token);
    if(user?.id){
      return persistSession({...session, user});
    }

    session = await refreshSession();
    if(!session?.access_token) return null;

    user = await fetchAuthUser(session.access_token);
    if(user?.id){
      return persistSession({...session, user});
    }

    return null;
  }

  async function hydrateFromAuthRedirect(){
    const authParams = readAuthParamsFromUrl();
    if(!authParams?.access_token) return null;

    const user = await fetchAuthUser(authParams.access_token);
    const session = persistSession({...authParams, user});
    cleanAuthUrl();
    return session;
  }

  async function restSelect(table, query, {auth=false}={}){
    if(!enabled()) return {ok:false, data:null, status:0};
    try{
      const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/rest/v1/${table}?${query}`, {
        headers:{...(auth ? authHeaders() : anonHeaders()), 'Cache-Control':'no-cache'},
        cache:'no-store'
      });
      const data = await response.json().catch(() => null);
      return {ok:response.ok, data, status:response.status};
    }catch(error){
      console.error(`PS REST SELECT ${table} error`, error);
      return {ok:false, data:null, status:0};
    }
  }

  async function restWrite(table, method, filter, payload, {auth=true, prefer='return=minimal'}={}){
    if(!enabled()) return {ok:false, data:null, status:0};
    const suffix = filter ? `?${filter}` : '';
    try{
      const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/rest/v1/${table}${suffix}`, {
        method,
        headers:{...(auth ? authHeaders() : anonHeaders()), 'Content-Type':'application/json', Prefer:prefer},
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      return {ok:response.ok, data, status:response.status};
    }catch(error){
      console.error(`PS REST WRITE ${table} error`, error);
      return {ok:false, data:null, status:0};
    }
  }

  async function fetchViewerByAuth(authUserId){
    if(!authUserId) return null;
    const result = await restSelect('viewers', `auth_user_id=eq.${encodeURIComponent(authUserId)}&select=id,auth_user_id,pseudo,avatar,role,badge,created_at,last_seen&limit=1`, {auth:true});
    return result.ok && Array.isArray(result.data) ? result.data[0] : null;
  }

  async function fetchViewerByPseudo(pseudo){
    const result = await restSelect('viewers', `pseudo=eq.${encodeURIComponent(cleanPseudo(pseudo))}&select=id,pseudo&limit=1`, {auth:false});
    return result.ok && Array.isArray(result.data) ? result.data[0] : null;
  }

  async function insertViewer(payload){
    const result = await restWrite('viewers', 'POST', '', payload, {auth:true, prefer:'return=representation'});
    return result.ok && Array.isArray(result.data) ? result.data[0] : null;
  }

  async function patchViewer(id, payload){
    if(!id) return false;
    const result = await restWrite('viewers', 'PATCH', `id=eq.${encodeURIComponent(id)}`, payload, {auth:true, prefer:'return=minimal'});
    return result.ok;
  }

  async function ensureViewerProfile({pseudo, avatar}={}){
    const user = state.user;
    if(!user?.id) return null;

    const local = loadViewer();
    if(local?.auth_user_id === user.id && local?.id){
      state.viewer = normalizeViewer(local);
      return state.viewer;
    }

    const existing = await fetchViewerByAuth(user.id);
    if(existing){
      const viewer = normalizeViewer(existing);
      saveViewer(viewer);
      await patchViewer(viewer.id, {last_seen:new Date().toISOString()});
      return viewer;
    }

    const pending = getPendingProfile(user.email);
    const wantedPseudo = cleanPseudo(pseudo || user.user_metadata?.pseudo || pending?.pseudo || user.email?.split('@')[0] || 'Spectateur');
    if(!isValidPseudo(wantedPseudo)) return null;

    const taken = await fetchViewerByPseudo(wantedPseudo);
    if(taken) return null;

    const payload = {
      auth_user_id:user.id,
      pseudo:wantedPseudo,
      avatar:normalizeAvatar(avatar || user.user_metadata?.avatar || pending?.avatar, wantedPseudo),
      role:'viewer',
      created_at:new Date().toISOString(),
      last_seen:new Date().toISOString()
    };

    const created = await insertViewer(payload);
    if(!created) return null;

    const viewer = normalizeViewer(created);
    saveViewer(viewer);
    return viewer;
  }

  async function refreshAuthState({force=false}={}){
    state.error = null;

    await hydrateFromAuthRedirect();

    let session = readSession();
    if(force || session?.access_token){
      session = await verifyStoredSession();
    }

    if(!session?.access_token || !session?.user?.id){
      state.session = null;
      state.user = null;
      state.accessToken = null;
      state.viewer = null;
      localStorage.removeItem(viewerKey);
      stopRealtimeNotifications();
      updateNav();
      emit('state', snapshot());
      return snapshot();
    }

    state.session = session;
    state.user = session.user;
    state.accessToken = session.access_token;
    state.viewer = await ensureViewerProfile({});

    updateNav();
    if(state.viewer?.id){
      await refreshNotificationsCount();
      startRealtimeNotifications();
    }
    emit('state', snapshot());
    return snapshot();
  }

  async function signUp({email, password, pseudo, avatar}){
    if(!enabled()) return {ok:false, message:'Supabase est indisponible.'};

    const wantedPseudo = cleanPseudo(pseudo);
    if(!isValidPseudo(wantedPseudo)){
      return {ok:false, message:'Pseudo invalide : 2 à 32 caractères, lettres, chiffres, espaces, tirets et underscores uniquement.'};
    }

    const alreadyTaken = await fetchViewerByPseudo(wantedPseudo);
    if(alreadyTaken){
      return {ok:false, message:`Le pseudo « ${wantedPseudo} » est déjà utilisé.`};
    }

    const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/auth/v1/signup`, {
      method:'POST',
      headers:{...anonHeaders(), 'Content-Type':'application/json'},
      body: JSON.stringify({
        email,
        password,
        data:{pseudo:wantedPseudo, avatar:normalizeAvatar(avatar, wantedPseudo)}
      })
    });
    const data = await response.json().catch(() => null);
    if(!response.ok) return {ok:false, message:authErrorMessage(data)};

    localStorage.setItem(pendingKey, JSON.stringify({email, pseudo:wantedPseudo, avatar:normalizeAvatar(avatar, wantedPseudo)}));

    if(data?.access_token){
      persistSession(data);
      await refreshAuthState({force:true});
      return {ok:true, session:state.session, viewer:state.viewer, needsEmailConfirmation:false};
    }

    return {ok:true, session:null, viewer:null, needsEmailConfirmation:true};
  }

  async function signIn({email, password}){
    if(!enabled()) return {ok:false, message:'Supabase est indisponible.'};
    const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method:'POST',
      headers:{...anonHeaders(), 'Content-Type':'application/json'},
      body: JSON.stringify({email, password})
    });
    const data = await response.json().catch(() => null);
    if(!response.ok) return {ok:false, message:authErrorMessage(data)};

    persistSession(data);
    const pending = getPendingProfile(email);
    await ensureViewerProfile({pseudo:data?.user?.user_metadata?.pseudo || pending?.pseudo, avatar:data?.user?.user_metadata?.avatar || pending?.avatar});
    await refreshAuthState({force:true});

    if(!state.viewer?.id){
      return {ok:false, message:'Connexion réussie, mais le profil public n’a pas pu être créé. Vérifie que le pseudo choisi est disponible.'};
    }
    return {ok:true, session:state.session, viewer:state.viewer};
  }

  async function signOut(){
    const token = state.accessToken || readSession()?.access_token;
    if(enabled() && token){
      await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/auth/v1/logout`, {
        method:'POST',
        headers:{apikey:PS_AUTH_CONFIG.supabaseKey, Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}
      }).catch(() => null);
    }
    clearSession();
    return true;
  }

  async function requireAuthenticatedViewer(){
    const fresh = await refreshAuthState({force:true});
    if(!fresh.isAuthenticated || !fresh.viewer?.id) return null;
    return fresh.viewer;
  }

  function getPendingProfile(email){
    try{
      const pending = JSON.parse(localStorage.getItem(pendingKey) || 'null');
      return pending?.email === email ? pending : null;
    }catch{
      return null;
    }
  }

  function normalizeViewer(row={}){
    return {
      id:row.id,
      auth_user_id:row.auth_user_id || state.user?.id || null,
      pseudo:row.pseudo || 'Spectateur',
      avatar:normalizeAvatar(row.avatar, row.pseudo || 'Spectateur'),
      role:row.role || 'viewer',
      badge:String(row.badge || 'none').toLowerCase(),
      created_at:row.created_at || null,
      last_seen:row.last_seen || null,
      authenticated:Boolean(row.auth_user_id || state.user?.id)
    };
  }

  function cleanPseudo(value=''){
    return String(value).normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 32);
  }

  function isValidPseudo(value=''){
    return /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _-]{2,32}$/.test(cleanPseudo(value));
  }

  function normalizeAvatar(value='', fallbackSeed=''){
    const raw = String(value || '').trim();
    const legacy = {'🪐':'orbiteur','🚀':'cosmonaute','👾':'explorateur','🤖':'robot','🦊':'renard','🐙':'kraken','🦉':'hibou','🎬':'projectionniste','🍿':'projectionniste','🌙':'chat','⚡':'cyberpunk','🐼':'orbiteur'};
    const mapped = legacy[raw] || raw.toLowerCase();
    if(isImageAvatar(mapped)) return mapped;
    return pickAvatar(fallbackSeed || raw || 'Spectateur');
  }

  function avatarCatalog({includeReserved=false}={}){
    return AVATAR_CATALOG.filter(item => includeReserved || item.public);
  }

  function isImageAvatar(value=''){
    return AVATAR_IDS.has(String(value || '').toLowerCase());
  }

  function isReservedAvatar(value=''){
    return RESERVED_AVATARS.has(String(value || '').toLowerCase());
  }

  function avatarLabel(value=''){
    const id = normalizeAvatar(value || 'orbiteur', value || 'orbiteur');
    return AVATAR_CATALOG.find(item => item.id === id)?.label || value || 'Orbiteur';
  }

  function avatarPath(value=''){
    const id = normalizeAvatar(value || 'orbiteur', value || 'orbiteur');
    if(!isImageAvatar(id)) return '';
    return `assets/avatars/${id}.png`;
  }

  function avatarHtml(value='', className='viewer-avatar'){
    const id = normalizeAvatar(value || 'orbiteur', value || 'orbiteur');
    if(isImageAvatar(id)){
      return `<span class="${className}"><img src="${avatarPath(id)}" alt="${escapeHtml(avatarLabel(id))}" loading="lazy"></span>`;
    }
    return `<span class="${className}">${escapeHtml(value || '🪐')}</span>`;
  }

  function pickAvatar(seed=''){
    const avatars = avatarCatalog().map(item => item.id);
    const score = String(seed).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return avatars[score % avatars.length] || 'orbiteur';
  }

  function authErrorMessage(data){
    const message = String(data?.msg || data?.message || data?.error_description || data?.error || 'Erreur inconnue.');
    if(/invalid login/i.test(message)) return 'Identifiants incorrects.';
    if(/already registered|already been registered|user already/i.test(message)) return 'Cette adresse email possède déjà un compte.';
    if(/email rate/i.test(message)) return 'Limite d’envoi email atteinte. Attends un peu ou confirme le compte manuellement dans Supabase.';
    if(/password/i.test(message)) return 'Mot de passe refusé. Il doit être plus solide.';
    return message;
  }

  function escapeHtml(str=''){
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }


  function isArchitect(viewer={}){
    return String(viewer?.badge || '').toLowerCase() === 'architecte' || String(viewer?.avatar || '').toLowerCase() === 'architecte';
  }

  function displayAvatar(viewer={}){
    if(isArchitect(viewer)) return 'architecte';
    const role = String(viewer?.role || 'viewer').toLowerCase();
    if(role === 'admin' || role === 'founder') return 'fondateur';
    if(role === 'moderator') return 'moderateur';
    return viewer?.avatar || 'orbiteur';
  }

  function publicTitle(viewer={}){
    if(isArchitect(viewer)) return 'Architecte';
    const badge = String(viewer?.badge || '').toLowerCase();
    if(badge === 'founder' || badge === 'fondateur') return 'Fondateur';
    if(badge === 'moderator' || badge === 'moderateur') return 'Modérateur';
    const role = String(viewer?.role || 'viewer').toLowerCase();
    if(role === 'admin' || role === 'founder') return 'Fondateur';
    if(role === 'moderator') return 'Modérateur';
    return 'Planétien';
  }

  function roleLabel(role='viewer'){
    const key = String(role || 'viewer').toLowerCase();
    if(key === 'admin' || key === 'founder') return 'Fondateur';
    if(key === 'moderator') return 'Modérateur';
    return 'Planétien';
  }

  function avatarTitle(value=''){
    const label = avatarLabel(value || 'orbiteur');
    return label || 'Orbiteur';
  }

  function reputationScore(stats={}){
    return Math.max(0,
      Number(stats.comments || stats.roots || 0) * 12 +
      Number(stats.replies || 0) * 5 +
      Number(stats.likes || stats.likesReceived || 0) * 8 +
      Number(stats.favorites || 0) * 2
    );
  }

  function reputationLevel(score=0){
    const value = Number(score || 0);
    const levels = [
      {min:0, next:50, icon:'🌱', label:'Nouveau Planétien'},
      {min:50, next:150, icon:'🎬', label:'Spectateur actif'},
      {min:150, next:350, icon:'🍿', label:'Cinéphile confirmé'},
      {min:350, next:800, icon:'⭐', label:'Critique influent'},
      {min:800, next:1500, icon:'🏆', label:'Légende de l’orbite'},
      {min:1500, next:null, icon:'🌌', label:'Constellation vivante'}
    ];
    const current = [...levels].reverse().find(level => value >= level.min) || levels[0];
    const progress = current.next ? Math.min(100, Math.round(((value - current.min) / (current.next - current.min)) * 100)) : 100;
    return {...current, score:value, progress};
  }

  function badgeDefinitions(viewer={}, stats={}){
    const role = String(viewer?.role || 'viewer').toLowerCase();
    const score = reputationScore(stats);
    const level = reputationLevel(score);
    const badges = [];
    if(isArchitect(viewer)) badges.push({icon:'🛰️', label:'Architecte', description:'Celui qui a dessiné les premiers plans de la station orbitale', rarity:'legendary'});
    else if(role === 'admin') badges.push({icon:'👑', label:'Fondateur', description:'Pilote officiel de Planète Stream', rarity:'legendary'});
    if(role === 'moderator') badges.push({icon:'🛡️', label:'Modérateur', description:'Gardien de la salle et des popcorns civilisés', rarity:'rare'});
    if(Number(stats.comments || stats.roots || 0) >= 1) badges.push({icon:'🎬', label:'Premier avis', description:'A publié sa première critique', rarity:'common'});
    if(Number(stats.comments || stats.roots || 0) >= 5) badges.push({icon:'🍿', label:'Cinéphile actif', description:'A publié au moins 5 critiques', rarity:'rare'});
    if(Number(stats.comments || stats.roots || 0) >= 25) badges.push({icon:'📽️', label:'Archiviste', description:'A publié au moins 25 critiques', rarity:'epic'});
    if(Number(stats.replies || 0) >= 3) badges.push({icon:'💬', label:'Conversateur', description:'Participe aux échanges', rarity:'common'});
    if(Number(stats.replies || 0) >= 20) badges.push({icon:'🗣️', label:'Débatteur', description:'Anime les discussions du Hall', rarity:'rare'});
    if(Number(stats.likes || stats.likesReceived || 0) >= 5) badges.push({icon:'⭐', label:'Critique appréciée', description:'Ses avis reçoivent des likes', rarity:'rare'});
    if(Number(stats.likes || stats.likesReceived || 0) >= 25) badges.push({icon:'🏆', label:'Top critique', description:'Ses critiques marquent les esprits', rarity:'epic'});
    if(score >= 350) badges.push({icon:'🌌', label:level.label, description:'Réputation élevée dans l’orbite', rarity:'legendary'});
    const joined = viewer?.created_at ? new Date(viewer.created_at) : null;
    if(joined && !Number.isNaN(joined.getTime()) && Date.now() - joined.getTime() < 1000 * 60 * 60 * 24 * 30){
      badges.push({icon:'🌱', label:'Nouveau membre', description:'A rejoint récemment Planète Stream', rarity:'common'});
    }
    return badges.slice(0, 8);
  }


  async function fetchUnreadNotificationsCount(){
    const viewer = state.viewer || loadViewer();
    if(!viewer?.id || !state.accessToken) return 0;
    const result = await restSelect('notifications', `recipient_viewer_id=eq.${encodeURIComponent(viewer.id)}&read_at=is.null&select=id`, {auth:true});
    if(!result.ok || !Array.isArray(result.data)) return 0;
    return result.data.length;
  }

  async function refreshNotificationsCount(){
    const count = await fetchUnreadNotificationsCount();
    state.notificationsUnread = Number(count || 0);
    updateNotificationBadges();
    emit('notifications', snapshot());
    return state.notificationsUnread;
  }

  function updateNotificationBadges(){
    const count = Number(state.notificationsUnread || 0);
    const link = document.querySelector('#accountNavLink');

    // Sécurité V2.6.3 : une ancienne version plaçait data-notification-count
    // directement sur le bouton compte. La boucle remplaçait alors tout le pseudo
    // par "0" ou "3". On nettoie l'attribut et on ne met à jour que les vrais badges.
    if(link){
      link.removeAttribute('data-notification-count');
      link.classList.toggle('has-notifications', count > 0);
      link.dataset.notificationsUnread = String(count);

      const viewer = state.viewer || loadViewer();
      if(viewer?.pseudo && (!link.querySelector('.account-user-name') || /^\d+$/.test((link.textContent || '').trim()))){
        link.href = '#';
        link.innerHTML = `${avatarHtml(viewer.avatar || 'orbiteur', 'account-avatar')}<span class="account-user-name">${escapeHtml(viewer.pseudo)}</span><span class="account-chevron">▾</span><b class="notification-dot" data-notification-count hidden aria-label="Messages non lus">0</b>`;
        link.classList.add('is-connected');
        ensureAccountDropdown(link, viewer);
      }
    }

    document.querySelectorAll('[data-notification-count]').forEach(node => {
      if(node.id === 'accountNavLink') return;
      node.textContent = String(count);
      node.classList.toggle('has-notifications', count > 0);
      node.hidden = count <= 0;
    });
  }

  async function createNotification(payload={}){
    const actor = state.viewer || loadViewer();
    if(!actor?.id || !payload.recipient_viewer_id) return false;
    if(String(payload.recipient_viewer_id) === String(actor.id)) return false;
    const body = {
      recipient_viewer_id:payload.recipient_viewer_id,
      actor_viewer_id:payload.actor_viewer_id || actor.id,
      type:payload.type || 'reply',
      movie_id:payload.movie_id || null,
      comment_id:payload.comment_id || null,
      parent_comment_id:payload.parent_comment_id || null,
      message:payload.message || null,
      read_at:null,
      created_at:new Date().toISOString()
    };
    const result = await restWrite('notifications', 'POST', '', body, {auth:true, prefer:'return=minimal'});
    return result.ok;
  }


  function updateNav(){
    const link = document.querySelector('#accountNavLink');
    if(!link) return;

    const viewer = state.viewer || loadViewer();
    const connected = Boolean(state.user?.id && viewer?.auth_user_id === state.user.id);

    if(connected){
      link.href = '#';
      link.innerHTML = `${avatarHtml(viewer.avatar || 'orbiteur', 'account-avatar')}<span class="account-user-name">${escapeHtml(viewer.pseudo)}</span><span class="account-chevron">▾</span><b class="notification-dot" data-notification-count hidden aria-label="Messages non lus">0</b>`;
      link.classList.add('is-connected');
      link.setAttribute('aria-haspopup', 'true');
      link.setAttribute('aria-expanded', 'false');
      ensureAccountDropdown(link, viewer);
    }else if(state.user?.id){
      link.href = 'account.html';
      link.textContent = '👤 Finaliser mon compte';
      link.classList.add('is-connected');
      link.removeAttribute('aria-haspopup');
      link.removeAttribute('aria-expanded');
      removeAccountDropdown();
    }else{
      link.href = 'account.html';
      link.textContent = 'Créer un compte / Se connecter';
      link.classList.remove('is-connected');
      link.removeAttribute('aria-haspopup');
      link.removeAttribute('aria-expanded');
      removeAccountDropdown();
    }
  }

  function ensureAccountDropdown(link, viewer){
    const parent = link.parentElement;
    if(!parent) return;
    parent.classList.add('account-menu-wrap');

    let menu = parent.querySelector('#accountDropdown');
    if(!menu){
      menu = document.createElement('div');
      menu.id = 'accountDropdown';
      menu.className = 'account-dropdown';
      parent.insertBefore(menu, link.nextSibling);
    }

    menu.innerHTML = `
      <div class="account-dropdown-head">
        ${avatarHtml(displayAvatar(viewer), 'viewer-avatar')}
        <div>
          <strong>${escapeHtml(viewer.pseudo)}</strong>
          <small>${escapeHtml(avatarTitle(displayAvatar(viewer)))} · ${escapeHtml(publicTitle(viewer))}</small>
        </div>
      </div>
      <a href="account.html#mon-espace">🪐 Mon Espace</a>
      <a href="account.html#mes-notifications">📬 Messages du Hall <b class="menu-notification-pill" data-notification-count hidden aria-label="Messages non lus">0</b></a>
      <a href="account.html#mon-parcours">🚀 Mon parcours</a>
      <a href="account.html#mon-profil">👤 Mon profil</a>
      <a href="account.html#mes-favoris">❤️ Mes favoris</a>
      <a href="account.html#mes-critiques">💬 Mes critiques</a>
      <a href="account.html#mes-avatars">🎭 Mes avatars</a>
      <a href="account.html#mes-badges">🏅 Mes badges</a>
      <a href="account.html#mes-statistiques">📊 Mes statistiques</a>
      <a href="account.html#parametres">⚙️ Paramètres</a>
      <button type="button" data-auth-logout>🚪 Déconnexion</button>
    `;
  }

  function removeAccountDropdown(){
    document.querySelector('#accountDropdown')?.remove();
  }

  function bindAccountMenu(){
    if(window.__psAccountMenuBound) return;
    window.__psAccountMenuBound = true;

    document.addEventListener('click', async event => {
      const link = event.target.closest('#accountNavLink');
      const menu = document.querySelector('#accountDropdown');

      if(link && menu){
        event.preventDefault();
        const open = menu.classList.toggle('is-open');
        link.setAttribute('aria-expanded', String(open));
        return;
      }

      if(event.target.closest('[data-auth-logout]')){
        event.preventDefault();
        await signOut();
        if(location.pathname.endsWith('/account.html') || location.pathname.endsWith('account.html')) location.reload();
        return;
      }

      if(menu && !event.target.closest('.account-menu-wrap')){
        menu.classList.remove('is-open');
        document.querySelector('#accountNavLink')?.setAttribute('aria-expanded', 'false');
      }
    });
  }



  function getRealtimeClient(){
    if(!enabled() || !window.supabase?.createClient) return null;
    if(!realtimeClient){
      realtimeClient = window.supabase.createClient(PS_AUTH_CONFIG.supabaseUrl, PS_AUTH_CONFIG.supabaseKey, {
        auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false},
        realtime:{params:{eventsPerSecond:5}}
      });
    }
    const token = state.accessToken || readSession()?.access_token || null;
    if(token && realtimeClient?.realtime?.setAuth){
      try{ realtimeClient.realtime.setAuth(token); }catch(error){ console.warn('PS realtime setAuth warning', error); }
    }
    return realtimeClient;
  }

  async function stopRealtimeNotifications(){
    if(realtimeNotificationChannel && realtimeClient){
      try{ await realtimeClient.removeChannel(realtimeNotificationChannel); }catch(error){ console.warn('PS realtime remove warning', error); }
    }
    realtimeNotificationChannel = null;
    realtimeNotificationViewerId = null;
  }

  function startRealtimeNotifications(){
    const viewer = state.viewer || loadViewer();
    if(!viewer?.id || !state.accessToken) return false;
    const client = getRealtimeClient();
    if(!client) return false;
    if(realtimeNotificationChannel && realtimeNotificationViewerId === viewer.id) return true;

    stopRealtimeNotifications();
    realtimeNotificationViewerId = viewer.id;

    realtimeNotificationChannel = client
      .channel(`ps-notifications-${viewer.id}`)
      .on('postgres_changes', {
        event:'*',
        schema:'public',
        table:'notifications',
        filter:`recipient_viewer_id=eq.${viewer.id}`
      }, async payload => {
        try{
          await refreshNotificationsCount();
          emit('notification-realtime', {payload, state:snapshot()});
        }catch(error){
          console.warn('PS realtime notification refresh error', error);
        }
      })
      .subscribe(status => {
        emit('realtime-notifications', {status, viewerId:viewer.id, state:snapshot()});
      });

    return true;
  }

  function startNotificationPolling(){
    if(window.__psNotificationPollingBound) return;
    window.__psNotificationPollingBound = true;

    const refreshIfConnected = () => {
      if(state.viewer?.id && state.accessToken){
        startRealtimeNotifications();
        refreshNotificationsCount().catch(() => {});
      }
    };

    window.addEventListener('focus', refreshIfConnected);
    document.addEventListener('visibilitychange', () => {
      if(!document.hidden) refreshIfConnected();
    });

    window.__psNotificationPollingTimer = setInterval(() => {
      if(!document.hidden) refreshIfConnected();
    }, 60000);
  }

  function whenDomReady(){
    return new Promise(resolve => {
      if(document.readyState !== 'loading') resolve();
      else document.addEventListener('DOMContentLoaded', resolve, {once:true});
    });
  }

  async function init(){
    bindAccountMenu();
    await refreshAuthState({force:false});
    state.ready = true;
    await whenDomReady();
    updateNav();
    updateNotificationBadges();
    startNotificationPolling();
    startRealtimeNotifications();
    emit('ready', snapshot());
    emit('state', snapshot());
    return snapshot();
  }

  const ready = init();

  const PS = {
    config:PS_AUTH_CONFIG,
    state,
    ready,
    on,
    emit,
    getState:() => snapshot(),
    refreshAuthState,
    requireAuthenticatedViewer,
    signUp,
    signIn,
    signOut,
    restSelect,
    restWrite,
    anonHeaders,
    authHeaders,
    fetchAuthUser,
    refreshSession,
    loadViewer,
    saveViewer,
    clearLocal:clearSession,
    pickAvatar,
    avatarCatalog,
    avatarPath,
    avatarLabel,
    avatarHtml,
    displayAvatar,
    publicTitle,
    normalizeAvatar,
    isImageAvatar,
    isReservedAvatar,
    escapeHtml,
    cleanPseudo,
    isValidPseudo,
    updateNav,
    roleLabel,
    avatarTitle,
    reputationScore,
    reputationLevel,
    badgeDefinitions,
    createNotification,
    refreshNotificationsCount,
    fetchUnreadNotificationsCount,
    startRealtimeNotifications,
    stopRealtimeNotifications
  };

  window.PS = PS;

  // Compatibilité avec les scripts existants pendant la migration.
  window.PSAuth = {
    enabled,
    signUp,
    signIn,
    signOut,
    getSession:() => state.session || readSession(),
    hydrateFromAuthRedirect,
    hydrateStoredSessionUser:() => refreshAuthState({force:false}),
    getAccessToken:() => state.accessToken || readSession()?.access_token || null,
    getAuthUser:() => state.user || readSession()?.user || null,
    getCurrentViewer:async () => (await refreshAuthState({force:false})).viewer,
    getAuthState:async () => refreshAuthState({force:false}),
    refreshSession,
    getVerifiedSession:() => refreshAuthState({force:true}).then(s => s.session),
    requireAuthenticatedViewer,
    loadViewer,
    saveViewer,
    clearLocal:clearSession,
    authHeaders,
    anonHeaders,
    pickAvatar,
    avatarCatalog,
    avatarPath,
    avatarLabel,
    avatarHtml,
    displayAvatar,
    publicTitle,
    normalizeAvatar,
    isImageAvatar,
    isReservedAvatar,
    escapeHtml,
    cleanPseudo,
    isValidPseudo,
    updateNav,
    roleLabel,
    avatarTitle,
    reputationScore,
    reputationLevel,
    badgeDefinitions,
    createNotification,
    refreshNotificationsCount,
    fetchUnreadNotificationsCount,
    startRealtimeNotifications,
    stopRealtimeNotifications
  };
})();
