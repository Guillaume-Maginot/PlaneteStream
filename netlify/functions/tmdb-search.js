export async function handler(event) {
  try {
    const query = event.queryStringParameters?.query?.trim();

    if (!query) {
      return jsonResponse(400, {
        error: "Paramètre query manquant."
      });
    }

    if (!process.env.TMDB_BEARER_TOKEN) {
      return jsonResponse(500, {
        error: "Variable TMDB_BEARER_TOKEN absente côté Netlify."
      });
    }

    const tmdbUrl =
      "https://api.themoviedb.org/3/search/multi" +
      `?query=${encodeURIComponent(query)}` +
      "&language=fr-FR" +
      "&include_adult=false";

    const response = await fetch(tmdbUrl, {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}`,
        accept: "application/json"
      }
    });

    if (!response.ok) {
      return jsonResponse(response.status, {
        error: "Erreur TMDb.",
        status: response.status
      });
    }

    const data = await response.json();

    const results = (data.results || [])
      .filter(item => item.media_type === "movie" || item.media_type === "tv")
      .map(normalizeTmdbResult)
      .filter(item => item.title && item.tmdbId)
      .slice(0, 12);

    return jsonResponse(200, {
      query,
      count: results.length,
      results
    });
  } catch (error) {
    return jsonResponse(500, {
      error: "Erreur serveur.",
      details: error.message
    });
  }
}

function normalizeTmdbResult(item) {
  const isMovie = item.media_type === "movie";

  const title = isMovie ? item.title : item.name;
  const originalTitle = isMovie ? item.original_title : item.original_name;
  const date = isMovie ? item.release_date : item.first_air_date;
  const year = date ? date.slice(0, 4) : "";

  return {
    tmdbId: item.id,
    mediaType: item.media_type,
    type: isMovie ? "film" : "serie",
    title,
    originalTitle,
    year,
    overview: item.overview || "",
    poster: buildImageUrl(item.poster_path, "w500"),
    backdrop: buildImageUrl(item.backdrop_path, "w1280"),
    rating: item.vote_average || 0,
    popularity: item.popularity || 0
  };
}

function buildImageUrl(path, size = "w500") {
  if (!path) return "";

  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body, null, 2)
  };
}