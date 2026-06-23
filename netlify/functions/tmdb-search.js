export async function handler(event) {
  try {
    const query = event.queryStringParameters?.query?.trim();

    if (!query) {
      return jsonResponse(400, { error: "Paramètre query manquant." });
    }

    if (!process.env.TMDB_BEARER_TOKEN) {
      return jsonResponse(500, {
        error: "Variable TMDB_BEARER_TOKEN absente côté Netlify."
      });
    }

    const searchUrl =
      "https://api.themoviedb.org/3/search/multi" +
      `?query=${encodeURIComponent(query)}` +
      "&language=fr-FR" +
      "&include_adult=false";

    const searchData = await tmdbFetch(searchUrl);

    const baseResults = (searchData.results || [])
      .filter(item => item.media_type === "movie" || item.media_type === "tv")
      .filter(item => item.id)
      .slice(0, 12);

    const results = await Promise.all(
      baseResults.map(item => enrichTmdbResult(item))
    );

    return jsonResponse(200, {
      query,
      count: results.length,
      results: results.filter(item => item.title && item.tmdbId)
    });

  } catch (error) {
    return jsonResponse(500, {
      error: "Erreur serveur.",
      details: error.message
    });
  }
}

async function enrichTmdbResult(item) {
  const isMovie = item.media_type === "movie";
  const endpoint = isMovie ? "movie" : "tv";

  const detailsUrl =
    `https://api.themoviedb.org/3/${endpoint}/${item.id}` +
    "?language=fr-FR";

  const creditsUrl =
    `https://api.themoviedb.org/3/${endpoint}/${item.id}/credits` +
    "?language=fr-FR";

    const videosUrl =
  `https://api.themoviedb.org/3/${endpoint}/${item.id}/videos` +
  "?language=fr-FR";

  const [details, credits, videos] = await Promise.all([
    tmdbFetch(detailsUrl),
    tmdbFetch(creditsUrl),
    tmdbFetch(videosUrl)
  ]);

  const seasonsData = isMovie ? [] : await fetchSeasonsData(item.id, details.seasons || []);

  const title = isMovie ? details.title : details.name;
  const originalTitle = isMovie ? details.original_title : details.original_name;
  const date = isMovie ? details.release_date : details.first_air_date;
  const year = date ? date.slice(0, 4) : "";

  const director = isMovie
    ? getDirector(credits)
    : getCreator(details);

  const cast = (credits.cast || [])
    .slice(0, 6)
    .map(actor => actor.name)
    .filter(Boolean);

  const trailer = (videos.results || []).find(video =>
    video.site === "YouTube" &&
    (
        video.type === "Trailer" ||
        video.type === "Teaser"
    )
);

  return {
    tmdbId: item.id,
    mediaType: item.media_type,
    type: isMovie ? "film" : "serie",

    title,
    originalTitle,
    year,
    releaseDate: date || "",

    overview: details.overview || item.overview || "",

    genres: (details.genres || []).map(g => g.name),

    director,
    cast,

    runtime: isMovie
      ? details.runtime || 0
      : details.episode_run_time?.[0] || 0,

    seasons: !isMovie ? details.number_of_seasons || 0 : 0,
    episodes: !isMovie ? details.number_of_episodes || 0 : 0,
    seasonsData,

    country: (details.production_countries || [])
      .map(c => c.name)
      .join(", "),

    language: details.original_language || "",

    rating: details.vote_average || 0,
    popularity: details.popularity || 0,

    poster: buildImageUrl(details.poster_path || item.poster_path, "w500"),
    backdrop: buildImageUrl(details.backdrop_path || item.backdrop_path, "w1280"),
    trailer: trailer?.key || "",
    tagline: details.tagline || "",
    status: details.status || "",
    homepage: details.homepage || "",

    collection: details.belongs_to_collection
  ? details.belongs_to_collection.name
  : "",

studios: (details.production_companies || [])
  .slice(0, 4)
  .map(company => company.name)


  };
}


async function fetchSeasonsData(tvId, seasons = []) {
  const usableSeasons = seasons
    .filter(season => Number(season.season_number) > 0)
    .sort((a, b) => Number(a.season_number) - Number(b.season_number));

  const detailedSeasons = await Promise.all(
    usableSeasons.map(async season => {
      try {
        const data = await tmdbFetch(
          `https://api.themoviedb.org/3/tv/${tvId}/season/${season.season_number}?language=fr-FR`
        );
        return {
          seasonNumber: Number(data.season_number || season.season_number),
          title: data.name || season.name || `Saison ${season.season_number}`,
          overview: data.overview || season.overview || "",
          poster: buildImageUrl(data.poster_path || season.poster_path, "w500"),
          episodes: (data.episodes || []).map(episode => ({
            episodeNumber: Number(episode.episode_number || 0),
            title: episode.name || `Épisode ${episode.episode_number}`,
            overview: episode.overview || "",
            runtime: Number(episode.runtime || 0),
            airDate: episode.air_date || "",
            still: buildImageUrl(episode.still_path, "w500"),
            videoEmbed: ""
          })).filter(episode => episode.episodeNumber > 0)
        };
      } catch (error) {
        return {
          seasonNumber: Number(season.season_number),
          title: season.name || `Saison ${season.season_number}`,
          overview: season.overview || "",
          poster: buildImageUrl(season.poster_path, "w500"),
          episodes: []
        };
      }
    })
  );

  return detailedSeasons.filter(season => season.seasonNumber > 0);
}

function getDirector(credits) {
  const director = (credits.crew || []).find(
    person => person.job === "Director"
  );

  return director?.name || "À compléter";
}

function getCreator(details) {
  const creators = details.created_by || [];

  if (!creators.length) return "À compléter";

  return creators.map(person => person.name).join(", ");
}

async function tmdbFetch(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Erreur TMDb ${response.status}`);
  }

  return response.json();
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