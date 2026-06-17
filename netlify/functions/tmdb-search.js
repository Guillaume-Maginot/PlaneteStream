export async function handler(event) {
  const query = event.queryStringParameters.query;

  if (!query) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Paramètre query manquant" })
    };
  }

  const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&language=fr-FR`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}`,
      accept: "application/json"
    }
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}