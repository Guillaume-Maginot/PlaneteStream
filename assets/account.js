const accountState = document.querySelector('#currentViewerState');
const accountStatus = document.querySelector('#accountStatus');
const createForm = document.querySelector('#createAccountForm');
const loginForm = document.querySelector('#loginAccountForm');
const createAvatarInput = document.querySelector('#createAvatar');
const createAvatarGallery = document.querySelector('#createAvatarGallery');
const currentAccountCard = document.querySelector('#currentAccountCard');
const createAccountCard = document.querySelector('#createAccountCard');
const loginAccountCard = document.querySelector('#loginAccountCard');
let realtimeAccountRefreshTimer = null;

function initAccount(){
  initPasswordToggles();
  renderAvatarGallery(createAvatarGallery, createAvatarInput, createAvatarInput?.value || 'orbiteur');
  renderCurrentViewer();

  createForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const email = document.querySelector('#createEmail')?.value.trim();
    const pseudo = document.querySelector('#createPseudo')?.value.trim();
    const password = document.querySelector('#createPassword')?.value;
    const avatar = createAvatarInput?.value || PSAuth.pickAvatar(pseudo);

    if(!validateEmail(email) || !validatePseudo(pseudo) || !validatePassword(password)) return;

    setStatus('Création du compte sécurisé...', 'pending');
    const result = await PSAuth.signUp({email, password, pseudo, avatar});

    if(!result.ok){
      setStatus(result.message || 'Impossible de créer le compte.', 'error');
      return;
    }

    if(result.needsEmailConfirmation){
      setStatus('Compte créé. Vérifie ton email pour confirmer l’inscription, puis connecte-toi. Le pigeon voyageur numérique est parti.', 'ok');
    }else{
      setStatus('Compte créé et connecté. La herse est ouverte pour toi.', 'ok');
    }

    createForm.reset();
    if(createAvatarInput) createAvatarInput.value = 'orbiteur';
    renderAvatarGallery(createAvatarGallery, createAvatarInput, 'orbiteur');
    renderCurrentViewer();
  });

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const email = document.querySelector('#loginEmail')?.value.trim();
    const password = document.querySelector('#loginPassword')?.value;

    if(!validateEmail(email) || !password){
      setStatus('Email et mot de passe requis.', 'error');
      return;
    }

    setStatus('Ouverture du sas sécurisé...', 'pending');
    const result = await PSAuth.signIn({email, password});

    if(!result.ok){
      setStatus(result.message || 'Connexion impossible.', 'error');
      return;
    }

    setStatus('Connexion réussie. Bon retour en orbite.', 'ok');
    loginForm.reset();
    renderCurrentViewer();
  });

  accountState?.addEventListener('click', async event => {
    if(event.target.closest('[data-logout]')){
      await PSAuth.signOut();
      setStatus('Déconnexion effectuée sur ce navigateur.', 'ok');
      renderCurrentViewer();
      return;
    }

    if(event.target.closest('[data-mark-notifications-read]')){
      await markMyNotificationsRead();
      return;
    }

    if(event.target.closest('[data-delete-read-notifications]')){
      await deleteReadNotifications();
      return;
    }

    const deleteOne = event.target.closest('[data-delete-notification]');
    if(deleteOne){
      await deleteNotification(deleteOne.dataset.deleteNotification);
      return;
    }

    const notificationLink = event.target.closest('[data-notification-link]');
    if(notificationLink){
      event.preventDefault();
      await openNotification(notificationLink.dataset.notificationId, notificationLink.getAttribute('href'));
      return;
    }

    const choice = event.target.closest('[data-avatar-choice]');
    if(choice){
      const nextAvatar = choice.dataset.avatarChoice;
      await updateCurrentAvatar(nextAvatar);
    }
  });

  window.addEventListener('ps:notification-realtime', () => {
    clearTimeout(realtimeAccountRefreshTimer);
    realtimeAccountRefreshTimer = setTimeout(() => {
      const active = document.activeElement;
      const preserveFocus = active && accountState?.contains(active) && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
      const scrollY = window.scrollY;
      renderCurrentViewer().then(() => {
        window.scrollTo({top:scrollY});
        if(preserveFocus && active?.focus) active.focus({preventScroll:true});
      }).catch(() => null);
    }, 250);
  });
}

async function renderCurrentViewer(){
  if(!accountState) return;

  const state = await PSAuth.getAuthState();
  const session = state.session;
  const viewer = state.viewer;

  if(state.isAuthenticated && viewer?.pseudo){
    const [stats, recentReviews, ratedMovies, favoriteMovies, notifications] = await Promise.all([
      fetchMyCommunityStats(viewer.id),
      fetchMyRecentReviews(viewer.id, 8),
      fetchMyRatedMovies(viewer.id, 8),
      fetchMyFavoriteMovies(viewer.id, 12),
      fetchMyNotifications(viewer.id, 12)
    ]);
    const journey = await fetchMyJourney(viewer, stats, recentReviews, ratedMovies);
    const score = PSAuth.reputationScore?.(stats) || localReputationScore(stats);
    const level = PSAuth.reputationLevel?.(score) || localReputationLevel(score);
    const badges = PSAuth.badgeDefinitions?.(viewer, stats) || [];
    const visibleAvatar = PSAuth.displayAvatar?.(viewer) || viewer.avatar || 'orbiteur';
    const reserved = PSAuth.isReservedAvatar?.(visibleAvatar) || ['admin','moderator','moderateur','fondateur','founder','architecte'].includes(String(viewer.role || '').toLowerCase()) || String(viewer.badge || '').toLowerCase() === 'architecte';
    const avatarChooser = reserved
      ? `<div class="avatar-reserved-note">Avatar spécial attribué par l’équipe Planète Stream.</div>`
      : `<div class="account-avatar-editor">
          <div class="avatar-gallery compact" aria-label="Changer d'avatar">
            ${avatarButtons(viewer.avatar || 'orbiteur')}
          </div>
        </div>`;

    setAuthenticatedLayout(true);

    accountState.innerHTML = `
      <nav class="space-nav" aria-label="Navigation Mon Espace">
        <a href="#mon-profil">👤 Profil</a>
        <a href="#mes-notifications">📬 Messages</a>
        <a href="#mon-parcours">🚀 Parcours</a>
        <a href="#mes-statistiques">📊 Stats</a>
        <a href="#mes-favoris">❤️ Favoris</a>
        <a href="#mes-critiques">💬 Critiques</a>
        <a href="#mes-avatars">🎭 Avatars</a>
        <a href="#mes-badges">🏅 Badges</a>
        <a href="#parametres">⚙️ Paramètres</a>
      </nav>

      <section class="space-section" id="mon-profil">
        <div class="space-section-head">
          <p class="eyebrow">Mon profil</p>
          <h2>Carte de Planétien</h2>
        </div>
        <div class="planetiens-card space-profile-card">
          <div class="planetiens-head">
            ${PSAuth.avatarHtml(PSAuth.displayAvatar?.(viewer) || viewer.avatar || 'orbiteur', 'viewer-avatar giant')}
            <div>
              <h2>${PSAuth.escapeHtml(viewer.pseudo)}</h2>
              <small>${PSAuth.escapeHtml(PSAuth.avatarLabel?.(PSAuth.displayAvatar?.(viewer) || viewer.avatar) || 'Orbiteur')} · ${PSAuth.escapeHtml(PSAuth.publicTitle?.(viewer) || PSAuth.roleLabel?.(viewer.role) || 'Planétien')}</small>
              <p class="soft-note space-joined">Membre depuis ${formatAccountDateLong(viewer.created_at)}</p>
            </div>
          </div>
          <div class="reputation-panel">
            <div>
              <span>${PSAuth.escapeHtml(level.icon || '🌱')} ${PSAuth.escapeHtml(level.label || 'Nouveau Planétien')}</span>
              <strong>${score} pts</strong>
            </div>
            <div class="reputation-bar"><i style="width:${Math.max(0, Math.min(100, level.progress || 0))}%"></i></div>
          </div>
          <div class="profile-mini-stats account-stat-grid">
            <span><strong>${stats.ratings}</strong><small>films notés</small></span>
            <span><strong>${stats.comments}</strong><small>critiques</small></span>
            <span><strong>${stats.replies}</strong><small>réponses</small></span>
            <span><strong>${stats.likes}</strong><small>likes reçus</small></span>
          </div>
        </div>
      </section>

      <section class="space-section" id="mes-notifications">
        <div class="space-section-head">
          <p class="eyebrow">Messages du Hall</p>
          <h2>Ce qui vous attend</h2>
        </div>
        <div class="space-notification-panel">
          <div class="space-notification-actions">
            <p class="soft-note">Les réponses à vos critiques et messages apparaissent ici. Discret, mais fidèle au poste.</p>
            <div class="space-notification-buttons">
              <button class="ghost" type="button" data-mark-notifications-read ${notifications.unread ? '' : 'disabled'}>Tout marquer comme lu</button>
              <button class="ghost" type="button" data-delete-read-notifications ${notifications.read ? '' : 'disabled'}>Supprimer les messages lus</button>
            </div>
          </div>
          ${notifications.items.length ? `<div class="space-notification-list">${notifications.items.map(renderNotificationItem).join('')}</div>` : '<p class="soft-note">Aucun message pour le moment. Le Hall est calme, presque suspect.</p>'}
        </div>
      </section>

      <section class="space-section" id="mon-parcours">
        <div class="space-section-head">
          <p class="eyebrow">Parcours du Planétien</p>
          <h2>Ton journal de bord</h2>
        </div>
        <div class="journey-shell">
          <div class="journey-hero">
            <div>
              <span class="journey-orbit">🚀</span>
              <h3>${PSAuth.escapeHtml(journey.title)}</h3>
              <p>${PSAuth.escapeHtml(journey.subtitle)}</p>
            </div>
            <div class="journey-next">
              <small>Prochain chapitre</small>
              <strong>${PSAuth.escapeHtml(journey.next.label)}</strong>
              <span>${PSAuth.escapeHtml(journey.next.hint)}</span>
            </div>
          </div>
          <div class="journey-timeline">
            ${journey.events.map(renderJourneyEvent).join('')}
          </div>
          <div class="journey-goals">
            ${journey.goals.map(renderJourneyGoal).join('')}
          </div>
        </div>
      </section>

      <section class="space-section" id="mes-statistiques">
        <div class="space-section-head">
          <p class="eyebrow">Mes statistiques</p>
          <h2>Ce que tu as déjà accompli</h2>
        </div>
        <div class="space-stats-grid">
          ${renderSpaceStat('⭐', stats.ratings, 'films notés')}
          ${renderSpaceStat('💬', stats.comments, 'critiques publiées')}
          ${renderSpaceStat('↩', stats.replies, 'réponses publiées')}
          ${renderSpaceStat('❤️', stats.likes, 'likes reçus')}
          ${renderSpaceStat('🤍', stats.likesGiven, 'likes donnés')}
          ${renderSpaceStat('📌', stats.favorites, 'favoris')}
        </div>
      </section>

      <section class="space-section" id="mes-favoris">
        <div class="space-section-head">
          <p class="eyebrow">Mes favoris</p>
          <h2>Les films mis de côté</h2>
        </div>
        ${favoriteMovies.length ? `<div class="profile-recent account-recent space-list">${favoriteMovies.map(renderAccountFavoriteItem).join('')}</div>` : '<p class="soft-note">Aucun favori pour le moment. Clique sur le cœur d’un film pour le garder sous le coude.</p>'}
      </section>

      <section class="space-section" id="mes-critiques">
        <div class="space-section-head">
          <p class="eyebrow">Mes critiques</p>
          <h2>Retrouver mes avis</h2>
        </div>
        ${recentReviews.length ? `<div class="profile-recent account-recent space-list">${recentReviews.map(renderAccountReviewItem).join('')}</div>` : '<p class="soft-note">Aucune critique publiée pour le moment. Le carnet est propre, presque trop propre.</p>'}
      </section>

      <section class="space-section" id="mes-notes">
        <div class="space-section-head">
          <p class="eyebrow">Mes notes</p>
          <h2>Derniers films notés</h2>
        </div>
        ${ratedMovies.length ? `<div class="profile-recent account-recent space-list">${ratedMovies.map(renderAccountRatingItem).join('')}</div>` : '<p class="soft-note">Aucune note enregistrée pour le moment.</p>'}
      </section>

      <section class="space-section" id="mes-avatars">
        <div class="space-section-head">
          <p class="eyebrow">Mes avatars</p>
          <h2>Choisir mon visage dans le Hall</h2>
        </div>
        ${avatarChooser}
      </section>

      <section class="space-section" id="mes-badges">
        <div class="space-section-head">
          <p class="eyebrow">Mes badges</p>
          <h2>Badges débloqués</h2>
        </div>
        <div class="profile-badges account-badge-wall space-badges">
          ${badges.map(badge => `<span class="badge-${PSAuth.escapeHtml(badge.rarity || 'common')}" title="${PSAuth.escapeHtml(badge.description || '')}">${PSAuth.escapeHtml(badge.icon)} ${PSAuth.escapeHtml(badge.label)}<small>${PSAuth.escapeHtml(badge.description || '')}</small></span>`).join('') || '<span>🛰️ Observateur<small>Commence ton parcours de Planétien.</small></span>'}
        </div>
      </section>

      <section class="space-section" id="parametres">
        <div class="space-section-head">
          <p class="eyebrow">Paramètres</p>
          <h2>Compte sécurisé</h2>
        </div>
        <div class="space-settings">
          <p class="soft-note">Email connecté : <strong>${PSAuth.escapeHtml(session?.user?.email || '')}</strong></p>
          <p class="soft-note">Pseudo public : <strong>${PSAuth.escapeHtml(viewer.pseudo)}</strong></p>
          <p class="soft-note">Les changements de pseudo, bio et mot de passe seront regroupés ici dans une prochaine passe.</p>
          <button class="ghost" type="button" data-logout>Déconnexion</button>
        </div>
      </section>
    `;
    PSAuth.updateNav();
    scrollToAccountHash();
    return;
  }

  setAuthenticatedLayout(false);

  if(session?.user){
    accountState.innerHTML = `
      <strong>Compte connecté</strong>
      <p class="soft-note">Le profil spectateur est en cours de création. Vérifie que ton pseudo est disponible, puis reconnecte-toi si besoin.</p>
      <button class="ghost" type="button" data-logout>Déconnexion</button>
    `;
    PSAuth.updateNav();
    return;
  }

  accountState.innerHTML = `
    <strong>Mode invité</strong>
    <p class="soft-note">Tu peux parcourir le catalogue. Pour publier une critique, répondre, liker ou gérer tes favoris, il faudra créer un compte sécurisé.</p>
  `;
  PSAuth.updateNav();
}

function setAuthenticatedLayout(isAuthenticated){
  currentAccountCard?.classList.toggle('is-space-dashboard', Boolean(isAuthenticated));
  createAccountCard?.classList.toggle('is-hidden', Boolean(isAuthenticated));
  loginAccountCard?.classList.toggle('is-hidden', Boolean(isAuthenticated));
}

function renderSpaceStat(icon, value, label){
  return `<span class="space-stat"><i>${PSAuth.escapeHtml(icon)}</i><strong>${Number(value || 0)}</strong><small>${PSAuth.escapeHtml(label)}</small></span>`;
}

function scrollToAccountHash(){
  const hash = decodeURIComponent(location.hash || '');
  if(!hash || hash === '#mon-espace') return;
  setTimeout(() => {
    const target = document.querySelector(hash);
    if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
  }, 80);
}

function renderAvatarGallery(container, input, selected='orbiteur'){
  if(!container || !input) return;
  input.value = selected;
  container.innerHTML = avatarButtons(selected);
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-avatar-choice]');
    if(!button) return;
    input.value = button.dataset.avatarChoice;
    renderAvatarGallery(container, input, input.value);
  }, {once:true});
}

function avatarButtons(selected='orbiteur'){
  selected = PSAuth.normalizeAvatar ? PSAuth.normalizeAvatar(selected, 'orbiteur') : selected;
  const catalog = PSAuth.avatarCatalog ? PSAuth.avatarCatalog() : [];
  return catalog.map(item => `
    <button class="avatar-choice ${item.id === selected ? 'is-selected' : ''}" type="button" data-avatar-choice="${PSAuth.escapeHtml(item.id)}" aria-label="${PSAuth.escapeHtml(item.label)}">
      ${PSAuth.avatarHtml(item.id, 'avatar-choice-img')}
      <span>${PSAuth.escapeHtml(item.label)}</span>
    </button>
  `).join('');
}

async function updateCurrentAvatar(nextAvatar){
  if(!nextAvatar || PSAuth.isReservedAvatar?.(nextAvatar)) return;
  const state = await PSAuth.getAuthState();
  const viewer = state.viewer;
  if(!viewer?.id){
    setStatus('Connecte-toi pour changer ton avatar.', 'error');
    return;
  }

  setStatus('Mise à jour de l’avatar...', 'pending');
  const result = await window.PS.restWrite('viewers', 'PATCH', `id=eq.${encodeURIComponent(viewer.id)}`, {avatar:nextAvatar, last_seen:new Date().toISOString()}, {auth:true, prefer:'return=minimal'});
  if(!result.ok){
    setStatus('Impossible de changer l’avatar pour le moment.', 'error');
    return;
  }

  const updated = {...viewer, avatar:nextAvatar};
  PSAuth.saveViewer(updated);
  await PSAuth.getAuthState();
  setStatus(`Avatar changé : ${PSAuth.avatarLabel(nextAvatar)}.`, 'ok');
  renderCurrentViewer();
}


function initPasswordToggles(){
  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    const inputId = button.dataset.togglePassword;
    const input = document.getElementById(inputId);
    if(!input) return;

    button.addEventListener('click', () => {
      const shouldShow = input.type === 'password';
      input.type = shouldShow ? 'text' : 'password';
      button.classList.toggle('is-visible', shouldShow);
      button.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
      button.setAttribute('aria-label', shouldShow ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    });
  });
}

function validateEmail(email){
  if(!email || !/^\S+@\S+\.\S+$/.test(email)){
    setStatus('Adresse email invalide.', 'error');
    return false;
  }
  return true;
}

function validatePseudo(pseudo){
  const cleaned = window.PSAuth?.cleanPseudo ? window.PSAuth.cleanPseudo(pseudo) : String(pseudo || '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 32);
  const valid = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _-]{2,32}$/.test(cleaned);
  if(!valid){
    setStatus('Pseudo invalide : 2 à 32 caractères, lettres, chiffres, espaces, tirets et underscores uniquement.', 'error');
    return false;
  }
  return true;
}

function validatePassword(password){
  if(!password || password.length < 8){
    setStatus('Le mot de passe doit contenir au moins 8 caractères.', 'error');
    return false;
  }
  return true;
}

function setStatus(message, type=''){
  if(!accountStatus) return;
  accountStatus.textContent = message;
  accountStatus.dataset.status = type;
}

async function fetchMyCommunityStats(viewerId){
  if(!viewerId) return {comments:0, replies:0, likes:0, likesGiven:0, ratings:0, favorites:0};
  const commentsResult = await window.PS.restSelect('comments', `viewer_uuid=eq.${encodeURIComponent(viewerId)}&select=id,parent_id`, {auth:true});
  const rows = commentsResult.ok && Array.isArray(commentsResult.data) ? commentsResult.data : [];
  const ids = rows.map(row => row.id).filter(Boolean);

  const [ratingsResult, likesGivenResult, favoritesResult] = await Promise.all([
    window.PS.restSelect('movie_ratings', `viewer_id=eq.${encodeURIComponent(viewerId)}&select=movie_id`, {auth:true}),
    window.PS.restSelect('comment_likes', `viewer_id=eq.${encodeURIComponent(viewerId)}&select=comment_id`, {auth:true}),
    window.PS.restSelect('movie_favorites', `viewer_id=eq.${encodeURIComponent(viewerId)}&select=movie_id`, {auth:true})
  ]);

  let likes = 0;
  if(ids.length){
    const likesResult = await window.PS.restSelect('comment_likes', `comment_id=in.(${ids.map(encodeURIComponent).join(',')})&select=comment_id`, {auth:true});
    likes = likesResult.ok && Array.isArray(likesResult.data) ? likesResult.data.length : 0;
  }
  return {
    comments: rows.filter(row => !row.parent_id).length,
    replies: rows.filter(row => row.parent_id).length,
    likes,
    likesGiven: likesGivenResult.ok && Array.isArray(likesGivenResult.data) ? likesGivenResult.data.length : 0,
    ratings: ratingsResult.ok && Array.isArray(ratingsResult.data) ? new Set(ratingsResult.data.map(row => row.movie_id)).size : 0,
    favorites: favoritesResult.ok && Array.isArray(favoritesResult.data) ? favoritesResult.data.length : 0
  };
}

async function fetchMyRecentReviews(viewerId, limit=4){
  if(!viewerId) return [];
  const result = await window.PS.restSelect('comments', `viewer_uuid=eq.${encodeURIComponent(viewerId)}&parent_id=is.null&select=id,movie_id,comment,rating,created_at,edited_at&order=created_at.desc&limit=${Number(limit) || 4}`, {auth:true});
  const rows = result.ok && Array.isArray(result.data) ? result.data : [];
  const catalogue = await loadCatalogueTitles();
  return rows.map(row => ({...row, movie_title: catalogue.get(row.movie_id) || row.movie_id || 'Titre inconnu'}));
}

let catalogueTitleCache = null;
async function loadCatalogueTitles(){
  if(catalogueTitleCache) return catalogueTitleCache;
  try{
    const data = await fetch('data/catalogue.json').then(response => response.json());
    catalogueTitleCache = new Map((Array.isArray(data) ? data : []).map(item => [item.slug, item.title]));
  }catch{
    catalogueTitleCache = new Map();
  }
  return catalogueTitleCache;
}

async function fetchMyRatedMovies(viewerId, limit=8){
  if(!viewerId) return [];
  const result = await window.PS.restSelect('movie_ratings', `viewer_id=eq.${encodeURIComponent(viewerId)}&select=movie_id,rating,updated_at,created_at&order=updated_at.desc&limit=${Number(limit) || 8}`, {auth:true});
  const rows = result.ok && Array.isArray(result.data) ? result.data : [];
  const catalogue = await loadCatalogueTitles();
  return rows.map(row => ({...row, movie_title: catalogue.get(row.movie_id) || row.movie_id || 'Titre inconnu'}));
}

async function fetchMyFavoriteMovies(viewerId, limit=12){
  if(!viewerId) return [];
  const result = await window.PS.restSelect('movie_favorites', `viewer_id=eq.${encodeURIComponent(viewerId)}&select=movie_id,created_at&order=created_at.desc&limit=${Number(limit) || 12}`, {auth:true});
  const rows = result.ok && Array.isArray(result.data) ? result.data : [];
  const catalogue = await loadCatalogueTitles();
  return rows.map(row => ({...row, movie_title: catalogue.get(row.movie_id) || row.movie_id || 'Titre inconnu'}));
}

function renderAccountFavoriteItem(item){
  return `
    <a class="profile-review-item" href="watch.html?slug=${encodeURIComponent(item.movie_id)}">
      <span class="profile-review-rating">❤️</span>
      <span>
        <strong>${PSAuth.escapeHtml(item.movie_title)}</strong>
        <small>ajouté aux favoris ${formatAccountDate(item.created_at)}</small>
        <em>Reprendre la lecture ou retirer ce film de ta liste.</em>
      </span>
    </a>
  `;
}

function renderAccountRatingItem(item){
  return `
    <a class="profile-review-item" href="watch.html?slug=${encodeURIComponent(item.movie_id)}">
      <span class="profile-review-rating">${PSAuth.escapeHtml(String(item.rating || '-'))}/10</span>
      <span>
        <strong>${PSAuth.escapeHtml(item.movie_title)}</strong>
        <small>noté ${formatAccountDate(item.updated_at || item.created_at)}</small>
        <em>Ouvrir la fiche pour modifier la note ou écrire une critique.</em>
      </span>
    </a>
  `;
}

function renderAccountReviewItem(review){
  return `
    <a class="profile-review-item" href="watch.html?slug=${encodeURIComponent(review.movie_id)}#comment-${encodeURIComponent(review.id)}">
      <span class="profile-review-rating">${PSAuth.escapeHtml(String(review.rating || '-'))}/10</span>
      <span>
        <strong>${PSAuth.escapeHtml(review.movie_title)}</strong>
        <small>${formatAccountDate(review.created_at)}${review.edited_at ? ' · modifié' : ''}</small>
        <em>${PSAuth.escapeHtml(shortenAccountText(review.comment, 110))}</em>
      </span>
    </a>
  `;
}



async function fetchMyJourney(viewer={}, stats={}, recentReviews=[], ratedMovies=[]){
  const viewerId = viewer?.id;
  const catalogue = await loadCatalogueTitles();
  const events = [];

  const addEvent = (event) => {
    if(!event?.at) return;
    events.push({
      icon:event.icon || '✨',
      title:event.title || 'Étape franchie',
      text:event.text || '',
      at:event.at,
      href:event.href || '',
      done:event.done !== false
    });
  };

  addEvent({
    icon:'🚀',
    title:'Bienvenue sur Planète Stream',
    text:'Tu es devenu Planétien. Le siège est réservé, le popcorn aussi.',
    at:viewer.created_at
  });

  addEvent({
    icon:'🎭',
    title:'Avatar actuel',
    text:`${PSAuth.avatarLabel?.(PSAuth.displayAvatar?.(viewer) || viewer.avatar) || 'Orbiteur'} accompagne ton parcours dans le Hall.`,
    at:viewer.last_seen || viewer.created_at
  });

  const [firstRating, firstReview, firstReply, firstLike] = await Promise.all([
    fetchFirstRating(viewerId),
    fetchFirstComment(viewerId, false),
    fetchFirstComment(viewerId, true),
    fetchFirstLikeReceived(viewerId)
  ]);

  if(firstRating){
    addEvent({
      icon:'⭐',
      title:'Première note',
      text:`${catalogue.get(firstRating.movie_id) || firstRating.movie_id || 'Un film'} · ${firstRating.rating}/10`,
      at:firstRating.created_at || firstRating.updated_at,
      href:firstRating.movie_id ? `watch.html?slug=${encodeURIComponent(firstRating.movie_id)}` : ''
    });
  }

  if(firstReview){
    addEvent({
      icon:'✍️',
      title:'Première critique',
      text:`${catalogue.get(firstReview.movie_id) || firstReview.movie_id || 'Un film'} · ${shortenAccountText(firstReview.comment, 90)}`,
      at:firstReview.created_at,
      href:firstReview.movie_id ? `watch.html?slug=${encodeURIComponent(firstReview.movie_id)}#comment-${encodeURIComponent(firstReview.id)}` : ''
    });
  }

  if(firstReply){
    addEvent({
      icon:'💬',
      title:'Premier échange',
      text:`Tu as répondu sur ${catalogue.get(firstReply.movie_id) || firstReply.movie_id || 'un film'}.`,
      at:firstReply.created_at,
      href:firstReply.movie_id ? `watch.html?slug=${encodeURIComponent(firstReply.movie_id)}#comment-${encodeURIComponent(firstReply.id)}` : ''
    });
  }

  if(firstLike){
    addEvent({
      icon:'❤️',
      title:'Premier like reçu',
      text:'Une de tes contributions a commencé à rayonner dans le Hall.',
      at:firstLike.created_at,
      href:firstLike.movie_id && firstLike.comment_id ? `watch.html?slug=${encodeURIComponent(firstLike.movie_id)}#comment-${encodeURIComponent(firstLike.comment_id)}` : ''
    });
  }

  const sortedEvents = events.sort((a,b) => new Date(a.at) - new Date(b.at));
  const goals = journeyGoals(stats, viewer).slice(0, 10);
  const next = nextJourneyGoal(stats, viewer);
  const title = sortedEvents.length > 2 ? 'Ton orbite prend forme' : 'Le voyage commence';
  const subtitle = sortedEvents.length > 2
    ? 'Chaque note, critique et réponse ajoute une trace à ton journal de bord.'
    : 'Les premières étoiles du parcours attendent encore d’être allumées.';

  return {title, subtitle, events:sortedEvents, goals, next};
}

async function fetchFirstRating(viewerId){
  if(!viewerId) return null;
  const result = await window.PS.restSelect('movie_ratings', `viewer_id=eq.${encodeURIComponent(viewerId)}&select=movie_id,rating,created_at,updated_at&order=created_at.asc&limit=1`, {auth:true});
  return result.ok && Array.isArray(result.data) ? result.data[0] || null : null;
}

async function fetchFirstComment(viewerId, reply=false){
  if(!viewerId) return null;
  const parentFilter = reply ? 'parent_id=not.is.null' : 'parent_id=is.null';
  const result = await window.PS.restSelect('comments', `viewer_uuid=eq.${encodeURIComponent(viewerId)}&${parentFilter}&select=id,movie_id,comment,rating,parent_id,created_at&order=created_at.asc&limit=1`, {auth:true});
  return result.ok && Array.isArray(result.data) ? result.data[0] || null : null;
}

async function fetchFirstLikeReceived(viewerId){
  if(!viewerId) return null;
  const own = await window.PS.restSelect('comments', `viewer_uuid=eq.${encodeURIComponent(viewerId)}&select=id,movie_id`, {auth:true});
  const comments = own.ok && Array.isArray(own.data) ? own.data : [];
  const ids = comments.map(row => row.id).filter(Boolean);
  if(!ids.length) return null;
  const result = await window.PS.restSelect('comment_likes', `comment_id=in.(${ids.map(encodeURIComponent).join(',')})&select=comment_id,viewer_id,created_at&order=created_at.asc&limit=1`, {auth:true});
  const like = result.ok && Array.isArray(result.data) ? result.data[0] || null : null;
  if(!like) return null;
  const comment = comments.find(row => row.id === like.comment_id) || {};
  return {...like, movie_id:comment.movie_id};
}

function journeyGoals(stats={}, viewer={}){
  const ageDays = viewer?.created_at ? Math.max(0, Math.floor((Date.now() - new Date(viewer.created_at).getTime()) / 86400000)) : 0;
  const definitions = [
    {icon:'⭐', label:'Première note', value:stats.ratings, target:1, hint:'Noter son premier film'},
    {icon:'🎬', label:'10 films notés', value:stats.ratings, target:10, hint:'Construire ses repères'},
    {icon:'🌌', label:'50 films notés', value:stats.ratings, target:50, hint:'Dessiner sa constellation'},
    {icon:'✍️', label:'Première critique', value:stats.comments, target:1, hint:'Laisser une trace écrite'},
    {icon:'🍿', label:'5 critiques', value:stats.comments, target:5, hint:'Devenir un habitué du Hall'},
    {icon:'📽️', label:'25 critiques', value:stats.comments, target:25, hint:'Remplir le carnet de projection'},
    {icon:'💬', label:'Première réponse', value:stats.replies, target:1, hint:'Entrer dans la conversation'},
    {icon:'🗣️', label:'25 réponses', value:stats.replies, target:25, hint:'Animer les débats'},
    {icon:'❤️', label:'Premier like reçu', value:stats.likes, target:1, hint:'Faire réagir un autre Planétien'},
    {icon:'🏆', label:'25 likes reçus', value:stats.likes, target:25, hint:'Marquer les esprits'},
    {icon:'🕰️', label:'1 semaine dans l’orbite', value:ageDays, target:7, hint:'Rester dans la salle après le générique'},
    {icon:'🌙', label:'1 mois de présence', value:ageDays, target:30, hint:'Devenir un visage connu'}
  ];
  return definitions.map(item => ({...item, value:Number(item.value || 0), done:Number(item.value || 0) >= item.target}));
}

function nextJourneyGoal(stats={}, viewer={}){
  const next = journeyGoals(stats, viewer).find(goal => !goal.done);
  if(!next) return {label:'Tous les jalons actuels sont allumés', hint:'Le prochain chapitre sera ajouté bientôt.'};
  const missing = Math.max(0, next.target - next.value);
  return {label:next.label, hint:`Encore ${missing} ${missing > 1 ? 'étapes' : 'étape'} pour l’atteindre.`};
}

function renderJourneyEvent(event){
  const body = `
    <span class="journey-event-icon">${PSAuth.escapeHtml(event.icon)}</span>
    <div>
      <strong>${PSAuth.escapeHtml(event.title)}</strong>
      <small>${formatAccountDateLong(event.at)}</small>
      <p>${PSAuth.escapeHtml(event.text)}</p>
    </div>`;
  return event.href
    ? `<a class="journey-event" href="${PSAuth.escapeHtml(event.href)}">${body}</a>`
    : `<div class="journey-event">${body}</div>`;
}

function renderJourneyGoal(goal){
  const progress = Math.max(0, Math.min(100, Math.round((Number(goal.value || 0) / Math.max(goal.target, 1)) * 100)));
  return `
    <div class="journey-goal ${goal.done ? 'is-done' : ''}">
      <span>${PSAuth.escapeHtml(goal.icon)}</span>
      <div>
        <strong>${PSAuth.escapeHtml(goal.label)}</strong>
        <small>${PSAuth.escapeHtml(goal.hint)}</small>
        <div class="journey-goal-bar"><i style="width:${progress}%"></i></div>
      </div>
      <em>${goal.done ? '✓' : `${Math.min(goal.value, goal.target)}/${goal.target}`}</em>
    </div>
  `;
}

async function fetchMyNotifications(viewerId, limit=12){
  if(!viewerId) return {items:[], unread:0};
  const result = await window.PS.restSelect('notifications', `recipient_viewer_id=eq.${encodeURIComponent(viewerId)}&select=id,type,movie_id,comment_id,parent_comment_id,actor_viewer_id,message,created_at,read_at&order=created_at.desc&limit=${Number(limit) || 12}`, {auth:true});
  const rows = result.ok && Array.isArray(result.data) ? result.data : [];
  const actorIds = [...new Set(rows.map(row => row.actor_viewer_id).filter(Boolean))];
  const [actors, catalogue] = await Promise.all([fetchNotificationActors(actorIds), loadCatalogueTitles()]);
  return {
    unread: rows.filter(row => !row.read_at).length,
    read: rows.filter(row => row.read_at).length,
    items: rows.map(row => ({
      ...row,
      actor: actors.get(row.actor_viewer_id) || null,
      movie_title: catalogue.get(row.movie_id) || row.movie_id || 'un contenu'
    }))
  };
}

async function fetchNotificationActors(ids=[]){
  const cleanIds = ids.filter(id => /^[0-9a-f-]{36}$/i.test(String(id)));
  if(!cleanIds.length) return new Map();
  const result = await window.PS.restSelect('viewers', `id=in.(${cleanIds.join(',')})&select=id,pseudo,avatar,badge,role,created_at`, {auth:true});
  const rows = result.ok && Array.isArray(result.data) ? result.data : [];
  return new Map(rows.map(row => [row.id, row]));
}

function renderNotificationItem(item){
  const actor = item.actor || {pseudo:'Un Planétien', avatar:'orbiteur'};
  const unread = !item.read_at;
  const href = item.movie_id ? `watch.html?slug=${encodeURIComponent(item.movie_id)}${item.comment_id ? `#comment-${encodeURIComponent(item.comment_id)}` : ''}` : '#';
  const label = item.type === 'reply'
    ? `${actor.pseudo || 'Un Planétien'} vous a répondu`
    : (item.message || 'Nouvelle activité dans le Hall');

  return `
    <div class="space-notification-item ${unread ? 'is-unread' : ''}" data-notification-card="${PSAuth.escapeHtml(item.id)}">
      <a class="space-notification-main" href="${href}" data-notification-link data-notification-id="${PSAuth.escapeHtml(item.id)}">
        ${PSAuth.avatarHtml(PSAuth.displayAvatar?.(actor) || actor.avatar || 'orbiteur', 'viewer-avatar')}
        <span>
          <strong>${PSAuth.escapeHtml(label)}</strong>
          <small>${PSAuth.escapeHtml(item.movie_title)} · ${formatAccountDate(item.created_at)}</small>
          ${unread ? '<em>Nouveau</em>' : ''}
        </span>
      </a>
      <button class="notification-delete" type="button" data-delete-notification="${PSAuth.escapeHtml(item.id)}" aria-label="Supprimer ce message">×</button>
    </div>
  `;
}

async function markMyNotificationsRead(){
  const state = await PSAuth.getAuthState();
  const viewer = state.viewer;
  if(!viewer?.id) return;
  setStatus('Lecture des messages du Hall...', 'pending');
  const result = await window.PS.restWrite('notifications', 'PATCH', `recipient_viewer_id=eq.${encodeURIComponent(viewer.id)}&read_at=is.null`, {read_at:new Date().toISOString()}, {auth:true, prefer:'return=minimal'});
  if(!result.ok){
    setStatus('Impossible de marquer les messages comme lus.', 'error');
    return;
  }
  await window.PS.refreshNotificationsCount?.();
  setStatus('Messages marqués comme lus.', 'ok');
  renderCurrentViewer();
}


async function markNotificationRead(notificationId){
  const id = String(notificationId || '');
  if(!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const result = await window.PS.restWrite('notifications', 'PATCH', `id=eq.${encodeURIComponent(id)}&read_at=is.null`, {read_at:new Date().toISOString()}, {auth:true, prefer:'return=minimal'});
  await window.PS.refreshNotificationsCount?.();
  return result.ok;
}

async function openNotification(notificationId, href){
  await markNotificationRead(notificationId);
  if(href && href !== '#') window.location.href = href;
  else renderCurrentViewer();
}

async function deleteNotification(notificationId){
  const id = String(notificationId || '');
  if(!/^[0-9a-f-]{36}$/i.test(id)) return;
  setStatus('Suppression du message...', 'pending');
  const result = await window.PS.restWrite('notifications', 'DELETE', `id=eq.${encodeURIComponent(id)}`, {}, {auth:true, prefer:'return=minimal'});
  if(!result.ok){
    setStatus('Impossible de supprimer ce message.', 'error');
    return;
  }
  await window.PS.refreshNotificationsCount?.();
  setStatus('Message supprimé.', 'ok');
  renderCurrentViewer();
}

async function deleteReadNotifications(){
  const state = await PSAuth.getAuthState();
  const viewer = state.viewer;
  if(!viewer?.id) return;
  setStatus('Nettoyage des messages lus...', 'pending');
  const result = await window.PS.restWrite('notifications', 'DELETE', `recipient_viewer_id=eq.${encodeURIComponent(viewer.id)}&read_at=not.is.null`, {}, {auth:true, prefer:'return=minimal'});
  if(!result.ok){
    setStatus('Impossible de supprimer les messages lus.', 'error');
    return;
  }
  await window.PS.refreshNotificationsCount?.();
  setStatus('Messages lus supprimés.', 'ok');
  renderCurrentViewer();
}


function formatAccountDateLong(value){
  if(!value) return 'date inconnue';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return 'date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {day:'2-digit', month:'long', year:'numeric'}).format(date);
}

function formatAccountDate(value){
  if(!value) return 'à l’instant';
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60000, hour = minute * 60, day = hour * 24;
  if(diff < minute) return 'à l’instant';
  if(diff < hour) return `il y a ${Math.floor(diff / minute)} min`;
  if(diff < day) return `il y a ${Math.floor(diff / hour)} h`;
  if(diff < day * 2) return 'hier';
  if(diff < day * 7) return `il y a ${Math.floor(diff / day)} j`;
  return new Intl.DateTimeFormat('fr-FR', {day:'2-digit', month:'short', year:'numeric'}).format(new Date(value));
}

function shortenAccountText(text='', limit=100){
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  return clean.length > limit ? `${clean.slice(0, limit - 1).trim()}…` : clean;
}

function localReputationScore(stats={}){
  return Number(stats.comments || 0) * 12 + Number(stats.replies || 0) * 5 + Number(stats.likes || 0) * 8;
}

function localReputationLevel(score=0){
  if(score >= 800) return {icon:'🏆', label:'Légende de l’orbite', progress:100};
  if(score >= 350) return {icon:'⭐', label:'Critique influent', progress:Math.round((score - 350) / 450 * 100)};
  if(score >= 150) return {icon:'🍿', label:'Cinéphile confirmé', progress:Math.round((score - 150) / 200 * 100)};
  if(score >= 50) return {icon:'🎬', label:'Spectateur actif', progress:Math.round((score - 50) / 100 * 100)};
  return {icon:'🌱', label:'Nouveau Planétien', progress:Math.round(score / 50 * 100)};
}


initAccount();
