let draft = [];
const imageBase = 'https://image.tmdb.org/t/p/w500';
const output = document.querySelector('#jsonOutput');

fetch('data/catalogue.json').then(r => r.json()).then(data => { draft = data; syncOutput(); });

document.querySelector('#searchBtn').addEventListener('click', searchTmdb);
document.querySelector('#downloadBtn').addEventListener('click', downloadJson);

async function searchTmdb(){
  const query = document.querySelector('#query').value.trim();
  const mediaType = document.querySelector('#mediaType').value;
  if(!query) return;
  const results = document.querySelector('#results');
  results.innerHTML = '<p>Recherche en cours...</p>';
  try{
    const res = await fetch(`/.netlify/functions/tmdb-search?query=${encodeURIComponent(query)}&type=${mediaType}`);
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    results.innerHTML = '';
    data.results.slice(0,8).forEach(item => results.appendChild(resultCard(item, mediaType)));
  }catch(err){
    results.innerHTML = `<p>Impossible d’appeler TMDb. Vérifie la clé Netlify. Détail : ${err.message}</p>`;
  }
}

function resultCard(item, mediaType){
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || '').slice(0,4);
  const el = document.createElement('div');
  el.className = 'tmdb-result';
  el.innerHTML = `<img src="${item.poster_path ? imageBase + item.poster_path : ''}" alt=""><div><h3>${title}</h3><p>${year || 'Année inconnue'} · ${item.overview ? item.overview.slice(0,120)+'…' : 'Résumé absent'}</p><button class="primary">Ajouter au JSON</button></div>`;
  el.querySelector('button').addEventListener('click', () => {
    draft.push({
      title,
      slug: slugify(title),
      type: mediaType === 'tv' ? 'serie' : 'film',
      category: mediaType === 'tv' ? 'Série' : 'Film',
      genres: [],
      director: 'À compléter',
      cast: [],
      tmdbId: item.id,
      poster: item.poster_path ? imageBase + item.poster_path : `images/posters/${slugify(title)}.jpg`,
      backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : `images/backdrops/${slugify(title)}.jpg`,
      overview: item.overview || '',
      featured: false
    });
    syncOutput();
  });
  return el;
}
function syncOutput(){ output.value = JSON.stringify(draft, null, 2); }
function slugify(str){return str.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
function downloadJson(){const blob = new Blob([output.value], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='catalogue.json'; a.click(); URL.revokeObjectURL(a.href);}