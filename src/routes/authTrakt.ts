import express from "express"
import axios from "axios"
import { prisma } from "../services/prisma.js"

const router = express.Router()

// Save user-provided trakt client_id and client_secret
router.post("/save-secrets", async (req, res) => {
  const { userId, traktClientId, traktClientSecret } = req.body
  if (!userId || !traktClientId || !traktClientSecret) return res.status(400).json({ error: "missing" })

  // Verify the user is modifying their own data
  if (req.session?.userId !== Number(userId)) {
    return res.status(403).json({ error: "unauthorized" })
  }

  await prisma.user.update({ where: { id: Number(userId) }, data: { traktClientId, traktClientSecret } })
  res.json({ ok: true })
})

// Remove Trakt credentials and tokens
router.post("/remove", async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: "missing userId" })

  // Verify the user is modifying their own data
  if (req.session?.userId !== Number(userId)) {
    return res.status(403).json({ error: "unauthorized" })
  }

  try {
    await prisma.user.update({
      where: { id: Number(userId) },
      data: {
        traktClientId: null,
        traktClientSecret: null,
        traktAccessToken: null,
        traktRefreshToken: null,
        traktExpiresAt: null,
      },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "failed to remove trakt credentials" })
  }
})

// Start trakt oauth
router.get("/authorize", async (req, res) => {
  const { userId } = req.query

  // Verify the user is accessing their own data
  if (req.session?.userId !== Number(userId)) {
    return res.status(403).json({ error: "unauthorized" })
  }

  const user = await prisma.user.findUnique({ where: { id: Number(userId) } })
  if (!user || !user.traktClientId) return res.status(400).json({ error: "user or traktClientId missing" })

  const externalUrl = process.env.EXTERNAL_URL || "http://localhost:3000"
  const redirectUri = `${externalUrl}/auth/trakt/callback`
  const url = `https://trakt.tv/oauth/authorize?response_type=code&client_id=${user.traktClientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
  res.json({ url })
})

// GET callback: Trakt redirects here with code
router.get("/callback", async (req, res) => {
  const { code, state } = req.query

  if (!code) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Trakt Authentication</title>
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
            h2 { color: #f44336; }
          </style>
        </head>
        <body>
          <div class="message">
            <h2>❌ Authentication Failed</h2>
            <p>No authorization code received.</p>
          </div>
        </body>
      </html>
    `)
  }

  // Store code in session or pass back to opener
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Trakt Authentication</title>
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
          <h2>✓ Trakt Authorization Successful!</h2>
          <p>Completing setup...</p>
        </div>
        <script>
          // Send code back to opener window
          if (window.opener) {
            window.opener.postMessage({ type: 'trakt-code', code: '${code}' }, '*');
            setTimeout(() => window.close(), 1000);
          } else {
            document.querySelector('.message p').textContent = 'You can close this window now.';
          }
        </script>
      </body>
    </html>
  `)
})

// Callback: exchange code and store tokens
router.post("/callback", async (req, res) => {
  const { userId, code } = req.body

  // Verify the user is modifying their own data
  if (req.session?.userId !== Number(userId)) {
    return res.status(403).json({ error: "unauthorized" })
  }

  const user = await prisma.user.findUnique({ where: { id: Number(userId) } })
  if (!user || !user.traktClientId || !user.traktClientSecret) return res.status(400).json({ error: "missing" })

  try {
    const externalUrl = process.env.EXTERNAL_URL || "http://localhost:3000"
    const redirectUri = `${externalUrl}/auth/trakt/callback`

    const resp = await axios.post("https://api.trakt.tv/oauth/token", {
      code,
      client_id: user.traktClientId,
      client_secret: user.traktClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        traktAccessToken: resp.data.access_token,
        traktRefreshToken: resp.data.refresh_token,
        traktExpiresAt: new Date(Date.now() + resp.data.expires_in * 1000),
      },
    })

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "failed to exchange trakt code" })
  }
})

export default router
