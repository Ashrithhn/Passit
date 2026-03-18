# PassIt

Instant login-free command relay for devs. Built for distro setup scenarios.

## Setup

```bash
npm install
node server.js
```

## Access

- Local: http://localhost:3000
- LAN (phone/other device): http://<your-ip>:3000

Find your IP:
```bash
ip a        # Linux
ipconfig    # Windows
```

## How it works

1. **Send** — paste a command → get a 5-digit code
2. **Receive** — enter the code on any device → get the command
3. Code auto-deletes after first use or 90 seconds

## Specs

- Zero auth, zero login
- In-memory store (no DB required)
- 5000 char limit per payload
- Cryptographically random codes (`crypto.randomInt`)
- Binds to `0.0.0.0` — LAN-ready out of the box

## V2 ideas (don't touch v1)

- File upload (<500KB)
- SSE push (no polling)
- Prefixed codes (A-48291)
- Cloudflare Tunnel for internet access
