/* Planète Stream · Administration communauté
   Phase 2 : première commande douce. Modification du badge public uniquement.
*/
(function initAdminCommunity(){
  const state = {
    viewers: [],
    filtered: [],
    selectedId: null,
    loaded: false,
    loading: false,
    savingBadge: false,
    notice: ''
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

  const BADGE_OPTIONS = [
    {value:'none', label:'Aucun badge'},
    {value:'founder', label:'Fondateur'},
    {value:'moderator', label:'Modérateur'},
    {value:'vip', label:'VIP'},
    {value:'supporter', label:'Supporter'},
    {value:'beta', label:'Bêta testeur'}
  ];

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
      const ps = getPS();
      const result = await ps.restSelect('viewers', query, {auth:false});

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
    const staff = state.viewers.filter(v => ['admin','founder','moderator'].includes(v.role)).length;
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
        ${field('Rôle', roleLabel(viewer.role))}
        ${field('Badge public', badgeLabel(viewer.badge))}
        ${field('Avatar', avatarLabel(viewer.avatar))}
        ${field('État', statusLabel(viewer))}
        ${field('Inscription', formatDate(viewer.created_at))}
        ${field('Dernière activité', formatDate(viewer.last_seen))}
      </div>

      ${renderBadgeEditor(viewer)}
      ${state.notice ? `<div class="community-notice">${escapeHtml(state.notice)}</div>` : ''}

      <div class="community-note">
        Phase 2 : première commande active. Seul le badge public est modifiable pour valider l’écriture Supabase sans toucher aux rôles ni aux bannissements.
      </div>
    `;

    bindBadgeEditor(viewer);
  }

  function renderBadgeEditor(viewer){
    if(!canManageBadges()){
      return `
        <div class="community-action-panel is-disabled">
          <div>
            <span>Badge public</span>
            <strong>${escapeHtml(badgeLabel(viewer.badge))}</strong>
          </div>
          <p>Connecte-toi avec un compte staff pour modifier les badges.</p>
        </div>
      `;
    }

    const options = BADGE_OPTIONS.map(option => `
      <option value="${escapeAttr(option.value)}" ${option.value === viewer.badge ? 'selected' : ''}>${escapeHtml(option.label)}</option>
    `).join('');

    return `
      <div class="community-action-panel">
        <label for="viewerBadgeSelect">
          <span>Badge public</span>
          <strong>Première commande de la station</strong>
        </label>
        <div class="community-action-row">
          <select id="viewerBadgeSelect" ${state.savingBadge ? 'disabled' : ''}>${options}</select>
          <button class="primary" id="saveViewerBadge" type="button" ${state.savingBadge ? 'disabled' : ''}>
            ${state.savingBadge ? 'Enregistrement…' : 'Enregistrer le badge'}
          </button>
        </div>
      </div>
    `;
  }

  function bindBadgeEditor(viewer){
    const button = document.querySelector('#saveViewerBadge');
    const select = document.querySelector('#viewerBadgeSelect');
    if(!button || !select || !viewer) return;

    button.addEventListener('click', async () => {
      const nextBadge = String(select.value || 'none').toLowerCase();
      if(nextBadge === viewer.badge){
        state.notice = 'Badge inchangé. Le bouton a cliqué dans le vide spatial, mais avec dignité.';
        renderDetail(viewer);
        return;
      }
      await saveBadge(viewer, nextBadge);
    });
  }

  async function saveBadge(viewer, nextBadge){
    if(!viewer?.id || state.savingBadge) return;
    state.savingBadge = true;
    state.notice = '';
    renderDetail(viewer);

    try{
      await waitForPS();
      const ps = getPS();
      if(!ps.restWrite) throw new Error('restWrite indisponible dans auth.js.');

      const result = await ps.restWrite(
        'viewers',
        'PATCH',
        `id=eq.${encodeURIComponent(viewer.id)}`,
        {badge: nextBadge},
        {auth:true, prefer:'return=minimal'}
      );

      if(!result.ok){
        throw new Error(`Supabase a refusé la mise à jour du badge (${result.status || 'statut inconnu'}).`);
      }

      state.viewers = state.viewers.map(item => item.id === viewer.id ? {...item, badge: nextBadge} : item);
      filterViewers();
      state.selectedId = viewer.id;
      state.notice = `Badge mis à jour : ${badgeLabel(nextBadge)}.`;
      renderStats();
      renderList();
      renderDetail(getSelectedViewer());
    }catch(error){
      console.error('Admin community badge update error', error);
      state.notice = `${error.message || 'Impossible de mettre à jour le badge.'} Vérifie que le compte connecté possède un rôle autorisé par les policies Supabase.`;
      renderDetail(getSelectedViewer() || viewer);
    }finally{
      state.savingBadge = false;
      renderDetail(getSelectedViewer() || viewer);
    }
  }

  function canManageBadges(){
    const ps = getPS(false);
    const role = String(ps?.getState?.().viewer?.role || ps?.state?.viewer?.role || '').toLowerCase();
    return ['admin','founder','moderator'].includes(role);
  }

  function getSelectedViewer(){
    return state.viewers.find(viewer => viewer.id === state.selectedId) || null;
  }

  function renderListMessage(message){
    els.list.innerHTML = `<div class="admin-empty">${message}</div>`;
  }

  function field(label, value){
    return `
      <div class="viewer-detail-field">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || '—')}</strong>
      </div>
    `;
  }

  function statusLabel(viewer){
    if(viewer?.banned_at) return `🔴 Banni depuis ${formatDate(viewer.banned_at)}`;
    return '🟢 Actif';
  }

  function roleLabel(role='viewer'){
    const key = String(role || 'viewer').toLowerCase();
    if(key === 'admin' || key === 'founder') return 'Fondateur';
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
    const ps = getPS(false);
    return ps?.avatarLabel ? ps.avatarLabel(avatar) : avatar || 'Orbiteur';
  }

  function avatarHtml(avatar){
    const ps = getPS(false);
    if(ps?.avatarHtml) return ps.avatarHtml(avatar, 'viewer-avatar-admin');
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
    const ps = getPS(false);
    if(ps?.escapeHtml) return ps.escapeHtml(str);
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }

  function escapeAttr(str=''){
    return escapeHtml(str).replace(/`/g, '&#096;');
  }

  function getPS(required=true){
    const ps = window.PS?.restSelect ? window.PS : (window.PSAuth?.restSelect ? window.PSAuth : null);
    if(required && !ps) throw new Error('Le module auth.js est chargé, mais l’API Planète Stream n’est pas disponible.');
    return ps;
  }

  function waitForPS(){
    if(getPS(false)?.restSelect) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        if(getPS(false)?.restSelect){
          clearInterval(timer);
          resolve();
        }
        if(tries > 80){
          clearInterval(timer);
          reject(new Error('Le module auth.js n’est pas disponible ou n’expose pas restSelect.'));
        }
      }, 50);
    });
  }
})();
