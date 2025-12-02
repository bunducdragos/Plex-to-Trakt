import express from "express"
import multer from "multer"
import { prisma } from "../services/prisma.js"
import { extractIds } from "../services/idParser.js"
import { syncToTrakt } from "../services/syncTrakt.js"

const router = express.Router()
const upload = multer()

// Test endpoint to verify webhook is reachable
router.get("/plex", (req, res) => {
  console.log("GET request to /webhooks/plex - webhook is reachable!")
  res.send("Webhook endpoint is working! Use POST to send webhook data.")
})

router.post("/plex", upload.single("thumb"), async (req, res) => {
  // Security: Only accept webhooks from Plex server IP
  if (process.env.PLEX_SERVER_IP) {
    // Use direct socket IP only (don't trust x-forwarded-for header as it can be spoofed)
    const clientIp = req.socket.remoteAddress
    const allowedIp = process.env.PLEX_SERVER_IP

    // Extract IP from potential IPv6 format (::ffff:192.168.1.1 -> 192.168.1.1)
    const normalizedIp = String(clientIp).replace(/^::ffff:/, "")

    if (normalizedIp !== allowedIp) {
      console.log("🚫 Webhook rejected from unauthorized IP:", normalizedIp)
      return res.status(403).send("forbidden")
    }
  }

  let payload

  try {
    // Plex sends form-encoded data with a 'payload' field
    if (req.body.payload) {
      payload = JSON.parse(req.body.payload)
    } else if (typeof req.body === "string") {
      payload = JSON.parse(req.body)
    } else {
      payload = req.body
    }
  } catch (e: any) {
    console.error("Failed to parse webhook:", e.message)
    return res.status(400).send("invalid body")
  }

  const { event, Metadata: md, Account } = payload

  if (!Account || !Account.id) {
    return res.status(200).send("no account")
  }

  const user = await prisma.user.findUnique({ where: { plexId: String(Account.id) } })

  if (!user) {
    console.log("Unknown user - Plex ID:", Account.id)
    return res.status(200).send("unknown user")
  }

  // Only process media.scrobble events (when Plex marks as watched at 90% viewed)
  // This prevents duplicate syncs on pause/resume/stop events
  const finished = event === "media.scrobble"

  if (!finished) {
    return res.status(200).send("ignored")
  }

  console.log("📺 Processing:", md?.title, "for", user.plexUsername)

  // Pass the Guid array from metadata to help resolve plex:// format GUIDs
  const ids = extractIds(md.guid, md.Guid)
  if (!ids) {
    console.log("❌ Could not extract IDs from:", md?.guid)
    if (md.Guid && Array.isArray(md.Guid)) {
      console.log("   Available GUIDs:", md.Guid.map((g: any) => (typeof g === "string" ? g : g?.id)).join(", "))
    }
    return res.status(200).send("no ids")
  }

  console.log("✓ Extracted IDs:", ids)

  try {
    await syncToTrakt(user, md, ids)
    console.log("✅ Synced to Trakt successfully")
    return res.status(200).send("ok")
  } catch (err: any) {
    console.error("❌ Error syncing to Trakt:", err.message)
    return res.status(500).send("error")
  }
})

export default router
