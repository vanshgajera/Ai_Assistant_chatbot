# ✈️ Wanderly – AI Travel Assistant

React (Vite) + Express + Gemini API

## 1. Software install karo (ek baar)
- Node.js LTS (20+): https://nodejs.org
- VS Code: https://code.visualstudio.com

Check karo:
```bash
node -v
npm -v
```

## 2. Gemini API key
https://aistudio.google.com/app/apikey se key banao.

## 3. Zip extract karo aur setup karo
```bash
cd ai-travel-assistant
npm run install:all
```

`server` folder mein `.env.example` ko copy karke `.env` naam do:
- Windows: `copy server\.env.example server\.env`
- Mac/Linux: `cp server/.env.example server/.env`

Phir `server/.env` kholo aur `GEMINI_API_KEY=` ke aage apni key paste karo.

## 4. Chalao
```bash
npm run dev
```
- Frontend: http://localhost:5173
- Backend:  http://localhost:5000

## Folder structure
```
ai-travel-assistant/
├── package.json        (dono ko ek saath chalata hai)
├── server/             (Express + Gemini)
│   ├── index.js        (/api/plan, /api/chat)
│   └── .env
└── client/             (React UI)
    └── src/
        ├── App.jsx
        ├── index.css
        └── components/ (ItineraryView, ChatBot)
```

## Errors
- **Model not found:** `server/.env` mein `GEMINI_MODEL` AI Studio ke latest Flash model par set karo.
- **Port busy:** `.env` mein `PORT` badlo aur `client/vite.config.js` ka proxy bhi usi port par karo.
- `.env` kabhi GitHub par upload mat karna.
