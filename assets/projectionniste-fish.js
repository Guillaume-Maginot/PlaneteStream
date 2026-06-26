(function () {
  const widget = document.querySelector('#psFishWidget');
  const tooltip = document.querySelector('#psFishTooltip');
  const poses = Array.from(document.querySelectorAll('.ps-fish-pose'));
  const chat = document.querySelector('#psFishChat');
  const chatClose = document.querySelector('#psFishChatClose');
  const form = document.querySelector('#psFishForm');
  const input = document.querySelector('#psFishInput');
  const messages = document.querySelector('#psFishMessages');
  const brainStatus = document.querySelector('#psBrainStatus');
  const suggestions = Array.from(document.querySelectorAll('[data-ps-fish-suggestion]'));

  if (!widget || !chat || !form || !input || !messages) return;

  const STORAGE_KEY = 'planeteStreamProjectionnisteIntroSeen';
  let mode = 'idle';
  let idleIndex = 0;
  let idleLoop = null;
  let microLifeLoop = null;
  let autoReturnTimer = null;
  let isHovering = false;
  let isChatOpen = false;

  const states = {
    idle: {
      pose: null,
      html: '<strong>Bloup !</strong><span>Clique si tu veux parler au Projectionniste.</span>'
    },
    thinking: {
      pose: 'thinking',
      html: '<strong>Bloup...</strong><span>Je fouille dans les bobines du bocal.</span>'
    },
    talking: {
      pose: 'talking',
      html: '<strong>Verdict du bocal</strong><span>J’ai quelque chose à te dire.</span>'
    },
    happy: {
      pose: 'talking',
      html: '<strong>Bloup bloup !</strong><span>Le Projectionniste est réveillé.</span>'
    }
  };

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function showPose(poseName) {
    poses.forEach(img => img.classList.toggle('is-active', img.dataset.pose === poseName));
  }

  function clearLoops() {
    clearInterval(idleLoop);
    clearTimeout(microLifeLoop);
    clearTimeout(autoReturnTimer);
  }

  function setMode(nextMode, options = {}) {
    const state = states[nextMode] || states.idle;
    mode = nextMode;

    widget.classList.toggle('is-thinking', mode === 'thinking');
    widget.classList.toggle('is-talking', mode === 'talking');
    widget.classList.toggle('is-happy', mode === 'happy');
    widget.classList.toggle('is-awake', mode !== 'idle' || isHovering || isChatOpen);

    if (tooltip) tooltip.innerHTML = state.html;
    clearLoops();

    if (state.pose) showPose(state.pose);
    else startIdleLoop();

    if (mode !== 'idle' && options.autoReturn !== false) {
      autoReturnTimer = setTimeout(() => setMode('idle'), options.duration || 3600);
    }
  }

  function startIdleLoop() {
    const idlePoses = ['idle-1', 'idle-2'];
    showPose(idlePoses[idleIndex]);

    idleLoop = setInterval(() => {
      idleIndex = (idleIndex + 1) % idlePoses.length;
      showPose(idlePoses[idleIndex]);
    }, 5200);

    scheduleMicroLife();
  }

  function scheduleMicroLife() {
    microLifeLoop = setTimeout(() => {
      if (mode !== 'idle') return;
      if (Math.random() < .55) {
        widget.classList.add('is-awake');
        setTimeout(() => {
          if (!isHovering && !isChatOpen && mode === 'idle') widget.classList.remove('is-awake');
        }, 1500);
      } else {
        showPose('idle-2');
        setTimeout(() => {
          if (mode === 'idle') showPose('idle-1');
        }, 1200);
      }
      scheduleMicroLife();
    }, randomBetween(7000, 14500));
  }

  function openChat() {
    isChatOpen = true;
    chat.classList.add('is-open');
    chat.setAttribute('aria-hidden', 'false');
    widget.setAttribute('aria-expanded', 'true');
    widget.classList.add('is-awake');
    widget.classList.remove('is-intro');
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (error) {}
    setMode('happy', { duration: 1600 });
    setTimeout(() => input.focus(), 120);
  }

  function closeChat() {
    isChatOpen = false;
    chat.classList.remove('is-open');
    chat.setAttribute('aria-hidden', 'true');
    widget.setAttribute('aria-expanded', 'false');
    setMode('idle');
  }

  function toggleChat() {
    if (isChatOpen) closeChat();
    else openChat();
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function addMessage(author, text) {
    const article = document.createElement('article');
    article.className = `ps-fish-message ps-fish-message-${author}`;
    article.innerHTML = `
      <strong>${author === 'bot' ? '🐠 Projectionniste' : 'Toi'}</strong>
      <p>${escapeHtml(text)}</p>
    `;
    messages.appendChild(article);
    messages.scrollTop = messages.scrollHeight;
  }

  function normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function localBrain(rawMessage) {
    const message = normalize(rawMessage.trim());

    if (!message) return 'Bloup ? Même moi j’ai besoin d’au moins une bulle d’information.';

    if (/^(salut|bonjour|hello|coucou|yo|bonsoir)\b/.test(message)) {
      return 'Bloup ! Je suis réveillé. Enfin, autant qu’un poisson rouge peut l’être sans café.';
    }

    if (/merci|thanks/.test(message)) {
      return 'Avec plaisir. Je retourne surveiller les bobines depuis mon bocal.';
    }

    if (/qui es tu|t es qui|tu es qui|projectionniste|poisson|ia/.test(message)) {
      return 'Je suis le Projectionniste de Planete Stream : petit poisson, futur gros cerveau. Pour l’instant, je fonctionne en mode local, donc zéro facture et zéro hallucination aquatique.';
    }

    if (/aide|help|comment|que peux tu faire/.test(message)) {
      return 'Je peux déjà répondre aux questions simples. Bientôt, je lirai le catalogue JSON pour te proposer uniquement des films vraiment présents sur Planete Stream.';
    }

    if (/enfant|famille|familial|kids|dessin anime/.test(message)) {
      return 'Je ne suis pas encore branché au catalogue, donc je préfère ne pas inventer un film pour enfants sorti d’un coquillage. Dès que je serai nourri au JSON, je te dirai clairement ce qui existe... ou ce qui manque.';
    }

    if (/catalogue|json|film|serie|manga|acteur|actrice|realisateur|genre|duree|moins de|sf|science fiction|comedie|horreur|thriller|action|aventure/.test(message)) {
      return 'Bonne demande cinéma. Pour l’instant je suis en cerveau local : je comprends l’intention, mais je ne cherche pas encore dans le vrai catalogue. Prochaine étape : me nourrir au JSON, et là je ne proposerai que les titres présents sur Planete Stream.';
    }

    if (/surprise|je ne sais pas|n importe|hasard/.test(message)) {
      return 'J’adorerais te sortir une recommandation du bocal, mais sans le JSON je reste sage. Un poisson honnête vaut mieux qu’un dauphin mythomane.';
    }

    return 'Bloup... je sèche un peu. Mon cerveau local sait discuter, mais il attend encore le catalogue JSON pour devenir vraiment utile.';
  }

  function askFish(message) {
    const clean = message.trim();
    if (!clean) return;

    addMessage('user', clean);
    input.value = '';
    if (brainStatus) brainStatus.textContent = 'Recherche dans le bocal...';
    setMode('thinking', { autoReturn: false });

    window.setTimeout(() => {
      const answer = localBrain(clean);
      addMessage('bot', answer);
      if (brainStatus) brainStatus.textContent = 'Cerveau local actif';
      setMode('talking', { duration: 3400 });
    }, randomBetween(420, 850));
  }

  widget.addEventListener('click', toggleChat);

  if (chatClose) chatClose.addEventListener('click', closeChat);

  form.addEventListener('submit', event => {
    event.preventDefault();
    askFish(input.value);
  });

  suggestions.forEach(button => {
    button.addEventListener('click', () => askFish(button.dataset.psFishSuggestion || ''));
  });

  widget.addEventListener('mouseenter', () => {
    isHovering = true;
    widget.classList.add('is-awake');
  });

  widget.addEventListener('mouseleave', () => {
    isHovering = false;
    if (mode === 'idle' && !isChatOpen) {
      setTimeout(() => {
        if (!isHovering && !isChatOpen && mode === 'idle') widget.classList.remove('is-awake');
      }, 700);
    }
  });

  widget.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      widget.click();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isChatOpen) closeChat();
  });

  function showIntroOnce() {
    let seen = false;
    try { seen = localStorage.getItem(STORAGE_KEY) === '1'; } catch (error) {}
    if (seen) return;

    setTimeout(() => {
      if (isChatOpen) return;
      widget.classList.add('is-intro', 'is-awake');
      if (tooltip) tooltip.innerHTML = '<strong>Bloup !</strong><span>Je suis le Projectionniste. Clique sur moi si tu cherches un film.</span>';
      setTimeout(() => {
        widget.classList.remove('is-intro');
        if (!isHovering && !isChatOpen && mode === 'idle') widget.classList.remove('is-awake');
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (error) {}
      }, 6200);
    }, 1700);
  }

  setMode('idle');
  showIntroOnce();
})();
