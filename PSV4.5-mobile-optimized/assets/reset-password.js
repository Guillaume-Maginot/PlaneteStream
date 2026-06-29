/* Planète Stream · nouveau mot de passe */
(function(){
  const form = document.querySelector('#resetPasswordForm');
  const password = document.querySelector('#newPassword');
  const confirm = document.querySelector('#confirmPassword');
  const status = document.querySelector('#resetPasswordStatus');

  function setStatus(message, type='pending'){
    if(!status) return;
    status.textContent = message || '';
    status.dataset.status = type || '';
  }

  function initPasswordToggles(){
    document.querySelectorAll('[data-toggle-password]').forEach(button => {
      const id = button.dataset.togglePassword;
      const input = document.getElementById(id);
      if(!input) return;
      button.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.setAttribute('aria-pressed', show ? 'true' : 'false');
        button.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      });
    });
  }

  async function init(){
    initPasswordToggles();
    setStatus('Vérification du lien de réinitialisation...', 'pending');
    await window.PS?.ready;
    const state = window.PS?.getState?.() || {};
    if(!state.accessToken){
      form?.querySelector('button[type="submit"]')?.setAttribute('disabled', 'disabled');
      setStatus('Lien expiré ou invalide. Relance une demande depuis “Mot de passe oublié ?”.', 'error');
      return;
    }
    setStatus('Lien validé. Tu peux choisir un nouveau mot de passe.', 'ok');
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const next = password?.value || '';
    const again = confirm?.value || '';

    if(next.length < 8){
      setStatus('Le mot de passe doit contenir au moins 8 caractères.', 'error');
      return;
    }
    if(next !== again){
      setStatus('Les deux mots de passe ne sont pas identiques.', 'error');
      return;
    }

    setStatus('Mise à jour du mot de passe...', 'pending');
    const result = await window.PS.updatePassword(next);
    if(!result.ok){
      setStatus(result.message || 'Impossible de mettre à jour le mot de passe.', 'error');
      return;
    }

    form.reset();
    setStatus('Mot de passe mis à jour. Redirection vers la connexion...', 'ok');
    window.setTimeout(() => window.location.replace('account.html#mon-espace'), 1400);
  });

  init();
})();
