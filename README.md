# Portfolio — OS-mimicking portfolio

A portfolio that dresses itself up as the operating system you're viewing it on:
**Windows 11** on Windows, **macOS** on Mac, **iOS** on iPhone/iPad, and
**Android One UI** on Android. Auto-detected, with a manual override in Settings.

- **Stack:** Astro (static) + React islands + Tailwind v4, deployed to Cloudflare Pages.
- **Performance:** content is server-rendered (FCP/LCP ~150ms in testing), zero external
  requests, system fonts, inline SVG icons. The interactive shell hydrates as one island.
- **Backend:** none, except a single Cloudflare Pages Function for the contact form.

## Commands

```bash
npm install       # install deps
npm run dev       # local dev server (Astro)
npm run build     # production build → dist/
npm run preview   # serve the built site locally
npm run check     # type-check
```

> Pages Functions (the contact form) don't run under `astro dev`. To test them
> locally, build then run `npx wrangler pages dev dist`.

## Previewing each OS look

Append `?os=windows`, `?os=macos`, `?os=ios`, or `?os=android` to the URL to force
a specific skin (handy for sharing a specific look). Users can also switch in **Settings**.

## Content lives in `src/data/`

All copy is typed data — the visual shell never needs editing to change content.

- `profile.ts` — name, role, bio, links, availability
- `resume.ts` — experience & education
- `services.ts` — what you offer
- `skills.ts` — skill groups
- `projects.ts` — **empty until a project ships** (shows "coming soon" tiles)
- `apps.ts` — the app registry every skin reads

### Placeholders to fill in

Search the codebase for `⟨` — every placeholder is wrapped in `⟨…⟩` so nothing
fabricated ships by accident (location, social links, resume dates, education).

### Adding a real project

When a project is done, push an entry into the `projects` array in
`src/data/projects.ts` (see the example comment there). No shell code changes needed.

## Contact form

The form posts to `/api/contact` (`functions/api/contact.ts`). To make it send mail,
set these environment variables in **Cloudflare Pages → Settings → Environment variables**:

| Variable         | Example                              |
| ---------------- | ------------------------------------ |
| `RESEND_API_KEY` | `re_...` (from https://resend.com)   |
| `CONTACT_TO`     | `you@example.com`                    |
| `CONTACT_FROM`   | `Portfolio <hello@yourdomain.com>`   |

Until configured, the form returns 501 and the UI shows your direct email.
To route it through your own BaaS later, swap the `sendEmail` call in
`functions/api/contact.ts` for a fetch to your endpoint — nothing else changes.

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare Pages → **Create project** → connect the repo.
3. Build settings: **Build command** `npm run build`, **Output directory** `dist`.
4. (Optional) Add the contact-form env vars above.
5. Deploy. The `functions/` directory is picked up automatically as Pages Functions.
