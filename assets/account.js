const accountState = document.querySelector('#currentViewerState');
const accountStatus = document.querySelector('#accountStatus');
const createForm = document.querySelector('#createAccountForm');
const loginForm = document.querySelector('#loginAccountForm');
const createAvatarInput = document.querySelector('#createAvatar');
const createAvatarGallery = document.querySelector('#createAvatarGallery');

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

    const choice = event.target.closest('[data-avatar-choice]');
    if(choice){
      const nextAvatar = choice.dataset.avatarChoice;
      await updateCurrentAvatar(nextAvatar);
    }
  });
}

async function renderCurrentViewer(){
  if(!accountState) return;

  const state = await PSAuth.getAuthState();
  const session = state.session;
  const viewer = state.viewer;

  if(state.isAuthenticated && viewer?.pseudo){
    const [stats, recentReviews] = await Promise.all([
      fetchMyCommunityStats(viewer.id),
      fetchMyRecentReviews(viewer.id)
    ]);
    const score = PSAuth.reputationScore?.(stats) || localReputationScore(stats);
    const level = PSAuth.reputationLevel?.(score) || localReputationLevel(score);
    const badges = PSAuth.badgeDefinitions?.(viewer, stats) || [];
    const reserved = PSAuth.isReservedAvatar?.(viewer.avatar) || ['admin','moderator','moderateur','fondateur','founder'].includes(String(viewer.role || '').toLowerCase());
    const avatarChooser = reserved
      ? `<div class="avatar-reserved-note">Avatar spécial attribué par l’équipe Planète Stream.</div>`
      : `<div class="account-avatar-editor">
          <label>Changer d'avatar</label>
          <div class="avatar-gallery compact" aria-label="Changer d'avatar">
            ${avatarButtons(viewer.avatar || 'orbiteur')}
          </div>
        </div>`;

    accountState.innerHTML = `
      <div class="planetiens-card">
        <div class="planetiens-head">
          ${PSAuth.avatarHtml(viewer.avatar || 'orbiteur', 'viewer-avatar giant')}
          <div>
            <p class="eyebrow">Carte de Planétien</p>
            <h2>${PSAuth.escapeHtml(viewer.pseudo)}</h2>
            <small>${PSAuth.escapeHtml(PSAuth.avatarLabel?.(viewer.avatar) || 'Orbiteur')} · ${PSAuth.escapeHtml(PSAuth.roleLabel?.(viewer.role) || 'Planétien')}</small>
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
          <span><strong>${stats.comments}</strong><small>critiques</small></span>
          <span><strong>${stats.replies}</strong><small>réponses</small></span>
          <span><strong>${stats.likes}</strong><small>likes reçus</small></span>
        </div>
        <div class="profile-badges account-badge-wall">
          ${badges.map(badge => `<span class="badge-${PSAuth.escapeHtml(badge.rarity || 'common')}" title="${PSAuth.escapeHtml(badge.description || '')}">${PSAuth.escapeHtml(badge.icon)} ${PSAuth.escapeHtml(badge.label)}</span>`).join('') || '<span>🛰️ Observateur</span>'}
        </div>
      </div>
      <p class="soft-note">Email connecté : ${PSAuth.escapeHtml(session?.user?.email || '')}</p>
      <p class="soft-note">Tes critiques, réponses, favoris et historiques sont rattachés à ton vrai compte.</p>
      ${recentReviews.length ? `<div class="profile-recent account-recent"><h4>Mes dernières critiques</h4>${recentReviews.map(renderAccountReviewItem).join('')}</div>` : ''}
      ${avatarChooser}
      <button class="ghost" type="button" data-logout>Déconnexion</button>
    `;
    PSAuth.updateNav();
    return;
  }

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
  if(!viewerId) return {comments:0, replies:0, likes:0};
  const commentsResult = await window.PS.restSelect('comments', `viewer_uuid=eq.${encodeURIComponent(viewerId)}&select=id,parent_id`, {auth:true});
  const rows = commentsResult.ok && Array.isArray(commentsResult.data) ? commentsResult.data : [];
  const ids = rows.map(row => row.id).filter(Boolean);
  let likes = 0;
  if(ids.length){
    const likesResult = await window.PS.restSelect('comment_likes', `comment_id=in.(${ids.map(encodeURIComponent).join(',')})&select=comment_id`, {auth:true});
    likes = likesResult.ok && Array.isArray(likesResult.data) ? likesResult.data.length : 0;
  }
  return {
    comments: rows.filter(row => !row.parent_id).length,
    replies: rows.filter(row => row.parent_id).length,
    likes
  };
}

async function fetchMyRecentReviews(viewerId){
  if(!viewerId) return [];
  const result = await window.PS.restSelect('comments', `viewer_uuid=eq.${encodeURIComponent(viewerId)}&parent_id=is.null&select=id,movie_id,comment,rating,created_at,edited_at&order=created_at.desc&limit=4`, {auth:true});
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
