# Plex to Trakt

Automatically sync your Plex watch history to Trakt.tv using webhooks.

> **⚠️ Disclaimer:** This project was generated 100% by AI. I just needed multi-user support and the ability for users to add their own Trakt credentials for this type of sync and I couldn't find any project that fit my needs.

## Features

- 🎬 Real-time sync from Plex to Trakt via webhooks
- 📺 Supports both movies, TV shows and Anime
- 🔄 Automatic token refresh (access tokens every 24h, refresh tokens kept alive)
- 🐳 Docker support for easy deployment
- 🔐 Secure user authentication with Plex and Trakt
- 📊 Multi-user support - only users with access to your Plex server can login and add their Trakt credentials

## Prerequisites

- Plex Media Server with Plex Pass (required for webhooks)
- Trakt.tv account
- Trakt API application credentials ([Create one here](https://trakt.tv/oauth/applications))

## Quick Start with Docker

1. Clone the repository:

```bash
clone the repo
cd Plex-to-Trakt
```

2. Create a `.env` file from the example:

```bash
cp .env.example .env
```

3. Edit `.env` and fill in your configuration:

   - `EXTERNAL_URL`: Your domain if behind reverse proxy (e.g., `https://plex-trakt.yourdomain.com`) or `http://localhost:3000` for local
   - `PLEX_CLIENT_ID`: Generate a unique identifier (e.g., UUID)
   - `PLEX_SERVER_ID`: Your Plex server machine identifier (for server access verification)
   - `PLEX_SERVER_IP`: Your Plex server IP address (for webhook security)
   - `SESSION_SECRET`: A random secret string for session encryption

4. Build and start with Docker:

```bash
docker-compose up -d
```

The Docker container will automatically initialize the database on first run.

5. Open http://localhost:3000 (or your configured external URL) in your browser

6. Authenticate with Plex and configure your Trakt credentials

7. Set up the Plex webhook:
   - In Plex Settings → Webhooks
   - Add webhook URL: `http://your-server:3000/webhooks/plex` (or your external URL)

## Manual Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables in `.env` file

3. Initialize the database:

```bash
npm run prisma:migrate
```

**Important**: This must be run before starting the server for the first time.

```bash
npm run prisma:migrate
```

4. Start the application:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Configuration

### Environment Variables

| Variable         | Description                                                                              | Required |
| ---------------- | ---------------------------------------------------------------------------------------- | -------- |
| `EXTERNAL_URL`   | External URL for the application (e.g., https://yourdomain.com or http://localhost:3000) | Yes      |
| `PLEX_CLIENT_ID` | Unique client identifier for Plex OAuth                                                  | Yes      |
| `PLEX_SERVER_ID` | Your Plex server Machine Identifier (see below for how to find it)                       | Yes      |
| `PLEX_SERVER_IP` | IP address of your Plex server for webhook security                                      | No       |
| `SESSION_SECRET` | Secret key for session encryption                                                        | Yes      |

### Finding Your Plex Server ID

To find your Plex server machine identifier:

1. Open `http://your-plex-server-ip:32400/identity` in your browser
2. Copy the `machineIdentifier` value from the XML response

### Setting Up Trakt API

1. Go to https://trakt.tv/oauth/applications
2. Create a new application
3. Each user will need to provide their own Trakt Client ID and Secret in the web interface

## How It Works

1. **Authentication**: Users authenticate with Plex and configure their Trakt API credentials
2. **Webhooks**: Plex sends webhook events when media is watched
3. **Scrobbling**: When media reaches 90% completion, it's automatically scrobbled to Trakt
4. **Token Management**:
   - Access tokens are refreshed automatically when expired (24h)
   - Refresh tokens are kept alive with weekly maintenance (90d expiration)

## Docker Volumes

The application uses a volume for persistent data:

- `./data:/app/data` - SQLite database storage

## Development

### Database Migrations

Create a new migration:

```bash
npm run prisma:migrate
```

Regenerate Prisma Client:

```bash
npm run prisma:generate
```

## License

MIT

## Contributing

Pull requests are welcome! Please open an issue first to discuss major changes.
