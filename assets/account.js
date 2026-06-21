const accountState = document.querySelector('#currentViewerState');
const accountStatus = document.querySelector('#accountStatus');
const createForm = document.querySelector('#createAccountForm');
const loginForm = document.querySelector('#loginAccountForm');

function initAccount(){
  renderCurrentViewer();

  createForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const email = document.querySelector('#createEmail')?.value.trim();
    const pseudo = document.querySelector('#createPseudo')?.value.trim();
    const password = document.querySelector('#createPassword')?.value;
    const avatar = document.querySelector('#createAvatar')?.value || PSAuth.pickAvatar(pseudo);

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
    }
  });
}

async function renderCurrentViewer(){
  if(!accountState) return;

  const state = await PSAuth.getAuthState();
  const session = state.session;
  const viewer = state.viewer;

  if(state.isAuthenticated && viewer?.pseudo){
    accountState.innerHTML = `
      <div class="viewer-card-mini account-viewer-line">
        <span class="viewer-avatar">${PSAuth.escapeHtml(viewer.avatar || '🪐')}</span>
        <div>
          <strong>${PSAuth.escapeHtml(viewer.pseudo)}</strong>
          <small>Compte sécurisé actif</small>
        </div>
      </div>
      <p class="soft-note">Email connecté : ${PSAuth.escapeHtml(session?.user?.email || '')}</p>
      <p class="soft-note">Tes critiques, réponses, favoris et historiques sont rattachés à ton vrai compte.</p>
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

initAccount();
