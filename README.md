<div align="center">
  <img src="public/icon-512.png" alt="nest logo" width="120" />
  
  <h1>🐣 nest.</h1>
  <p><b>split expenses, keep the peace 🌱</b></p>

  [Live Demo](https://nest-app.vercel.app) • [Report a Bug](https://github.com/fernandohalim/nest-app/issues)
</div>

## 👋 what is nest?
**nest.** is a beautifully bouncy expense splitter built for trips, shared tabs, and keeping friendships intact. no more spreadsheet math or arguing over who had the extra fries—just drop the expenses in the nest and let it figure out exactly who owes who.


## ✨ features
* 🍕 **exact line-item splitting:** split the tab equally, by custom adjustments, or exactly by who consumed what.
* 🤝 **optimized settlements:** the transparent ledger calculates the absolute minimum number of transactions needed to settle up the whole group.
* 📱 **bouncy & playful ui:** a highly interactive, custom-built interface that makes dealing with money actually feel fun.
* 🔒 **secure & synced:** real-time cloud syncing backed by supabase authentication and row-level security.

## 🛠️ tech stack
this project was built with a modern, high-performance stack:
* **framework:** [Next.js 16](https://nextjs.org/) (App Router)
* **library:** [React 19](https://react.dev/)
* **styling:** [TailwindCSS v4](https://tailwindcss.com/)
* **database & auth:** [Supabase](https://supabase.com/)
* **state management:** [Zustand](https://zustand-demo.pmnd.rs/)

## 🚀 getting started

to run this project locally, you'll need node.js installed and a supabase project set up.

```bash
# clone the repository
git clone [https://github.com/fernandohalim/nest-app.git](https://github.com/fernandohalim/nest-app.git)

# jump into the directory
cd nest-app

# install the dependencies
npm install

# copy the env file and add your supabase keys
cp .env.example .env.local

# start the local development server
npm run dev
```

## 📜 license

this project is licensed under the MIT License - see the **LICENSE** file for details.