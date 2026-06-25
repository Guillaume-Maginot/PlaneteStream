/* Planète Stream · garde d'accès admin */
(function(){
  const LOGIN_URL = 'admin-login.html';
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
    return ADMIN_ROLES.has(role)
      || ADMIN_BADGES.has(badge)
      || ADMIN_AVATARS.has(avatar)
      || (pseudo === 'spoofle' && ADMIN_ROLES.has(role));
  }

  function goLogin(reason){
    const url = new URL(LOGIN_URL, window.location.href);
    url.searchParams.set('next', 'admin.html');
    if(reason) url.searchParams.set(reason, '1');
    window.location.replace(url.toString());
  }

  async function run(){
    try{
      await window.PS?.ready;
      const state = window.PS?.getState?.() || {};
      const viewer = state.viewer || window.PS?.loadViewer?.();
      const connected = Boolean(state.isAuthenticated && viewer?.auth_user_id === state.user?.id);

      if(!connected){
        goLogin('login');
        return;
      }

      if(!isAdminViewer(viewer)){
        goLogin('denied');
        return;
      }

      window.PSAdminAccessGranted = true;
      document.body.classList.remove('admin-locked');
      document.body.classList.add('admin-ready');
      window.dispatchEvent(new CustomEvent('ps:admin-access-granted', {detail:{viewer}}));
    }catch(error){
      console.error('Admin guard error', error);
      goLogin('login');
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true});
  else run();
})();
