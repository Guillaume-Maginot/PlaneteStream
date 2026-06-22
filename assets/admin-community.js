/* Planète Stream · Administration communauté
   Phase 1 : hall de lecture. Aucune action destructive, aucun bouton rouge.
*/
(function initAdminCommunity(){
  const state = {
    viewers: [],
    filtered: [],
    selectedId: null,
    loaded: false,
    loading: false
  };

  const els = {
    module: document.querySelector('[data-admin-module="communaute"]'),
    list: document.querySelector('#viewerList'),
    detail: document.querySelector('#viewerDetail'),
    search: document.querySelector('#viewerSearch'),
    total: document.querySelector('#communityTotal'),
    staff: document.querySelector('#communityStaff'),
    banned: document.querySelector('#communityBanned'),
    activeToday: document.querySelector('#communityActiveToday')
  };

  if(!els.module || !els.list) return;

  els.search?.addEventListener('input', () => {
    filterViewers();
    renderList();
  });

  document.querySelectorAll('[data-admin-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      if(tab.dataset.adminTab === 'communaute') loadViewersOnce();
    });
  });

  async function loadViewersOnce(){
    if(state.loaded || state.loading) return;
    state.loading = true;
    renderListMessage('Chargement des membres de l’Anneau Orbital…');

    try{
      await waitForPS();
      const query = [
        'select=id,pseudo,avatar,created_at,last_seen,auth_user_id,role,badge,banned_at',
        'order=created_at.asc'
      ].join('&');
      const result = await window.PS.auth.restSelect('viewers', query, {auth:true});

      if(!result.ok || !Array.isArray(result.data)){
        throw new Error(`Lecture viewers impossible (${result.status || 'réponse inconnue'})`);
      }

      state.viewers = result.data.map(normalizeViewer);
      state.filtered = [...state.viewers];
      state.selectedId = state.filtered[0]?.id || null;
      state.loaded = true;
      renderStats();
      renderList();
      renderDetail(getSelectedViewer());
    }catch(error){
      console.error('Admin community load error', error);
      renderListMessage(`Impossible de charger les viewers. ${escapeHtml(error.message || '')}`);
      if(els.detail){
        els.detail.innerHTML = `
          <h2>Fiche viewer</h2>
          <p>Le module est prêt, mais Supabase n’a pas répondu correctement.</p>
          <div class="admin-empty">${escapeHtml(error.message || 'Erreur inconnue')}</div>
        `;
      }
    }finally{
      state.loading = false;
    }
  }

  function normalizeViewer(viewer={}){
    return {
      id: viewer.id || '',
      pseudo: viewer.pseudo || 'Viewer inconnu',
      avatar: viewer.avatar || 'orbiteur',
      created_at: viewer.created_at || null,
      last_seen: viewer.last_seen || null,
      auth_user_id: viewer.auth_user_id || '',
      role: String(viewer.role || 'viewer').toLowerCase(),
      badge: String(viewer.badge || 'none').toLowerCase(),
      banned_at: viewer.banned_at || null
    };
  }

  function filterViewers(){
    const term = String(els.search?.value || '').trim().toLowerCase();
    if(!term){
      state.filtered = [...state.viewers];
      return;
    }
    state.filtered = state.viewers.filter(viewer => [
      viewer.pseudo,
      viewer.role,
      viewer.badge,
      roleLabel(viewer.role),
      badgeLabel(viewer.badge),
      viewer.banned_at ? 'banni' : 'actif'
    ].some(value => String(value || '').toLowerCase().includes(term)));

    if(!state.filtered.some(viewer => viewer.id === state.selectedId)){
      state.selectedId = state.filtered[0]?.id || null;
      renderDetail(getSelectedViewer());
    }
  }

  function renderStats(){
    const today = new Date().toISOString().slice(0, 10);
    const total = state.viewers.length;
    const staff = state.viewers.filter(v => ['admin','moderator'].includes(v.role)).length;
    const banned = state.viewers.filter(v => Boolean(v.banned_at)).length;
    const activeToday = state.viewers.filter(v => String(v.last_seen || '').startsWith(today)).length;

    setText(els.total, total);
    setText(els.staff, staff);
    setText(els.banned, banned);
    setText(els.activeToday, activeToday);
  }

  function renderList(){
    if(!state.filtered.length){
      renderListMessage('Aucun viewer ne correspond à cette recherche. Même l’orbite est vide.');
      return;
    }

    els.list.innerHTML = state.filtered.map(viewer => `
      <button class="viewer-item ${viewer.id === state.selectedId ? 'is-active' : ''}" type="button" data-viewer-id="${escapeAttr(viewer.id)}">
        ${avatarHtml(viewer.avatar)}
        <span class="viewer-main">
          <strong>${escapeHtml(viewer.pseudo)}</strong>
          <span>${escapeHtml(roleLabel(viewer.role))} · ${escapeHtml(badgeLabel(viewer.badge))}</span>
        </span>
        <span class="viewer-chip ${viewer.banned_at ? 'is-danger' : ''}">${viewer.banned_at ? 'Banni' : 'Actif'}</span>
      </button>
    `).join('');

    els.list.querySelectorAll('[data-viewer-id]').forEach(button => {
      button.addEventListener('click', () => {
        state.selectedId = button.dataset.viewerId;
        renderList();
        renderDetail(getSelectedViewer());
      });
    });
  }

  function renderDetail(viewer){
    if(!els.detail) return;
    if(!viewer){
      els.detail.innerHTML = `
        <h2>Fiche viewer</h2>
        <p>Sélectionne un membre pour afficher son profil d’administration.</p>
        <div class="admin-empty">Aucun viewer sélectionné pour le moment.</div>
      `;
      return;
    }

    els.detail.innerHTML = `
      <div class="viewer-detail-head">
        ${avatarHtml(viewer.avatar)}
        <span class="viewer-detail-title">
          <strong>${escapeHtml(viewer.pseudo)}</strong>
          <span>${escapeHtml(roleLabel(viewer.role))} · ${escapeHtml(badgeLabel(viewer.badge))}</span>
        </span>
      </div>

      <div class="viewer-detail-grid">
        ${field('Rôle technique', roleLabel(viewer.role), viewer.role)}
        ${field('Badge public', badgeLabel(viewer.badge), viewer.badge)}
        ${field('Avatar', avatarLabel(viewer.avatar), viewer.avatar)}
        ${field('État', viewer.banned_at ? 'Banni' : 'Actif', viewer.banned_at ? formatDate(viewer.banned_at) : 'banned_at = NULL')}
        ${field('Inscription', formatDate(viewer.created_at), viewer.created_at || '—')}
        ${field('Dernière activité', formatDate(viewer.last_seen), viewer.last_seen || '—')}
        ${field('Viewer ID', viewer.id, '')}
        ${field('Auth user ID', viewer.auth_user_id || '—', '')}
      </div>

      <div class="community-note">
        Phase 1 : consultation uniquement. Les actions de rôle, badge et bannissement arriveront à la prochaine passe,
        avec protections contre les clics météorites.
      </div>
    `;
  }

  function getSelectedViewer(){
    return state.viewers.find(viewer => viewer.id === state.selectedId) || null;
  }

  function renderListMessage(message){
    els.list.innerHTML = `<div class="admin-empty">${message}</div>`;
  }

  function field(label, value, hint=''){
    return `
      <div class="viewer-detail-field">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || '—')}</strong>
        ${hint ? `<small>${escapeHtml(hint)}</small>` : ''}
      </div>
    `;
  }

  function roleLabel(role='viewer'){
    if(window.PS?.auth?.roleLabel) return window.PS.auth.roleLabel(role);
    const key = String(role || 'viewer').toLowerCase();
    if(key === 'admin') return 'Fondateur';
    if(key === 'moderator') return 'Modérateur';
    return 'Planétien';
  }

  function badgeLabel(badge='none'){
    const key = String(badge || 'none').toLowerCase();
    const labels = {
      none: 'Aucun badge',
      founder: 'Fondateur',
      fondateur: 'Fondateur',
      moderator: 'Modérateur',
      moderateur: 'Modérateur',
      vip: 'VIP',
      supporter: 'Supporter',
      beta: 'Bêta testeur'
    };
    return labels[key] || key;
  }

  function avatarLabel(avatar){
    return window.PS?.auth?.avatarLabel ? window.PS.auth.avatarLabel(avatar) : avatar || 'Orbiteur';
  }

  function avatarHtml(avatar){
    if(window.PS?.auth?.avatarHtml) return window.PS.auth.avatarHtml(avatar, 'viewer-avatar-admin');
    return `<span class="viewer-avatar-admin">${escapeHtml(avatar || '🪐')}</span>`;
  }

  function formatDate(value){
    if(!value) return '—';
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function setText(element, value){
    if(element) element.textContent = String(value);
  }

  function escapeHtml(str=''){
    if(window.PS?.auth?.escapeHtml) return window.PS.auth.escapeHtml(str);
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }

  function escapeAttr(str=''){
    return escapeHtml(str).replace(/`/g, '&#096;');
  }

  function waitForPS(){
    if(window.PS?.auth?.restSelect) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        if(window.PS?.auth?.restSelect){
          clearInterval(timer);
          resolve();
        }
        if(tries > 80){
          clearInterval(timer);
          reject(new Error('Le module auth.js n’est pas disponible.'));
        }
      }, 50);
    });
  }
})();
