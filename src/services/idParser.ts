export function extractIds(guid: any, guids?: any[]) {
  if (!guid && (!guids || guids.length === 0)) return null

  // First try to extract from the primary guid
  if (guid) {
    const extracted = extractFromSingleGuid(guid)
    if (extracted) return extracted
  }

  // If primary guid is in plex:// format or failed, try the guids array
  if (guids && Array.isArray(guids)) {
    for (const guidObj of guids) {
      const id = typeof guidObj === "string" ? guidObj : guidObj?.id
      if (id) {
        const result = extractFromSingleGuid(id)
        if (result) return result
      }
    }
  }

  console.log("⚠️  Unknown GUID format:", guid)
  return null
}

function extractFromSingleGuid(guid: string) {
  if (!guid) return null

  // themoviedb (both formats: tmdb:// and themoviedb://)
  let m
  m = guid.match(/(?:themoviedb|tmdb):\/\/(\d+)/i)
  if (m) return { tmdb: Number(m[1]) }

  m = guid.match(/imdb:\/\/(tt\d+)/i)
  if (m) return { imdb: m[1] }

  // thetvdb with season/episode
  m = guid.match(/(?:thetvdb|tvdb):\/\/(\d+)\/(\d+)\/(\d+)/i)
  if (m) {
    return { tvdb: Number(m[1]), season: Number(m[2]), episode: Number(m[3]) }
  }

  // thetvdb without season/episode (just episode ID)
  m = guid.match(/(?:thetvdb|tvdb):\/\/(\d+)/i)
  if (m) return { tvdb: Number(m[1]) }

  // some guids use com.plexapp.agents.* forms
  m = guid.match(/com\.plexapp\.agents\.themoviedb:\/\/(\d+)/i)
  if (m) return { tmdb: Number(m[1]) }

  m = guid.match(/com\.plexapp\.agents\.imdb:\/\/(tt\d+)/i)
  if (m) return { imdb: m[1] }

  m = guid.match(/com\.plexapp\.agents\.thetvdb:\/\/(\d+)\/(\d+)\/(\d+)/i)
  if (m) {
    return { tvdb: Number(m[1]), season: Number(m[2]), episode: Number(m[3]) }
  }

  m = guid.match(/com\.plexapp\.agents\.thetvdb:\/\/(\d+)/i)
  if (m) return { tvdb: Number(m[1]) }

  return null
}
