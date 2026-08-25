/**
 * BaaS function — `contact`
 *
 * Deployed to my own backend (project 840759a5…) and invoked, server-to-server
 * only, by the site's Cloudflare Pages Function at functions/api/contact.ts.
 * The browser never reaches this: it has no API key, and this function's
 * visibility is NOT public, so the open webhook URL (/functions/:ref/:name)
 * returns 404 for it.
 *
 * Two jobs, in this order of importance:
 *   1. STORE the message in the `contact_messages` collection. This is the
 *      source of truth — a message that is saved is never lost, even if email
 *      is misconfigured, over quota, or the provider is down.
 *   2. NOTIFY by email, best effort. A failure here is logged and swallowed:
 *      the visitor still gets a success response because their message *is*
 *      safely stored. Losing a lead to a mail outage would be the worse bug.
 *
 * Deploy:  baas functions deploy contact --file ./baas/functions/contact.ts
 * Test:    baas functions test   contact --file ./baas/functions/contact.ts
 *
 * Runtime globals (no imports exist in this sandbox): data, secrets, email,
 * fetch, response, crypto, console.
 */

declare const data: {
  create: (collection: string, value: unknown) => Promise<{ id: string }>;
};
declare const secrets: { get: (key: string) => Promise<string | null> };
declare const email: {
  send: (m: { to: string; subject: string; html?: string; text?: string }) => Promise<unknown>;
};
declare function response(body: unknown, init?: { status?: number }): unknown;

interface ContactPayload {
  name?: string;
  email?: string;
  message?: string;
  subject?: string;
  company?: string;
  category?: string;
  website?: string; // honeypot — must stay empty
  meta?: { ip?: string; userAgent?: string; referer?: string };
}

interface FnRequest {
  method: string;
  body: unknown;
  trigger: string;
}

/** Mirrors CATEGORIES in src/components/apps/Contact.tsx. */
const CATEGORY_LABELS: Record<string, string> = {
  inquiry: "Project Inquiry",
  hiring: "Job Opportunity",
  collab: "Collaboration",
  other: "Just Saying Hello",
};

/**
 * Where the notification goes. Kept in the vault so this source carries no
 * personal address; the fallback means a fresh project still notifies me
 * before the secret exists. Forwards to my inbox via Cloudflare Email Routing.
 */
const FALLBACK_NOTIFY_TO = "portfolio@oluwadamilaredavid.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Escape before interpolating visitor text into the notification's HTML. */
function esc(s: string): string {
  return s
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;");
}

export default async function contact(req: FnRequest) {
  if (req.method !== "POST" && req.trigger !== "test") {
    return response({ ok: false, error: "Use POST." }, { status: 405 });
  }

  const body = (req.body || {}) as ContactPayload;

  // Honeypot: bots fill hidden fields, humans never see them. Report success so
  // the bot has nothing to learn, and write nothing.
  if (str(body.website) !== "") {
    return { ok: true };
  }

  const name = str(body.name);
  const from = str(body.email);
  const message = str(body.message);
  const subject = str(body.subject);
  const company = str(body.company);
  const category = CATEGORY_LABELS[str(body.category)] || "";

  const errors: string[] = [];
  if (name.length < 1 || name.length > 100) errors.push("name");
  if (!EMAIL_RE.test(from) || from.length > 200) errors.push("email");
  if (message.length < 1 || message.length > 5000) errors.push("message");
  if (subject.length > 200) errors.push("subject");
  if (company.length > 120) errors.push("company");
  if (errors.length) {
    return response(
      { ok: false, error: "Invalid fields: " + errors.join(", ") },
      { status: 400 },
    );
  }

  const meta = (body.meta || {}) as { ip?: string; userAgent?: string; referer?: string };
  const receivedAt = new Date().toISOString();

  // 1. Store. If this throws, the caller gets a 500 and the visitor is told to
  //    email directly — correct, because nothing was kept.
  const record = await data.create("contact_messages", {
    name: name,
    email: from,
    message: message,
    subject: subject,
    company: company,
    category: category,
    status: "new", // "new" | "read" | "replied" | "archived" — set from the dashboard
    receivedAt: receivedAt,
    meta: {
      ip: str(meta.ip).slice(0, 60),
      userAgent: str(meta.userAgent).slice(0, 300),
      referer: str(meta.referer).slice(0, 300),
      source: "portfolio",
    },
  });

  // 2. Notify. Best effort — the message is already safe.
  let notified = false;
  try {
    const to = (await secrets.get("CONTACT_NOTIFY_TO")) || FALLBACK_NOTIFY_TO;
    const tag = category ? "[" + category + "] " : "";
    const line = subject || "Portfolio contact from " + name;

    const rows: string[] = [
      "<tr><td><b>Name</b></td><td>" + esc(name) + "</td></tr>",
      "<tr><td><b>Email</b></td><td>" + esc(from) + "</td></tr>",
    ];
    if (company) rows.push("<tr><td><b>Company</b></td><td>" + esc(company) + "</td></tr>");
    if (category) rows.push("<tr><td><b>Inquiry type</b></td><td>" + esc(category) + "</td></tr>");
    if (subject) rows.push("<tr><td><b>Subject</b></td><td>" + esc(subject) + "</td></tr>");

    const text = [
      "Name: " + name,
      "Email: " + from,
      company ? "Company: " + company : "",
      category ? "Inquiry type: " + category : "",
      subject ? "Subject: " + subject : "",
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");

    await email.send({
      to: to,
      subject: tag + line,
      text: text,
      html:
        '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6">' +
        '<table cellpadding="4" style="border-collapse:collapse;margin-bottom:16px">' +
        rows.join("") +
        "</table>" +
        '<div style="white-space:pre-wrap;padding:12px 14px;border-left:3px solid #ccc">' +
        esc(message) +
        "</div>" +
        '<p style="color:#888;font-size:12px;margin-top:20px">Reply to ' +
        esc(from) +
        ". Stored as " +
        esc(record.id) +
        " in contact_messages.</p></div>",
    });
    notified = true;
  } catch (e) {
    // Surfaced in the function's logs / audit trail, not to the visitor.
    console.error("contact: notification email failed:", (e as Error).message);
  }

  return { ok: true, id: record.id, notified: notified };
}
