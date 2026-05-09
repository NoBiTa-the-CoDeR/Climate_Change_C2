# Climate Change C² Deployment Guide

This project is now structured for a public Firebase deployment:

- `public/index.html`: the live site
- `functions/index.js`: backend API for safe research + improved geocoding
- `firestore.rules`: shared community posts/comments/likes rules
- `storage.rules`: media/file upload rules

## 1. Create Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Add a **Web App**
4. Enable:
   - **Hosting**
   - **Firestore Database**
   - **Storage**
   - **Authentication** → enable **Anonymous** sign-in

## 2. Put Firebase web config into the page

Open:

- `/Users/luvmain/Documents/New project/public/index.html`

Find `FIREBASE_CONFIG` near the top of the main script and paste your Firebase web config:

```js
const FIREBASE_CONFIG = {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  appId: '...'
};
```

## 3. Install Firebase CLI

```bash
npm install -g firebase-tools
```

Login:

```bash
firebase login
```

## 4. Link this folder to your Firebase project

From:

`/Users/luvmain/Documents/New project`

run:

```bash
firebase use --add
```

## 5. Install backend dependencies

```bash
cd /Users/luvmain/Documents/New\ project/functions
npm install
```

## 6. Set backend secrets

Pick one research provider:

- Recommended: `GEMINI_API_KEY`
- Optional alternative: `ANTHROPIC_API_KEY`

Optional geocoding upgrades for smaller places:

- `LOCATIONIQ_KEY`
- `OPENCAGE_KEY`

Set them:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set LOCATIONIQ_KEY
firebase functions:secrets:set OPENCAGE_KEY
```

If you prefer Anthropic instead:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

## 7. Deploy

From the project root:

```bash
cd /Users/luvmain/Documents/New\ project
firebase deploy
```

## 8. Add your custom domain

After deploy:

1. Open Firebase Hosting
2. Click **Add custom domain**
3. Enter your domain
4. Update DNS records at your domain registrar

Good easy domains:

- `climatec2.com`
- `climatechangec2.com`
- `fundnature.org`
- `growforclimate.com`

## Notes

- Firebase web config is public and safe to expose.
- Research keys are **not** in the page anymore; they stay in backend secrets.
- Community posts, likes, comments, and uploads are now designed for shared public usage.
- If you want a true production launch, a next good step is adding moderation and abuse controls.
