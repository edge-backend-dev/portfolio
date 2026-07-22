// Cloudflare Pages Function — POST /api/contact
//
// The ONLY backend piece at launch: it validates a contact submission and
// relays it as an email. It is deliberately provider-agnostic and swappable —
// to route through your own BaaS/D1 later, replace `sendEmail` with a fetch to
// your endpoint. Nothing else in the site needs to change.
//
// Configure via Cloudflare Pages environment variables:
//   RESEND_API_KEY  – API key from https://resend.com (Secret)
//   CONTACT_TO      – where messages are delivered (e.g. your email)
//   CONTACT_FROM    – verified sender, e.g. "Portfolio <hello@yourdomain.com>"

interface Env {
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
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
// ignored rather than trusted, so nothing arbitrary reaches the email body.
const CATEGORY_LABELS: Record<string, string> = {
  inquiry: "Project Inquiry",
  hiring: "Job Opportunity",
  collab: "Collaboration",
  other: "Just Saying Hello",
};

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
  const category = CATEGORY_LABELS[(body.category ?? "").trim()] ?? "";

  const errors: string[] = [];
  if (name.length < 1 || name.length > 100) errors.push("name");
  if (!EMAIL_RE.test(email) || email.length > 200) errors.push("email");
  if (message.length < 1 || message.length > 5000) errors.push("message");
  if (subject.length > 200) errors.push("subject");
  if (company.length > 120) errors.push("company");
  if (errors.length) {
    return json({ ok: false, error: `Invalid fields: ${errors.join(", ")}` }, 400);
  }

  if (!env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) {
    return json(
      { ok: false, error: "Contact endpoint not configured yet." },
      501,
    );
  }

  try {
    await sendEmail(env, { name, email, message, subject, company, category });
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: "Failed to send. Please email directly." }, 502);
  }
};

interface MailData {
  name: string;
  email: string;
  message: string;
  subject: string;
  company: string;
  category: string;
}

async function sendEmail(env: Env, data: MailData) {
  // Subject line carries the inquiry type so it's triageable from the inbox list.
  const tag = data.category ? `[${data.category}] ` : "";
  const line = data.subject || `Portfolio contact from ${data.name}`;

  const header = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    data.company && `Company: ${data.company}`,
    data.category && `Inquiry type: ${data.category}`,
    data.subject && `Subject: ${data.subject}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM,
      to: [env.CONTACT_TO],
      reply_to: data.email,
      subject: `${tag}${line}`,
      text: `${header}\n\n${data.message}`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Email provider responded ${res.status}`);
  }
}
