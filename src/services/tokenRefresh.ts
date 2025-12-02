import axios from "axios"
import { prisma } from "./prisma.js"

export async function refreshTraktToken(user: any) {
  if (!user.traktRefreshToken) return user

  // Refresh if access token has expired (Trakt access tokens expire after 24 hours)
  if (user.traktExpiresAt && new Date(user.traktExpiresAt) > new Date()) return user

  console.log(`🔄 Refreshing expired access token for ${user.plexUsername}`)

  const externalUrl = process.env.EXTERNAL_URL || "http://localhost:3000"
  const redirectUri = `${externalUrl}/auth/trakt/callback`

  const res = await axios.post("https://api.trakt.tv/oauth/token", {
    refresh_token: user.traktRefreshToken,
    client_id: user.traktClientId,
    client_secret: user.traktClientSecret,
    redirect_uri: redirectUri,
    grant_type: "refresh_token",
  })

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      traktAccessToken: res.data.access_token,
      traktRefreshToken: res.data.refresh_token,
      traktExpiresAt: new Date(Date.now() + res.data.expires_in * 1000),
    },
  })

  return updated
}
