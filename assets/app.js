const state = { catalogue: [], filter: 'all', search: '' };
const posterFallback = 'linear-gradient(145deg,#3b1c70,#111), radial-gradient(circle at 60% 35%,rgba(255,255,255,.25),transparent 18%)';

async function init(){
  const res = await fetch('data/catalogue.json');
  state.catalogue = await res.json();
  buildGenreFilter();

function buildGenreFilter(){

    const select=document.querySelector("#genreFilter");

    if(!select) return;

    const genres=[
        ...new Set(
            state.catalogue.flatMap(movie=>movie.genres||[])
        )
    ].sort();

    genres.forEach(genre=>{

        const option=document.createElement("option");

        option.value=genre.toLowerCase();

        option.textContent=genre;

        select.appendChild(option);

    });

}

  bindEvents();

  const genre=document.querySelector("#genreFilter");

genre?.addEventListener("change",e=>{

    state.filter=e.target.value || "all";

    document.querySelectorAll("[data-filter]")
        .forEach(b=>b.classList.remove("active"));

    render();

});

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
  card.addEventListener('click', () => {
  window.location.href = `detail.html?slug=${encodeURIComponent(item.slug)}`;
});
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

  const year =
      item.year ||
      (item.releaseDate ? item.releaseDate.substring(0,4) : '') ||
      '';

  const runtime =
      item.runtime
      ? `${item.runtime} min`
      : '';

  const rating =
      item.rating
      ? `⭐ ${Number(item.rating).toFixed(1)}`
      : '';

  const poster =
      item.poster || '';

  const backdrop =
      item.backdrop || poster;

  modal.querySelector('#modalContent').innerHTML = `

<div class="movie-header">

    <div class="movie-backdrop"
         style="background-image:url('${backdrop}')">

        <div class="movie-overlay">

            <div class="movie-poster">

                <img src="${poster}" alt="${escapeHtml(item.title)}">

            </div>

            <div class="movie-main">

                <h1>${escapeHtml(item.title)}</h1>

                <div class="movie-infos">

                    ${year ? `<span>${year}</span>` : ''}
                    ${item.type ? `<span>${escapeHtml(item.type)}</span>` : ''}
                    ${runtime ? `<span>${runtime}</span>` : ''}
                    ${rating ? `<span>${rating}</span>` : ''}

                </div>

                <div class="movie-genres">

                    ${(item.genres || [])
                      .map(g=>`<span>${escapeHtml(g)}</span>`)
                      .join('')}

                </div>

                <div class="movie-buttons">

                    <button class="primary">
                        ▶ Regarder
                    </button>

                    <button class="ghost">
                        + Ma liste
                    </button>

                </div>

            </div>

        </div>

    </div>

</div>

<div class="movie-content">

    <section>

        <h2>Synopsis</h2>

        <p>

            ${escapeHtml(item.overview || "Aucun synopsis disponible.")}

        </p>

    </section>

    <section class="movie-grid">

        <div>

            <h3>Réalisation</h3>

            <p>${escapeHtml(item.director || "Inconnu")}</p>

        </div>

        <div>

            <h3>Casting</h3>

            <p>${escapeHtml(
                (item.cast || []).join(", ") || "Non renseigné"
            )}</p>

        </div>

        <div>

            <h3>Catégorie</h3>

            <p>${escapeHtml(item.category || item.type || "")}</p>

        </div>

        <div>

            <h3>Popularité TMDb</h3>

            <p>${item.popularity || "-"}</p>

        </div>

    </section>

</div>

`;

  modal.showModal();

}

function escapeHtml(str=''){
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

init();