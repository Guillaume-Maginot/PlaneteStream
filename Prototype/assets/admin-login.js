/* Planète Stream · connexion admin */
(function(){
  const form = document.querySelector('#adminLoginForm');
  const email = document.querySelector('#adminEmail');
  const password = document.querySelector('#adminPassword');
  const status = document.querySelector('#adminLoginStatus');
  const denied = document.querySelector('#adminDeniedNotice');
  const access = document.querySelector('#adminAccessNotice');
  const submit = document.querySelector('#adminLoginSubmit');

  const ADMIN_ROLES = new Set(['admin','founder']);
  const ADMIN_BADGES = new Set(['architecte','architect','founder','fondateur']);
  const ADMIN_AVATARS = new Set(['architecte','architect','fondateur']);

  function normalize(value){ return String(value || '').toLowerCase().trim(); }
  function isAdminViewer(viewer){
    if(!viewer) return false;
    const role = normalize(viewer.role);
    const badge = normalize(viewer.badge);
    const avatar = normalize(viewer.avatar);
    const pseudo = normalize(viewer.pseudo);
    return ADMIN_ROLES.has(role) || ADMIN_BADGES.has(badge) || ADMIN_AVATARS.has(avatar) || (pseudo === 'spoofle' && ADMIN_ROLES.has(role));
  }
  function setStatus(message, type='info'){
    if(!status) return;
    status.textContent = message || '';
    status.className = `admin-login-status is-${type}`;
    status.hidden = !message;
  }
  function nextUrl(){
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || 'admin.html';
    return next.includes('://') ? 'admin.html' : next;
  }
  async function maybeRedirectExisting(){
    await window.PS?.ready;
    const state = window.PS?.getState?.() || {};
    const viewer = state.viewer || window.PS?.loadViewer?.();
    if(state.isAuthenticated && viewer?.auth_user_id === state.user?.id && isAdminViewer(viewer)){
      setStatus('Identité déjà vérifiée. Ouverture du centre de contrôle…', 'success');
      window.setTimeout(() => window.location.replace(nextUrl()), 350);
    }
  }

  const params = new URLSearchParams(window.location.search);
  if(params.has('denied')) denied?.removeAttribute('hidden');
  if(params.has('login')) access?.removeAttribute('hidden');

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const mail = email?.value.trim();
    const pass = password?.value || '';
    if(!mail || !pass){
      setStatus('Adresse e-mail et mot de passe nécessaires pour ouvrir le sas.', 'error');
      return;
    }
    submit?.setAttribute('disabled', 'disabled');
    setStatus('Connexion sécurisée… vérification de l’équipage.', 'info');
    try{
      await window.PS?.ready;
      const result = await window.PS.signIn({email:mail, password:pass});
      if(!result.ok) throw new Error(result.message || 'Connexion impossible.');
      const viewer = result.viewer || window.PS.getState?.().viewer || window.PS.loadViewer?.();
      if(!isAdminViewer(viewer)){
        setStatus('Compte reconnu, mais sans autorisation administrative.', 'error');
        return;
      }
      setStatus('✓ Identité vérifiée · ✓ Droits confirmés · ouverture du centre de contrôle…', 'success');
      window.setTimeout(() => window.location.replace(nextUrl()), 650);
    }catch(error){
      console.error('Admin login error', error);
      setStatus(error.message || 'Connexion refusée.', 'error');
    }finally{
      submit?.removeAttribute('disabled');
    }
  });

  maybeRedirectExisting();
})();
