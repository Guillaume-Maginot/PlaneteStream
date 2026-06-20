const storePrefix = 'planetestream';
const SUPABASE_URL = 'https://bdtktrbtawalniamalcs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QLnbv7xRodnpeCXWNZ1q0w_ySaZLElI';
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY);

const accountState = document.querySelector('#currentViewerState');
const accountStatus = document.querySelector('#accountStatus');
const createForm = document.querySelector('#createAccountForm');
const loginForm = document.querySelector('#loginAccountForm');

function initAccount(){
  renderCurrentViewer();

  createForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const pseudo = document.querySelector('#createPseudo')?.value.trim();
    const avatar = document.querySelector('#createAvatar')?.value || pickAvatar(pseudo);
    if(!validatePseudo(pseudo)) return;

    setStatus('Création du compte spectateur...', 'pending');
    const existing = await findViewerByPseudo(pseudo);
    if(existing){
      setStatus('Ce pseudo existe déjà. Utilise la connexion pour le récupérer.', 'error');
      return;
    }

    const created = await createViewer(pseudo, avatar);
    if(created){
      saveViewer(created);
      setStatus('Compte créé. Ton badge spectateur est prêt.', 'ok');
      createForm.reset();
      renderCurrentViewer();
    }else{
      setStatus('Impossible de créer le compte pour le moment.', 'error');
    }
  });

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const pseudo = document.querySelector('#loginPseudo')?.value.trim();
    if(!validatePseudo(pseudo)) return;

    setStatus('Recherche du compte spectateur...', 'pending');
    const viewer = await findViewerByPseudo(pseudo);
    if(!viewer){
      setStatus('Aucun compte trouvé avec ce pseudo. Il faut le créer avant, le sas est strict.', 'error');
      return;
    }

    const normalized = normalizeViewer(viewer);
    await updateLastSeen(normalized.id);
    saveViewer(normalized);
    setStatus('Connexion réussie. Bon retour sur orbite.', 'ok');
    loginForm.reset();
    renderCurrentViewer();
  });

  accountState?.addEventListener('click', event => {
    if(event.target.closest('[data-logout]')){
      localStorage.removeItem(`${storePrefix}:viewer`);
      setStatus('Compte retiré de ce navigateur.', 'ok');
      renderCurrentViewer();
    }
  });
}

function renderCurrentViewer(){
  const viewer = loadViewer();
  if(!accountState) return;

  if(viewer?.pseudo){
    accountState.innerHTML = `
      <div class="viewer-card-mini account-viewer-line">
        <span class="viewer-avatar">${escapeHtml(viewer.avatar || '🪐')}</span>
        <div>
          <strong>${escapeHtml(viewer.pseudo)}</strong>
          <small>${isAutoViewer(viewer) ? 'Compte automatique silencieux' : 'Compte spectateur actif'}</small>
        </div>
      </div>
      <p class="soft-note">Ce compte est enregistré sur ce navigateur. Les critiques, likes, favoris et historique peuvent s'y rattacher.</p>
      <button class="ghost" type="button" data-logout>Déconnecter ce navigateur</button>
    `;
    return;
  }

  accountState.innerHTML = `
    <strong>Mode invité</strong>
    <p class="soft-note">Tu peux parcourir le catalogue librement. Les likes peuvent rester silencieux, mais les critiques seront mieux signées avec un compte.</p>
  `;
}

function validatePseudo(pseudo){
  if(!pseudo || pseudo.length < 2){
    setStatus('Le pseudo doit contenir au moins 2 caractères.', 'error');
    return false;
  }
  return true;
}

async function findViewerByPseudo(pseudo){
  const result = await supabaseSelect(`pseudo=eq.${encodeURIComponent(pseudo)}&select=id,pseudo,avatar,created_at,last_seen&limit=1`);
  if(!result.ok) return null;
  return Array.isArray(result.data) ? result.data[0] : null;
}

async function createViewer(pseudo, avatar){
  const row = await supabaseInsertReturning({
    pseudo: pseudo.slice(0, 32),
    avatar: avatar || pickAvatar(pseudo),
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString()
  });
  return row ? normalizeViewer(row) : null;
}

async function updateLastSeen(id){
  if(!id || !SUPABASE_ENABLED) return false;
  try{
    const response = await fetch(`${SUPABASE_URL}/rest/v1/viewers?id=eq.${encodeURIComponent(id)}`, {
      method:'PATCH',
      headers:{...supabaseHeaders(), 'Content-Type':'application/json', Prefer:'return=minimal'},
      body: JSON.stringify({last_seen: new Date().toISOString()})
    });
    return response.ok;
  }catch(error){
    console.error('Viewer last_seen update failed', error);
    return false;
  }
}

async function supabaseSelect(query){
  if(!SUPABASE_ENABLED) return {ok:false, data:null};
  try{
    const response = await fetch(`${SUPABASE_URL}/rest/v1/viewers?${query}`, {
      headers: {...supabaseHeaders(), 'Cache-Control':'no-cache'},
      cache:'no-store'
    });
    const data = await response.json().catch(() => null);
    if(!response.ok){
      console.error('Supabase viewers SELECT failed', response.status, data);
      return {ok:false, data:null};
    }
    return {ok:true, data};
  }catch(error){
    console.error('Supabase viewers SELECT network error', error);
    return {ok:false, data:null};
  }
}

async function supabaseInsertReturning(payload){
  if(!SUPABASE_ENABLED) return null;
  try{
    const response = await fetch(`${SUPABASE_URL}/rest/v1/viewers`, {
      method:'POST',
      headers:{...supabaseHeaders(), 'Content-Type':'application/json', Prefer:'return=representation'},
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if(!response.ok){
      console.error('Supabase viewers INSERT failed', response.status, data, payload);
      return null;
    }
    return Array.isArray(data) ? data[0] : data;
  }catch(error){
    console.error('Supabase viewers INSERT network error', error);
    return null;
  }
}

function normalizeViewer(row){
  const pseudo = row.pseudo || 'Spectateur';
  return {
    id: row.id,
    pseudo,
    avatar: row.avatar || pickAvatar(pseudo),
    created_at: row.created_at || null,
    auto: isAutoPseudo(pseudo)
  };
}

function loadViewer(){
  try{return JSON.parse(localStorage.getItem(`${storePrefix}:viewer`) || 'null');}
  catch{return null;}
}

function saveViewer(viewer){
  localStorage.setItem(`${storePrefix}:viewer`, JSON.stringify(viewer));
}

function isAutoViewer(viewer){
  return isAutoPseudo(viewer?.pseudo) || Boolean(viewer?.auto);
}

function isAutoPseudo(pseudo){
  return /^Spectateur \d{4}$/.test(String(pseudo || ''));
}

function pickAvatar(seed=''){
  const avatars = ['🪐','🚀','👾','🤖','🦊','🐼','🐙','🦉','🎬','🍿','🌙','⚡'];
  const score = String(seed).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return avatars[score % avatars.length];
}

function setStatus(message, type=''){
  if(!accountStatus) return;
  accountStatus.textContent = message;
  accountStatus.dataset.status = type;
}

function supabaseHeaders(){
  return {apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`};
}

function escapeHtml(str=''){
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

initAccount();
