import express from "express"
import axios from "axios"
import { prisma } from "../services/prisma.js"

const router = express.Router()

// Step 1: Generate Plex PIN and return auth URL
router.get("/login-url", async (req, res) => {
  try {
    // Request a PIN from Plex
    const pinResponse = await axios.post(
      "https://plex.tv/api/v2/pins",
      { strong: true },
      {
        headers: {
          "X-Plex-Client-Identifier": process.env.PLEX_CLIENT_ID,
          "X-Plex-Product": "Plex-Trakt-Sync",
          "X-Plex-Version": "1.0.0",
          "X-Plex-Platform": "Web",
          "X-Plex-Platform-Version": "1.0",
          "X-Plex-Device": "Browser",
          "X-Plex-Device-Name": "Plex Trakt Sync",
          Accept: "application/json",
        },
      }
    )

    const { id, code } = pinResponse.data
    const externalUrl = process.env.EXTERNAL_URL || "http://localhost:3000"
    const redirectUri = `${externalUrl}/auth/plex/redirect`
    const authUrl = `https://app.plex.tv/auth#?clientID=${process.env.PLEX_CLIENT_ID}&code=${code}&forwardUrl=${encodeURIComponent(redirectUri)}`

    res.json({ url: authUrl, pinId: id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to generate Plex PIN" })
  }
})

// Step 2: Poll for PIN authorization
router.get("/check-pin/:pinId", async (req, res) => {
  try {
    const { pinId } = req.params
    const pinCheck = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
      headers: {
        "X-Plex-Client-Identifier": process.env.PLEX_CLIENT_ID,
        "X-Plex-Product": "Plex to Trakt",
        Accept: "application/json",
      },
    })

    const authToken = pinCheck.data.authToken
    if (!authToken) {
      return res.json({ authorized: false })
    }

    // Token received, validate and save user
    let r = await axios.get("https://plex.tv/users/account", {
      headers: {
        "X-Plex-Token": authToken,
        Accept: "application/json",
      },
    })

    let account = r.data

    // If the response is wrapped, try to unwrap it
    if (account.user) {
      account = account.user
    }

    // Try alternative endpoint if we don't have ID
    if (!account.id) {
      r = await axios.get("https://plex.tv/api/v2/user", {
        headers: {
          "X-Plex-Token": authToken,
          Accept: "application/json",
        },
      })
      account = r.data
    }

    const plexId = String(account.id || account.uuid || "unknown")
    const username = account.username || account.title || account.friendlyName || account.name || "Plex User"
    const email = account.email || null

    console.log("✓ Plex authenticated:", username)

    // Verify user has access to your server (skip if PLEX_SERVER_ID is not set)
    if (process.env.PLEX_SERVER_ID) {
      const resources = await axios.get("https://plex.tv/api/resources?includeHttps=1", {
        headers: {
          "X-Plex-Token": authToken,
          Accept: "application/xml",
        },
      })

      const xml = resources.data
      if (!xml.includes(process.env.PLEX_SERVER_ID)) {
        return res.status(403).json({ error: "no access to this media server" })
      }
    }

    // Save user
    const user = await prisma.user.upsert({
      where: { plexId },
      update: { plexAuthToken: authToken, plexUsername: username, plexEmail: email },
      create: { plexId, plexAuthToken: authToken, plexUsername: username, plexEmail: email },
    })

    // Store userId in session
    if (req.session) {
      req.session.userId = user.id
    }

    res.json({ authorized: true, userId: user.id, username: username })
  } catch (err: any) {
    console.error("❌ Plex auth error:", err.response?.data || err.message)
    res.status(500).json({ error: "Failed to check PIN status" })
  }
})

// Check user status
router.get("/user-status/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId)

    // Verify the user is accessing their own data
    if (req.session?.userId && req.session.userId !== userId) {
      return res.status(403).json({ ok: false, error: "unauthorized" })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return res.json({ ok: false })
    }
    res.json({
      ok: true,
      username: user.plexUsername || user.plexEmail || "Plex User",
      hasTraktSecrets: !!(user.traktClientId && user.traktClientSecret),
      hasTraktTokens: !!(user.traktAccessToken && user.traktRefreshToken),
      traktClientId: user.traktClientId,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false })
  }
})

// Redirect endpoint - handles the callback from Plex
router.get("/redirect", (req, res) => {
  // Plex redirects here after successful auth
  // Just close the window - the polling will pick up the authorization
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Plex Authentication</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #1a1a1a;
            color: #fff;
          }
          .message {
            text-align: center;
            padding: 40px;
            background: #2a2a2a;
            border-radius: 8px;
          }
          h2 { color: #4caf50; }
        </style>
      </head>
      <body>
        <div class="message">
          <h2>✓ Authentication Successful!</h2>
          <p>You can close this window now.</p>
          <script>
            setTimeout(() => window.close(), 2000);
          </script>
        </div>
      </body>
    </html>
  `)
})

// Also handle GET /callback in case Plex redirects there
router.get("/callback", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Plex Authentication</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #1a1a1a;
            color: #fff;
          }
          .message {
            text-align: center;
            padding: 40px;
            background: #2a2a2a;
            border-radius: 8px;
          }
          h2 { color: #4caf50; }
        </style>
      </head>
      <body>
        <div class="message">
          <h2>✓ Authentication Successful!</h2>
          <p>You can close this window now.</p>
          <script>
            setTimeout(() => window.close(), 2000);
          </script>
        </div>
      </body>
    </html>
  `)
})

// Step 2: callback receives ?auth_token=... from some token exchange flows (alternate setups)
// We provide an endpoint to accept the plex token from frontend and record user
router.post("/callback", async (req, res) => {
  // Accept { plexToken }
  const { plexToken } = req.body
  if (!plexToken) return res.status(400).json({ error: "missing plexToken" })

  // fetch account info
  try {
    const r = await axios.get("https://plex.tv/users/account", {
      headers: { "X-Plex-Token": plexToken },
    })

    const account = r.data
    // account.id, account.username
    const plexId = String(account.id)

    // fetch resources to verify user has access to your server
    const resources = await axios.get("https://plex.tv/api/resources?includeHttps=1", {
      headers: { "X-Plex-Token": plexToken },
    })

    const xml = resources.data // XML string
    // quick check: contains PLEX_SERVER_ID
    if (!xml.includes(process.env.PLEX_SERVER_ID)) {
      return res.status(403).json({ error: "no access to this media server" })
    }

    // upsert user
    const user = await prisma.user.upsert({
      where: { plexId },
      update: { plexAuthToken: plexToken, plexUsername: account.username },
      create: { plexId, plexAuthToken: plexToken, plexUsername: account.username },
    })

    res.json({ ok: true, userId: user.id })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: "failed to validate plex token" })
  }
})

export default router
