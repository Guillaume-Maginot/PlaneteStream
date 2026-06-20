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
    const response = await fetch(`${PS_AUTH_CONFIG.supabaseUrl}/auth/v1/signup`, {
      method:'POST',
      headers:{...anonHeaders(), 'Content-Type':'application/json'},
      body: JSON.stringify({
        email,
        password,
        data:{pseudo, avatar}
      })
    });
    const data = await response.json().catch(() => null);
    if(!response.ok){
      return {ok:false, message: authErrorMessage(data)};
    }

    localStorage.setItem(pendingKey, JSON.stringify({email, pseudo, avatar}));

    if(data?.access_token){
      saveSession(data);
      const viewer = await ensureViewerProfile({pseudo, avatar});
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

    const safePseudo = await findAvailablePseudo(cleanPseudo(pseudo || user.email?.split('@')[0] || 'Spectateur'));
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
    const user = getAuthUser();
    if(!user?.id) return null;
    const local = loadViewer();
    if(local?.auth_user_id === user.id || local?.id) return local;
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
    return String(value).trim().replace(/\s+/g, ' ').slice(0, 32);
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
    if(user && viewer?.pseudo){
      link.textContent = `${viewer.avatar || '👤'} ${viewer.pseudo}`;
      link.classList.add('is-connected');
    }else if(user){
      link.textContent = '👤 Mon compte';
      link.classList.add('is-connected');
    }else{
      link.textContent = 'Créer un compte / Se connecter';
      link.classList.remove('is-connected');
    }
  }

  document.addEventListener('DOMContentLoaded', updateNav);

  return {
    enabled,
    signUp,
    signIn,
    signOut,
    getSession,
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
    updateNav
  };
})();
