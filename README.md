# Cyber Awareness Selfie App

Campaign selfie app built with HTML, CSS, Bootstrap 5, JavaScript, Node.js, Express and SQLite.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000` and admin dashboard at `http://localhost:3000/admin`.

Captured selfies are stored in a **Private Vercel Blob store** and shown only through the password-protected admin panel.

In Vercel Project Settings → Environment Variables, set:

- `ADMIN_PASSWORD` — required; use a private password with at least 12 characters.
- `ADMIN_SESSION_SECRET` — required; use a random value with at least 32 characters.
- Blob credentials (`BLOB_STORE_ID` with Vercel OIDC, or `BLOB_READ_WRITE_TOKEN`) are added automatically when a **Private Blob store** is connected to the project.

In Vercel Storage, create a Blob store with access set to **Private**, then connect it to this project. Do not use a Public Blob store for participant selfies.

> Camera access works on localhost. A production deployment must use HTTPS.
