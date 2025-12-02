import axios from "axios"
import { refreshTraktToken } from "./tokenRefresh.js"

/**
 * Sync a finished Plex media item to Trakt watch history
 * @param {Object} user - Prisma user record
 * @param {Object} md - Plex Metadata object from webhook
 * @param {Object} ids - Parsed IDs (tmdb, imdb, tvdb)
 */
export async function syncToTrakt(user: any, md: any, ids: any) {
  // Ensure Trakt token is fresh
  user = await refreshTraktToken(user)

  let body
  if (md.type === "movie") {
    body = { movies: [{ ids }] }
  } else if (md.type === "episode") {
    body = { episodes: [{ ids }] }
  } else {
    return // unsupported type
  }

  await axios.post("https://api.trakt.tv/sync/history", body, {
    headers: {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": user.traktClientId,
      Authorization: `Bearer ${user.traktAccessToken}`,
    },
  })
}
