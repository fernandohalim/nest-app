<div align="center">
  <img src="public/icon-512.png" alt="nest logo" width="120" />
  
  # 🐣 nest.
  **split expenses, keep the peace 🌱**

  [![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
  [![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_v4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
  [![Gemini AI](https://img.shields.io/badge/Gemini_2.5_Flash-8E75B2?style=flat-square&logo=googlebard&logoColor=white)](https://aistudio.google.com/)

  [Live Demo](https://nest-app.vercel.app) • [Report a Bug](https://github.com/fernandohalim/nest-app/issues)

</div>

## 👋 what is nest?

**nest.** is a beautifully bouncy expense splitter built for trips, shared tabs, and keeping friendships intact. no more spreadsheet math or arguing over who had the extra fries—just drop the expenses in the nest and let it figure out exactly who owes who.

## ✨ features

* 📸 **ai receipt scanner:** skip manual data entry. upload a photo of your bill, and nest magically extracts the items, prices, merchant, and date using **gemini 2.5 flash**.
* 🧾 **exportable group receipts:** generate and download beautiful, high-res, itemized receipt images (complete with individual breakdowns) perfect for dropping directly into whatsapp or line.
* 🌍 **smart multi-currency:** taking a trip abroad? nest handles multiple currencies perfectly, dynamically adjusting decimal formatting for currencies like idr, jpy, and usd.
* 🍕 **exact line-item splitting:** split the tab equally, by custom adjustments, or exactly by who consumed what (with tax and tip distributed fairly!).
* 🤝 **optimized settlements:** our transparent ledger calculates the absolute minimum number of transactions needed to settle up the whole group.
* 💸 **one-tap settle up:** easily mark debts as paid and watch the ledger balance itself perfectly to zero.
* 📱 **bouncy & playful ui:** a highly interactive, custom-built interface that makes dealing with money actually feel fun.
* 🔒 **secure & synced:** real-time cloud syncing backed by supabase authentication and row-level security.

## 🛠️ tech stack

this project was built with a modern, high-performance stack:

* **framework:** [Next.js 16](https://nextjs.org/) (App Router)
* **library:** [React 19](https://react.dev/)
* **styling:** [TailwindCSS v4](https://tailwindcss.com/)
* **database & auth:** [Supabase](https://supabase.com/)
* **state management:** [Zustand](https://zustand-demo.pmnd.rs/)
* **ai vision:** [Google Gemini 2.5 Flash](https://aistudio.google.com/)

## 🚀 getting started

to run this project locally, you'll need node.js installed, a supabase project set up, and a free google gemini api key.

```bash
# clone the repository
git clone [https://github.com/fernandohalim/nest-app.git](https://github.com/fernandohalim/nest-app.git)

# jump into the directory
cd nest-app

# install the dependencies
npm install

# add your supabase keys and gemini api key to .env.local
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# GEMINI_API_KEY=...

# start the local development server
npm run dev
```

## 📜 license

this project is licensed under the MIT License - see the **LICENSE** file for details.
