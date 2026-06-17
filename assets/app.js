const state = { catalogue: [], filter: 'all', search: '' };
const posterFallback = 'linear-gradient(145deg,#3b1c70,#111), radial-gradient(circle at 60% 35%,rgba(255,255,255,.25),transparent 18%)';

async function init(){
  const res = await fetch('data/catalogue.json');
  state.catalogue = await res.json();
  bindEvents();
  render();
}

function bindEvents(){
  document.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === btn));
    render();
  }));
  document.querySelectorAll('[data-nav-filter]').forEach(link => link.addEventListener('click', () => {
    state.filter = link.dataset.navFilter;
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === state.filter));
    render();
  }));
  const search = document.querySelector('#searchInput');
  if(search){search.addEventListener('input', e => {state.search = e.target.value.toLowerCase(); render();});}
  document.querySelector('[data-close]').addEventListener('click', () => document.querySelector('#detailModal').close());
}

function matches(item){
  const haystack = [item.title, item.type, item.category, ...(item.genres || []), ...(item.cast || [])].join(' ').toLowerCase();
  const filterOk = state.filter === 'all' || item.type === state.filter || haystack.includes(state.filter);
  const searchOk = !state.search || haystack.includes(state.search);
  return filterOk && searchOk;
}

function createCard(item){
  const card = document.createElement('button');
  card.className = 'card';
  card.innerHTML = `
    <div class="poster" data-title="${escapeHtml(item.title)}" style="background-image:url('${item.poster}'), ${posterFallback}"></div>
    <div class="info">
      <h3>${escapeHtml(item.title)}</h3>
      <div class="meta">
        <span>${escapeHtml(item.type || 'film')}</span>
        ${(item.genres || []).slice(0,2).map(g => `<span>${escapeHtml(g)}</span>`).join('')}
      </div>
    </div>`;
  card.addEventListener('click', () => openDetail(item));
  return card;
}

function render(){
  const featured = state.catalogue.filter(i => i.featured).slice(0,10);
  const filtered = state.catalogue.filter(matches);
  mount('#featuredGrid', featured);
  mount('#catalogueGrid', filtered);
  document.querySelector('#featuredSection').style.display = state.filter === 'all' && !state.search ? 'block' : 'none';
  document.querySelector('#countLabel').textContent = `${filtered.length} titre${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''}`;
}

function mount(selector, list){
  const grid = document.querySelector(selector);
  grid.innerHTML = '';
  list.forEach(item => grid.appendChild(createCard(item)));
}

function openDetail(item){
  const modal = document.querySelector('#detailModal');
  document.querySelector('#modalContent').innerHTML = `
    <div class="modal-hero" style="background-image:url('${item.backdrop}'), url('${item.poster}'), ${posterFallback}"></div>
    <div class="modal-body">
      <h2>${escapeHtml(item.title)}</h2>
      <div class="chips">
        <span class="chip">${escapeHtml(item.category || item.type)}</span>
        ${(item.genres || []).map(g => `<span class="chip">${escapeHtml(g)}</span>`).join('')}
      </div>
      <p><strong>Réalisation / création :</strong> ${escapeHtml(item.director || 'À compléter')}</p>
      <p><strong>Casting :</strong> ${escapeHtml((item.cast || []).join(', ') || 'À compléter')}</p>
      <p class="hint">Résumé, bande-annonce et lecteur pourront être branchés ici plus tard. Pour la maquette, cette fiche prouve déjà la navigation titre → détail.</p>
    </div>`;
  modal.showModal();
}

function escapeHtml(str=''){
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

init();