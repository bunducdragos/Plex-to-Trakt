import express from "express"
import session from "express-session"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Validate required environment variables
const requiredEnvVars = ["EXTERNAL_URL", "PLEX_CLIENT_ID", "PLEX_SERVER_ID", "SESSION_SECRET"]

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName])

if (missingEnvVars.length > 0) {
  console.error("❌ Error: Missing required environment variables!")
  console.error("")
  console.error("Missing variables:")
  missingEnvVars.forEach((varName) => console.error(`  - ${varName}`))
  console.error("")
  console.error("Please create a .env file with all required variables.")
  console.error("You can copy .env.example to get started:")
  console.error("  cp .env.example .env")
  console.error("")
  process.exit(1)
}

// Check if generated Prisma client exists
const generatedPath = path.join(process.cwd(), "generated", "prisma")
if (!existsSync(generatedPath)) {
  console.error("❌ Error: Prisma Client not generated!")
  console.error("")
  console.error("Please run the following command:")
  console.error("  npm run prisma:generate")
  console.error("")
  process.exit(1)
}

// Import after checks
const { default: webhookRouter } = await import("./routes/webhook.js")
const { default: authPlexRouter } = await import("./routes/authPlex.js")
const { default: authTraktRouter } = await import("./routes/authTrakt.js")
const { startTokenRefreshCron } = await import("./services/tokenRefreshCron.js")

const app = express()
const PORT = 3000

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true if using HTTPS
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
)

// static UI
app.use(express.static("public"))

app.use(express.json())

app.use("/webhooks", webhookRouter)
app.use("/auth/plex", authPlexRouter)
app.use("/auth/trakt", authTraktRouter)

// API endpoint for frontend configuration
app.get("/api/config", (req, res) => {
  res.json({
    externalUrl: process.env.EXTERNAL_URL || "http://localhost:3000",
  })
})

app.get("/", (req: any, res: any) => res.sendFile(path.resolve("public/index.html")))

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`)
  startTokenRefreshCron()
})
