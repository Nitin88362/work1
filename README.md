# Cyber Awareness Selfie App

Campaign selfie app built with HTML, CSS, Bootstrap 5, JavaScript, Node.js, Express and SQLite.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000` and admin dashboard at `http://localhost:3000/admin`.

The SQLite database is created automatically at `data/campaign.db`; captured selfies are stored in `data/uploads/` and shown only in the password-protected admin panel.

Before starting locally or on Render, set these environment variables:

- `ADMIN_PASSWORD` — required; use a private password with at least 12 characters.
- `DATA_DIR` — set this to the mounted Persistent Disk path (for example `/var/data`).

Without a Render Persistent Disk, SQLite records and uploaded selfies can disappear when the service restarts or redeploys.

> Camera access works on localhost. A production deployment must use HTTPS.
