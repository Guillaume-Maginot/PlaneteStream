/* Planète Stream · Administration communauté
   Phase 4 : rôles, avatars staff et bannissements prudents.
*/
(function initAdminCommunity(){
  const state = {
    viewers: [],
    filtered: [],
    selectedId: null,
    loaded: false,
    loading: false,
    savingBadge: false,
    savingRole: false,
    savingBan: false,
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

  const ROLE_OPTIONS = [
    {value:'viewer', label:'Planétien'},
    {value:'moderator', label:'Modérateur'},
    {value:'admin', label:'Fondateur'}
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
        ${avatarHtml(visibleAvatar(viewer))}
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
        ${avatarHtml(visibleAvatar(viewer))}
        <span class="viewer-detail-title">
          <strong>${escapeHtml(viewer.pseudo)}</strong>
          <span>${escapeHtml(roleLabel(viewer.role))} · ${escapeHtml(badgeLabel(viewer.badge))}</span>
        </span>
      </div>

      <div class="viewer-detail-grid">
        ${field('Rôle', roleLabel(viewer.role))}
        ${field('Badge public', badgeLabel(viewer.badge))}
        ${field('Avatar affiché', avatarLabel(visibleAvatar(viewer)))}
        ${field('État', statusLabel(viewer))}
        ${field('Inscription', formatDate(viewer.created_at))}
        ${field('Dernière activité', formatDate(viewer.last_seen))}
      </div>

      ${renderRoleEditor(viewer)}
      ${renderBadgeEditor(viewer)}
      ${renderBanEditor(viewer)}
      ${state.notice ? `<div class="community-notice">${escapeHtml(state.notice)}</div>` : ''}

      <div class="community-note">
        Phase 4 : rôles, badges, avatars staff et bannissements sont actifs. Les actions sensibles restent protégées par confirmations.
      </div>
    `;

    bindRoleEditor(viewer);
    bindBadgeEditor(viewer);
    bindBanEditor(viewer);
  }


  function renderRoleEditor(viewer){
    const permission = rolePermission(viewer);
    if(!permission.allowed){
      return `
        <div class="community-action-panel is-disabled">
          <div>
            <span>Rôle</span>
            <strong>${escapeHtml(roleLabel(viewer.role))}</strong>
          </div>
          <p>${escapeHtml(permission.reason)}</p>
        </div>
      `;
    }

    const currentValue = technicalRoleValue(viewer.role);
    const options = ROLE_OPTIONS.map(option => `
      <option value="${escapeAttr(option.value)}" ${option.value === currentValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>
    `).join('');

    return `
      <div class="community-action-panel">
        <label for="viewerRoleSelect">
          <span>Rôle</span>
          <strong>Accès, permissions et avatar officiel</strong>
        </label>
        <div class="community-action-row">
          <select id="viewerRoleSelect" ${state.savingRole ? 'disabled' : ''}>${options}</select>
          <button class="primary" id="saveViewerRole" type="button" ${state.savingRole ? 'disabled' : ''}>
            ${state.savingRole ? 'Enregistrement…' : 'Enregistrer le rôle'}
          </button>
        </div>
        <label class="community-inline-check" style="display:flex;gap:10px;align-items:flex-start;margin-top:12px;color:var(--muted);font-size:13px;line-height:1.35;text-transform:none;letter-spacing:0;font-weight:700;">
          <input id="syncRoleBadge" type="checkbox" checked style="margin-top:2px;accent-color:#a855f7;">
          <span style="display:inline;color:var(--muted);font-size:13px;font-weight:700;letter-spacing:0;text-transform:none;margin:0;">Aligner aussi le badge public si le rôle devient Fondateur ou Modérateur.</span>
        </label>
      </div>
    `;
  }

  function bindRoleEditor(viewer){
    const button = document.querySelector('#saveViewerRole');
    const select = document.querySelector('#viewerRoleSelect');
    const syncBadge = document.querySelector('#syncRoleBadge');
    if(!button || !select || !viewer) return;

    button.addEventListener('click', async () => {
      const nextRole = String(select.value || 'viewer').toLowerCase();
      const currentRole = technicalRoleValue(viewer.role);
      if(nextRole === currentRole){
        state.notice = 'Rôle inchangé. Le sas est resté fermé, ce qui est parfois très sain.';
        renderDetail(viewer);
        return;
      }

      const permission = rolePermission(viewer, nextRole);
      if(!permission.allowed){
        state.notice = permission.reason;
        renderDetail(viewer);
        return;
      }

      const message = roleConfirmMessage(viewer, nextRole);
      if(!window.confirm(message)){
        state.notice = 'Changement de rôle annulé.';
        renderDetail(viewer);
        return;
      }

      await saveRole(viewer, nextRole, Boolean(syncBadge?.checked));
    });
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


  async function saveRole(viewer, nextRole, syncBadge=false){
    if(!viewer?.id || state.savingRole) return;
    state.savingRole = true;
    state.notice = '';
    renderDetail(viewer);

    try{
      await waitForPS();
      const ps = getPS();
      if(!ps.restWrite) throw new Error('restWrite indisponible dans auth.js.');

      const payload = {role: nextRole};
      const nextBadge = badgeForRole(nextRole);
      const nextAvatar = officialAvatarForRole(nextRole);

      if(nextAvatar){
        payload.avatar = nextAvatar;
      }else if(isReservedAvatar(viewer.avatar)){
        // Si un ancien staff redevient Planétien, on évite de conserver un emblème réservé.
        payload.avatar = 'orbiteur';
      }

      if(syncBadge && nextBadge && ['none', badgeForRole(viewer.role), viewer.badge].includes(viewer.badge)){
        payload.badge = nextBadge;
      }

      const result = await ps.restWrite(
        'viewers',
        'PATCH',
        `id=eq.${encodeURIComponent(viewer.id)}`,
        payload,
        {auth:true, prefer:'return=minimal'}
      );

      if(!result.ok){
        throw new Error(`Supabase a refusé la mise à jour du rôle (${result.status || 'statut inconnu'}).`);
      }

      state.viewers = state.viewers.map(item => item.id === viewer.id ? {...item, ...payload} : item);
      filterViewers();
      state.selectedId = viewer.id;
      const avatarNotice = payload.avatar ? ` Avatar officiel : ${avatarLabel(payload.avatar)}.` : '';
      state.notice = `${escapePlain(viewer.pseudo)} est désormais ${roleLabel(nextRole)}${payload.badge ? `, avec le badge ${badgeLabel(payload.badge)}` : ''}.${avatarNotice}`;
      renderStats();
      renderList();
      renderDetail(getSelectedViewer());
    }catch(error){
      console.error('Admin community role update error', error);
      state.notice = `${error.message || 'Impossible de mettre à jour le rôle.'} Vérifie que le compte connecté possède le rôle technique admin dans Supabase.`;
      renderDetail(getSelectedViewer() || viewer);
    }finally{
      state.savingRole = false;
      renderDetail(getSelectedViewer() || viewer);
    }
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


  function renderBanEditor(viewer){
    const permission = banPermission(viewer);
    const isBanned = Boolean(viewer?.banned_at);

    if(!permission.allowed){
      return `
        <div class="community-action-panel is-disabled">
          <div>
            <span>Bannissement</span>
            <strong>${isBanned ? 'Viewer banni' : 'Viewer actif'}</strong>
          </div>
          <p>${escapeHtml(permission.reason)}</p>
        </div>
      `;
    }

    if(isBanned){
      return `
        <div class="community-action-panel">
          <label for="unbanViewerBtn">
            <span>Bannissement</span>
            <strong>🔴 Banni depuis ${escapeHtml(formatDate(viewer.banned_at))}</strong>
          </label>
          <div class="community-action-row">
            <p>Réactiver ce compte lui rendra l’accès normal aux fonctions communautaires.</p>
            <button class="primary community-safe-btn" id="unbanViewerBtn" type="button" ${state.savingBan ? 'disabled' : ''}>
              ${state.savingBan ? 'Débannissement…' : 'Débannir'}
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="community-action-panel community-danger-panel">
        <label for="banViewerBtn">
          <span>Bannissement</span>
          <strong>🟢 Compte actif</strong>
        </label>
        <div class="community-action-row">
          <p>Le bannissement bloque le viewer sans supprimer son profil. Action réversible, mais à manier avec des gants orbitaux.</p>
          <button class="primary community-danger-btn" id="banViewerBtn" type="button" ${state.savingBan ? 'disabled' : ''}>
            ${state.savingBan ? 'Bannissement…' : 'Bannir'}
          </button>
        </div>
      </div>
    `;
  }

  function bindBanEditor(viewer){
    const banButton = document.querySelector('#banViewerBtn');
    const unbanButton = document.querySelector('#unbanViewerBtn');
    if(banButton){
      banButton.addEventListener('click', async () => {
        const permission = banPermission(viewer);
        if(!permission.allowed){
          state.notice = permission.reason;
          renderDetail(viewer);
          return;
        }
        const message = `Bannir ${viewer?.pseudo || 'ce viewer'} ?\n\nLe compte ne sera pas supprimé, mais il sera marqué comme banni dans Supabase. Cette action pourra être annulée ensuite.`;
        if(!window.confirm(message)){
          state.notice = 'Bannissement annulé. Le bouton rouge retourne dormir sous son capot.';
          renderDetail(viewer);
          return;
        }
        await saveBanStatus(viewer, true);
      });
    }
    if(unbanButton){
      unbanButton.addEventListener('click', async () => {
        const permission = banPermission(viewer);
        if(!permission.allowed){
          state.notice = permission.reason;
          renderDetail(viewer);
          return;
        }
        const message = `Débannir ${viewer?.pseudo || 'ce viewer'} ?\n\nLe compte retrouvera son état actif.`;
        if(!window.confirm(message)){
          state.notice = 'Débannissement annulé.';
          renderDetail(viewer);
          return;
        }
        await saveBanStatus(viewer, false);
      });
    }
  }

  async function saveBanStatus(viewer, shouldBan){
    if(!viewer?.id || state.savingBan) return;
    state.savingBan = true;
    state.notice = '';
    renderDetail(viewer);

    try{
      await waitForPS();
      const ps = getPS();
      if(!ps.restWrite) throw new Error('restWrite indisponible dans auth.js.');

      const payload = {banned_at: shouldBan ? new Date().toISOString() : null};
      const result = await ps.restWrite(
        'viewers',
        'PATCH',
        `id=eq.${encodeURIComponent(viewer.id)}`,
        payload,
        {auth:true, prefer:'return=minimal'}
      );

      if(!result.ok){
        throw new Error(`Supabase a refusé la mise à jour du bannissement (${result.status || 'statut inconnu'}).`);
      }

      state.viewers = state.viewers.map(item => item.id === viewer.id ? {...item, ...payload} : item);
      filterViewers();
      state.selectedId = viewer.id;
      state.notice = shouldBan
        ? `${escapePlain(viewer.pseudo)} est maintenant banni. Profil conservé, trappe refermée.`
        : `${escapePlain(viewer.pseudo)} est débanni et repasse en statut actif.`;
      renderStats();
      renderList();
      renderDetail(getSelectedViewer());
    }catch(error){
      console.error('Admin community ban update error', error);
      state.notice = `${error.message || 'Impossible de modifier le bannissement.'} Vérifie les droits du compte connecté et les policies Supabase.`;
      renderDetail(getSelectedViewer() || viewer);
    }finally{
      state.savingBan = false;
      renderDetail(getSelectedViewer() || viewer);
    }
  }


  function getCurrentViewer(){
    const ps = getPS(false);
    return ps?.getState?.().viewer || ps?.state?.viewer || null;
  }

  function getCurrentRole(){
    return String(getCurrentViewer()?.role || '').toLowerCase();
  }

  function getCurrentViewerId(){
    return String(getCurrentViewer()?.id || '');
  }

  function isAdminRole(role){
    const key = String(role || '').toLowerCase();
    return key === 'admin' || key === 'founder';
  }

  function technicalRoleValue(role){
    return isAdminRole(role) ? 'admin' : (String(role || 'viewer').toLowerCase() === 'moderator' ? 'moderator' : 'viewer');
  }

  function countAdmins(){
    return state.viewers.filter(viewer => isAdminRole(viewer.role)).length;
  }

  function banPermission(viewer){
    const currentRole = getCurrentRole();
    const currentViewerId = getCurrentViewerId();
    const targetRole = technicalRoleValue(viewer?.role);

    if(!['admin','founder','moderator'].includes(currentRole)){
      return {allowed:false, reason:'Seul le staff peut bannir ou débannir un viewer.'};
    }

    if(currentViewerId && viewer?.id === currentViewerId){
      return {allowed:false, reason:'Tu ne peux pas te bannir toi-même. Même les capitaines ont besoin de garde-fous.'};
    }

    if(targetRole === 'admin'){
      return {allowed:false, reason:'Un Fondateur ne peut pas être banni depuis l’interface. Protection royale activée.'};
    }

    if(currentRole === 'moderator' && targetRole === 'moderator'){
      return {allowed:false, reason:'Un Modérateur ne peut pas bannir un autre Modérateur.'};
    }

    return {allowed:true, reason:''};
  }


  function rolePermission(viewer, nextRole=null){
    const currentRole = getCurrentRole();
    const currentViewerId = getCurrentViewerId();
    const targetRole = technicalRoleValue(viewer?.role);
    const wantedRole = nextRole ? technicalRoleValue(nextRole) : null;

    if(!isAdminRole(currentRole)){
      return {allowed:false, reason:'Seul un Fondateur peut modifier les rôles. Les modérateurs auront leurs propres leviers, mais pas celui-ci.'};
    }

    if(currentViewerId && viewer?.id === currentViewerId){
      return {allowed:false, reason:'Tu ne peux pas modifier ton propre rôle depuis l’interface. Protection anti-auto-éjection activée.'};
    }

    if(wantedRole && targetRole === 'admin' && wantedRole !== 'admin' && countAdmins() <= 1){
      return {allowed:false, reason:'Impossible de rétrograder le dernier Fondateur. La station orbitale refuse de se laisser sans capitaine.'};
    }

    return {allowed:true, reason:''};
  }

  function roleConfirmMessage(viewer, nextRole){
    const name = viewer?.pseudo || 'ce viewer';
    const role = technicalRoleValue(nextRole);
    if(role === 'admin'){
      return `Promouvoir ${name} au rang de Fondateur ?\n\nCette personne obtiendra un accès complet à l’administration Planetestream et recevra l’avatar officiel Fondateur.`;
    }
    if(role === 'moderator'){
      return `Promouvoir ${name} au rang de Modérateur ?\n\nCette personne pourra accéder à la Communauté de l’Anneau Orbital, gérer les viewers simples et recevra l’avatar officiel Modérateur.`;
    }
    return `Repasser ${name} en Planétien ?\n\nCette personne perdra les permissions de staff. Si elle avait un avatar officiel réservé, il sera remplacé par un avatar Planétien par défaut.`;
  }

  function badgeForRole(role){
    const key = technicalRoleValue(role);
    if(key === 'admin') return 'founder';
    if(key === 'moderator') return 'moderator';
    return '';
  }

  function officialAvatarForRole(role){
    const key = technicalRoleValue(role);
    if(key === 'admin') return 'fondateur';
    if(key === 'moderator') return 'moderateur';
    return '';
  }

  function isReservedAvatar(avatar){
    const key = String(avatar || '').toLowerCase();
    return key === 'fondateur' || key === 'founder' || key === 'moderateur' || key === 'moderator';
  }

  function canManageBadges(){
    return ['admin','founder','moderator'].includes(getCurrentRole());
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

  function visibleAvatar(viewer){
    return officialAvatarForRole(viewer?.role) || viewer?.avatar || 'orbiteur';
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

  function escapePlain(str=''){
    return String(str || '');
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
