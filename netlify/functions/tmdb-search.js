exports.handler = async function(event) {
  const token = process.env.TMDB_BEARER_TOKEN;
  const query = event.queryStringParameters?.query;
  const type = event.queryStringParameters?.type || 'movie';

  if (!token) return { statusCode: 500, body: 'TMDB_BEARER_TOKEN manquant dans Netlify.' };
  if (!query) return { statusCode: 400, body: 'Paramètre query manquant.' };
  if (!['movie', 'tv'].includes(type)) return { statusCode: 400, body: 'Type invalide.' };

  const url = new URL(`https://api.themoviedb.org/3/search/${type}`);
  url.searchParams.set('query', query);
  url.searchParams.set('language', 'fr-FR');
  url.searchParams.set('include_adult', 'false');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: 'application/json'
    }
  });

  const body = await response.text();
  return {
    statusCode: response.status,
    headers: { 'Content-Type': 'application/json' },
    body
  };
};