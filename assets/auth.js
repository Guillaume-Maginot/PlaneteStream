const PS_AUTH_CONFIG = {
  storePrefix: 'planetestream',
  supabaseUrl: 'https://bdtktrbtawalniamalcs.supabase.co',
  supabaseKey: 'sb_publishable_QLnbv7xRodnpeCXWNZ1q0w_ySaZLElI'
};

const PSAuth = (() => {
  const sessionKey = `${PS_AUTH_CONFIG.storePrefix}:authSession`;
  const viewerKey = `${PS_AUTH_CONFIG.storePrefix}:viewer`;
  const pendingKey = `${PS_AUTH_CONFIG.storePrefix}:pendingSignupProfile`;

  function enabled(){
    return Boolean(PS_AUTH_CONFIG.supabaseUrl && PS_AUTH_CONFIG.supabaseKey);
  }

  function anonHeaders(){
    return {
      apikey: PS_AUTH_CONFIG.supabaseKey,
      Authorization: `Bearer ${PS_AUTH_CONFIG.supabaseKey}`
    };
  }

  function authHeaders(){
    const token = getAccessToken();
    return {
      apikey: PS_AUTH_CONFIG.supabaseKey,
      Authorization: `Bearer ${token || PS_AUTH_CONFIG.supabaseKey}`
    };
  }

  function getSession(){
    try{
      const session = JSON.parse(localStorage.getItem(sessionKey) || 'null');
      if(!session?.access_token) return null;
      if(session.expires_at && Date.now() > Number(session.expires_at) * 1000){
        return session; // on garde la session : Supabase peut encore accepter le refresh plus tard.
      }
      return session;
    }catch{
      return null;
    }
  }

  function saveSession(session){
    if(!session?.access_token) return null;
    const normalized = {
      access_token: session.access_token,
      refresh_token: session.refresh_token || null,
      expires_at: session.expires_at || null,
      user: session.user || null
    };
    localStorage.setItem(sessionKey, JSON.stringify(normalized));
    return normalized;
  }

  function getAccessToken(){
    return getSession()?.access_token || null;
  }

  function getAuthUser(){
    return getSession()?.user || null;
  }

  async function fetchAuthUser(accessToken=getAccessToken()){
    if(!enabled() || !accessToken) return null;
    try{
      const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/auth/v1/user`, {
        headers:{apikey: PS_AUTH_CONFIG.supabaseKey, Authorization:`Bearer ${accessToken}`},
        cache:'no-store'
      });
      const data = await response.json().catch(() => null);
      return response.ok ? data : null;
    }catch(error){
      console.error('PSAuth user fetch error', error);
      return null;
    }
  }

  async function hydrateStoredSessionUser(){
    const session = getSession();
    if(!session?.access_token) return null;
    if(session.user?.id) return session;

    const user = await fetchAuthUser(session.access_token);
    if(!user?.id) return session;

    return saveSession({...session, user});
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

  async function hydrateFromAuthRedirect(){
    const authParams = readAuthParamsFromUrl();
    if(!authParams?.access_token) return null;

    const user = await fetchAuthUser(authParams.access_token);
    const session = saveSession({...authParams, user});

    if(user?.id){
      const pending = getPendingProfile(user.email);
      const pseudo = user.user_metadata?.pseudo || pending?.pseudo || user.email?.split('@')[0] || 'Spectateur';
      const avatar = user.user_metadata?.avatar || pending?.avatar || pickAvatar(pseudo);
      await ensureViewerProfile({pseudo, avatar});
    }

    if(window.history?.replaceState){
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search.replace(/[?&](access_token|refresh_token|expires_at|expires_in|token_type|type)=[^&]*/g, ''));
      if(window.location.hash) window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }

    return session;
  }

  function loadViewer(){
    try{return JSON.parse(localStorage.getItem(viewerKey) || 'null');}
    catch{return null;}
  }

  function saveViewer(viewer){
    if(viewer?.id) localStorage.setItem(viewerKey, JSON.stringify(viewer));
    updateNav();
  }

  function clearLocal(){
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(viewerKey);
    updateNav();
  }

  async function signUp({email, password, pseudo, avatar}){
    if(!enabled()) return {ok:false, message:'Supabase est indisponible.'};

    const wantedPseudo = cleanPseudo(pseudo);
    if(!isValidPseudo(wantedPseudo)){
      return {ok:false, message:'Pseudo invalide : 2 à 32 caractères, lettres, chiffres, espaces, tirets et underscores uniquement.'};
    }

    const alreadyTaken = await fetchViewerByPseudo(wantedPseudo);
    if(alreadyTaken){
      return {ok:false, message:`Le pseudo « ${wantedPseudo} » est déjà utilisé. Choisis-en un autre, le trône est occupé.`};
    }

    const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/auth/v1/signup`, {
      method:'POST',
      headers:{...anonHeaders(), 'Content-Type':'application/json'},
      body: JSON.stringify({
        email,
        password,
        data:{pseudo:wantedPseudo, avatar}
      })
    });
    const data = await response.json().catch(() => null);
    if(!response.ok){
      return {ok:false, message: authErrorMessage(data)};
    }

    localStorage.setItem(pendingKey, JSON.stringify({email, pseudo:wantedPseudo, avatar}));

    if(data?.access_token){
      saveSession(data);
      const viewer = await ensureViewerProfile({pseudo:wantedPseudo, avatar});
      return {ok:true, session:data, viewer, needsEmailConfirmation:false};
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
    if(!response.ok){
      return {ok:false, message: authErrorMessage(data)};
    }

    saveSession(data);
    const pending = getPendingProfile(email);
    const fallbackPseudo = data?.user?.user_metadata?.pseudo || pending?.pseudo || email.split('@')[0] || 'Spectateur';
    const fallbackAvatar = data?.user?.user_metadata?.avatar || pending?.avatar || pickAvatar(fallbackPseudo);
    const viewer = await ensureViewerProfile({pseudo:fallbackPseudo, avatar:fallbackAvatar});
    if(!viewer){
      return {ok:false, message:'Connexion réussie, mais le profil public n’a pas pu être créé. Vérifie que le pseudo choisi est disponible.'};
    }
    return {ok:true, session:data, viewer};
  }

  async function signOut(){
    const token = getAccessToken();
    if(enabled() && token){
      await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/auth/v1/logout`, {
        method:'POST',
        headers:{...authHeaders(), 'Content-Type':'application/json'}
      }).catch(() => null);
    }
    clearLocal();
    return true;
  }

  async function ensureViewerProfile({pseudo, avatar}={}){
    const user = getAuthUser();
    if(!user?.id) return null;

    const existing = await fetchViewerByAuth(user.id);
    if(existing){
      const viewer = normalizeViewer(existing);
      saveViewer(viewer);
      await patchViewer(viewer.id, {last_seen:new Date().toISOString()});
      return viewer;
    }

    const safePseudo = cleanPseudo(pseudo || user.user_metadata?.pseudo || user.email?.split('@')[0] || 'Spectateur');
    if(!isValidPseudo(safePseudo)){
      return null;
    }

    const taken = await fetchViewerByPseudo(safePseudo);
    if(taken){
      return null;
    }

    const payload = {
      auth_user_id: user.id,
      pseudo: safePseudo,
      avatar: avatar || pickAvatar(safePseudo),
      role: 'viewer',
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    };

    const created = await insertViewer(payload);
    if(created){
      const viewer = normalizeViewer(created);
      saveViewer(viewer);
      return viewer;
    }

    return null;
  }

  async function fetchViewerByAuth(authUserId){
    const result = await restSelect('viewers', `auth_user_id=eq.${encodeURIComponent(authUserId)}&select=id,auth_user_id,pseudo,avatar,role,created_at,last_seen&limit=1`, true);
    return result.ok && Array.isArray(result.data) ? result.data[0] : null;
  }

  async function fetchViewerByPseudo(pseudo){
    const result = await restSelect('viewers', `pseudo=eq.${encodeURIComponent(pseudo)}&select=id,pseudo&limit=1`, false);
    return result.ok && Array.isArray(result.data) ? result.data[0] : null;
  }

  async function insertViewer(payload){
    const result = await restWrite('viewers', 'POST', '', payload, true, 'return=representation');
    return result.ok && Array.isArray(result.data) ? result.data[0] : null;
  }

  async function patchViewer(id, payload){
    if(!id) return false;
    const result = await restWrite('viewers', 'PATCH', `id=eq.${encodeURIComponent(id)}`, payload, true, 'return=minimal');
    return result.ok;
  }

  async function restSelect(table, query, useAuth=false){
    if(!enabled()) return {ok:false, data:null};
    try{
      const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/rest/v1/${table}?${query}`, {
        headers:{...(useAuth ? authHeaders() : anonHeaders()), 'Cache-Control':'no-cache'},
        cache:'no-store'
      });
      const data = await response.json().catch(() => null);
      return {ok:response.ok, data, status:response.status};
    }catch(error){
      console.error('PSAuth REST SELECT error', error);
      return {ok:false, data:null};
    }
  }

  async function restWrite(table, method, filter, payload, useAuth=true, prefer='return=minimal'){
    if(!enabled()) return {ok:false, data:null};
    const suffix = filter ? `?${filter}` : '';
    try{
      const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/rest/v1/${table}${suffix}`, {
        method,
        headers:{...(useAuth ? authHeaders() : anonHeaders()), 'Content-Type':'application/json', Prefer:prefer},
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      return {ok:response.ok, data, status:response.status};
    }catch(error){
      console.error('PSAuth REST WRITE error', error);
      return {ok:false, data:null};
    }
  }

  async function findAvailablePseudo(basePseudo){
    let candidate = cleanPseudo(basePseudo) || `Spectateur ${Math.floor(1000 + Math.random() * 9000)}`;
    for(let i = 0; i < 8; i += 1){
      const exists = await fetchViewerByPseudo(candidate);
      if(!exists) return candidate;
      candidate = `${basePseudo.slice(0, 24)}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return `Spectateur ${Date.now().toString().slice(-5)}`;
  }

  function getPendingProfile(email){
    try{
      const pending = JSON.parse(localStorage.getItem(pendingKey) || 'null');
      return pending?.email === email ? pending : null;
    }catch{return null;}
  }

  async function getCurrentViewer(){
    await hydrateFromAuthRedirect();
    const session = await hydrateStoredSessionUser();
    const user = session?.user || getAuthUser();
    if(!user?.id) return null;
    const local = loadViewer();
    if(local?.auth_user_id === user.id) return local;
    return ensureViewerProfile({});
  }

  function normalizeViewer(row){
    return {
      id: row.id,
      auth_user_id: row.auth_user_id || getAuthUser()?.id || null,
      pseudo: row.pseudo || 'Spectateur',
      avatar: row.avatar || pickAvatar(row.pseudo || 'Spectateur'),
      role: row.role || 'viewer',
      created_at: row.created_at || null,
      authenticated: Boolean(row.auth_user_id || getAuthUser()?.id)
    };
  }

  function cleanPseudo(value=''){
    return String(value).normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 32);
  }

  function isValidPseudo(value=''){
    const pseudo = cleanPseudo(value);
    return /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _-]{2,32}$/.test(pseudo);
  }

  function pickAvatar(seed=''){
    const avatars = ['🪐','🚀','👾','🤖','🦊','🐼','🐙','🦉','🎬','🍿','🌙','⚡'];
    const score = String(seed).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return avatars[score % avatars.length];
  }

  function authErrorMessage(data){
    const message = String(data?.msg || data?.message || data?.error_description || data?.error || 'Erreur inconnue.');
    if(/invalid login/i.test(message)) return 'Identifiants incorrects.';
    if(/already registered|already been registered|user already/i.test(message)) return 'Cette adresse email possède déjà un compte.';
    if(/password/i.test(message)) return 'Mot de passe refusé. Il doit être plus solide.';
    return message;
  }

  function escapeHtml(str=''){
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }

  function updateNav(){
    const link = document.querySelector('#accountNavLink');
    if(!link) return;

    const viewer = loadViewer();
    const user = getAuthUser();
    const connected = Boolean(user && viewer?.pseudo && viewer?.auth_user_id === user.id);

    if(connected){
      link.href = '#';
      link.innerHTML = `<span class="account-avatar">${escapeHtml(viewer.avatar || '👤')}</span><span>${escapeHtml(viewer.pseudo)}</span><span class="account-chevron">▾</span>`;
      link.classList.add('is-connected');
      link.setAttribute('aria-haspopup', 'true');
      link.setAttribute('aria-expanded', 'false');
      ensureAccountDropdown(link, viewer);
    }else if(user){
      link.href = 'account.html';
      link.textContent = '👤 Finaliser mon compte';
      link.classList.add('is-connected');
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
        <span class="viewer-avatar">${escapeHtml(viewer.avatar || '👤')}</span>
        <div>
          <strong>${escapeHtml(viewer.pseudo)}</strong>
          <small>${escapeHtml(viewer.role || 'viewer')}</small>
        </div>
      </div>
      <a href="account.html">⭐ Mon profil</a>
      <a href="index.html#catalogue">❤️ Mes favoris</a>
      <a href="watch.html">🎬 Mon historique</a>
      <a href="account.html#mes-critiques">💬 Mes critiques</a>
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
        if(location.pathname.endsWith('/account.html') || location.pathname.endsWith('account.html')){
          location.reload();
        }
        return;
      }

      if(menu && !event.target.closest('.account-menu-wrap')){
        menu.classList.remove('is-open');
        document.querySelector('#accountNavLink')?.setAttribute('aria-expanded', 'false');
      }
    });
  }


  document.addEventListener('DOMContentLoaded', async () => {
    bindAccountMenu();
    await hydrateFromAuthRedirect();
    await hydrateStoredSessionUser();
    updateNav();
  });

  return {
    enabled,
    signUp,
    signIn,
    signOut,
    getSession,
    hydrateFromAuthRedirect,
    hydrateStoredSessionUser,
    getAccessToken,
    getAuthUser,
    getCurrentViewer,
    loadViewer,
    saveViewer,
    clearLocal,
    authHeaders,
    anonHeaders,
    pickAvatar,
    escapeHtml,
    cleanPseudo,
    isValidPseudo,
    updateNav
  };
})();
