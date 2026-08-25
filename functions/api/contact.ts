// Cloudflare Pages Function — POST /api/contact
//
// A thin, credential-holding relay. It validates the submission cheaply, then
// hands it to the `contact` function on my own backend (see
// baas/functions/contact.ts), which stores the message and emails me.
//
// Why the hop instead of calling the backend from the browser: the API key must
// never ship to the client. This file runs on Cloudflare's edge, so the key
// lives in the Pages environment and the browser only ever sees /api/contact.
//
// Configure via Cloudflare Pages environment variables:
//   BAAS_URL      – backend base URL, no trailing slash (Plaintext)
//   BAAS_API_KEY  – project data-plane key, bk_live_… (Secret)

interface Env {
  BAAS_URL?: string;
  BAAS_API_KEY?: string;
}

interface ContactPayload {
  name?: string;
  email?: string;
  message?: string;
  subject?: string;
  company?: string; // real, optional — the visitor's organisation
  category?: string; // inquiry type; see CATEGORY_LABELS
  website?: string; // honeypot — must stay empty
}

// Mirrors CATEGORIES in src/components/apps/Contact.tsx. Unknown values are
// dropped rather than trusted, so nothing arbitrary is forwarded.
const CATEGORIES = new Set(["inquiry", "hiring", "collab", "other"]);

type Ctx = { request: Request; env: Env };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return json({ ok: false, error: "Invalid JSON." }, 400);
  }

  // honeypot: bots fill hidden fields; humans never see it
  if (body.website && body.website.trim() !== "") {
    return json({ ok: true }); // pretend success, drop silently
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const message = (body.message ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const company = (body.company ?? "").trim();
  const category = (body.category ?? "").trim();

  // The backend validates all of this again — it is the real gate. Repeating it
  // here just means junk never costs a round trip or a rate-limit slot.
  const errors: string[] = [];
  if (name.length < 1 || name.length > 100) errors.push("name");
  if (!EMAIL_RE.test(email) || email.length > 200) errors.push("email");
  if (message.length < 1 || message.length > 5000) errors.push("message");
  if (subject.length > 200) errors.push("subject");
  if (company.length > 120) errors.push("company");
  if (errors.length) {
    return json({ ok: false, error: `Invalid fields: ${errors.join(", ")}` }, 400);
  }

  if (!env.BAAS_URL || !env.BAAS_API_KEY) {
    return json({ ok: false, error: "Contact endpoint not configured yet." }, 501);
  }

  try {
    const res = await fetch(
      `${env.BAAS_URL.replace(/\/$/, "")}/api/functions/contact`,
      {
        method: "POST",
        headers: {
          "x-api-key": env.BAAS_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          message,
          subject,
          company,
          category: CATEGORIES.has(category) ? category : "",
          // Server-set, so it cannot be forged by the client. Used only to
          // triage spam from the dashboard.
          meta: {
            ip: request.headers.get("cf-connecting-ip") ?? "",
            userAgent: request.headers.get("user-agent") ?? "",
            referer: request.headers.get("referer") ?? "",
          },
        }),
        // The backend caps a run at 30s; give up first rather than leave the
        // visitor watching a spinner.
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      // 4xx here means the backend rejected the payload — pass its reason
      // through so the form can show something useful. 5xx stays opaque.
      if (res.status >= 400 && res.status < 500) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        return json({ ok: false, error: detail?.error ?? "Invalid submission." }, 400);
      }
      throw new Error(`Backend responded ${res.status}`);
    }

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Failed to send. Please email directly." }, 502);
  }
};
