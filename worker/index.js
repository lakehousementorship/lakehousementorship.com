/**
 * Dynamic worker to process html submit form and store in KV storage
 */
import { WorkerEntrypoint } from "cloudflare:workers";

const ALLOWED_FORM_KEYS = [
  "name",
  "email",
  "phone",
  "referers",
  "body",
];

export default class extends WorkerEntrypoint {
  async fetch(request) {
    const url = new URL(request.url);

    // Procesing POST requests
    if (request.method === 'POST') {
      if (url.pathname === '/api/submitIntakeForm') {
        const formData = await request.formData();

        // Validating challenge
        const token = formData.get("cf-turnstile-response");
        const ip = request.headers.get("CF-Connecting-IP") ||
                   request.headers.get("X-Forwarded-For") ||
                   "unknown";

        const validation = await validateTurnstile(this.env, token, ip);

        if (!validation.success) {
          // Token is invalid - reject the submission
          return new Response("Invalid verification", { status: 400 });
        }

        // Processing: Filling the body for data
        const body = {};
        for (const entry of formData.entries()) {
          // Make sure keys are allowed to be stored
          if (!ALLOWED_FORM_KEYS.includes(entry[0])) {
            continue;
          }
          body[entry[0]] = entry[1];
        }

        // Storing to KV & validating
        const ts = Date.now();
        const key = "intake_"+ts+"-"+Math.floor(Math.random()*1000);
        try {
          await this.env.INTAKE_KV.put(key, JSON.stringify(body), {
            metadata: { timestamp: ts },
          });
          const value = await this.env.INTAKE_KV.get(key);
          if (value === null) {
            return new Response("Unable to record sent data", { status: 503 });
          }
        } catch (e) {
          return new Response(e.message + JSON.stringify(e.stack), { status: 500 });
        }
        return new Response('Your message was sent successfully!');
      }
    }

    // Processing GET requests
    if (request.method === 'GET') {
      if (url.pathname === '/api/rssIntakeForm') {
        if (url.searchParams.get('secret') !== await this.env.SECRET_INTAKE.get()) {
          return new Response(null, { status: 403 });
        }
        const resp = await makeRSS(this.env);
        return resp;
      }
      if (url.pathname === '/api/getIntakeForm') {
        if (url.searchParams.get('secret') !== await this.env.SECRET_INTAKE.get()) {
          return new Response(null, { status: 403 });
        }
        const key = url.searchParams.get("key");
        const value = await this.env.INTAKE_KV.get(key);
        if (value === null) {
          return new Response(`Unable to get intake value`, { status: 503 });
        }
        return new Response(value, {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Returning 404
    return new Response(null, { status: 404 });
  }
}

function escape(unsafe) {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("@", "&#64;");
}

// Validate cloudflare Turnstile challenge
async function validateTurnstile(env, token, remoteip) {
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: await env.SECRET_INTAKE_TURNSTILE.get(),
        response: token,
        remoteip: remoteip,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, "error-codes": ["internal-error"] };
  }
}

/**
 * Formats intake data as rss item
 * Data fields:
 *   * name
 *   * email
 *   * phone
 *   * referers - optional
 *   * body
 */
function itemFromData(key, data, timestamp) {
  const date = new Date(timestamp).toUTCString();
  const item = {
    title: `${data.name} ${data.email} (${data.phone})`,
    description: "",
    content: `${data.body}`,
    link: `/api/getIntakeForm?key=${key}`,
    pubDate: date,
    modified: date,
    lastDate: date,
    creator: "",
    categories: [],
    image: "",
    alt:  `${data.referers}`
  };
  return item;
}

async function makeRSS(env) {
  const items = [];
  let item;
  const ret_list = await env.INTAKE_KV.list({prefix: 'intake_'});
  const keys = ret_list.keys;
  const month_ago = Date.now() - 31*24*60*60*1000;
  for (let i = 0; i < keys.length; i++) {
    const it = keys[i];
    // Skipping items older then a month
    if (it.metadata.timestamp < month_ago) {
      continue;
    }

    // Get value from storage and prepare rss item
    try {
      const value = await env.INTAKE_KV.get(it.name);
      const data = JSON.parse(value);
      item = itemFromData(it.name, data, it.metadata.timestamp);
    } catch(e) {
      item = itemFromData(it.name, {
        name: "ERROR",
        body: `Unable to parse value json for key ${it.name} ${e.message}`
      }, it.metadata.timestamp);
    }
    items.push(item);
  }

  const channelTitle = 'Lakehouse Mentorship Intake RSS';
  const channelImageUrl = 'https://lakehousementorship.com/images/icon.png';
  let channelDescription = 'Last month of intake requests';
  let managingEditor = 'help@lakehousementorship.com';
  let webMaster = 'help@lakehousementorship.com';
  let applicationName = 'Lakehouse Mentorship';
  let copyrightHolder = 'Lakehouse Mentorship LLC';
  const generator = 'Lakehouse Mentorship RSS';
  const language = 'en-US'

  const lastBuildDate = (
    items.map((item) => new Date(item.lastDate)).sort((a, b) => b - a)[0] ||
    new Date()
  ).toUTCString();

  const rss = `
<?xml version="1.0" encoding="UTF-8" ?>
<rss
  version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
  xmlns:media="http://search.yahoo.com/mrss/"
>
    <channel>
        <title>${escape(channelTitle)}</title>
        <link></link>
        <generator>${escape(generator)}</generator>
        <language>${escape(language)}</language>
        <copyright>${escape(copyrightHolder)} ${new Date().getFullYear()}, All Rights Reserved</copyright>
        <description>${escape(channelDescription)}</description>
        <lastBuildDate>${escape(lastBuildDate)}</lastBuildDate>
        <sy:updatePeriod>hourly</sy:updatePeriod>
        <sy:updateFrequency>1</sy:updateFrequency>
        <image>
          <title>${escape(channelTitle)}</title>
          <url>${escape(channelImageUrl)}</url>
        </image>
        <managingEditor>${escape(managingEditor)} (${escape(applicationName)} Support)</managingEditor>
        <webMaster>${escape(webMaster)}</webMaster>

${items.map((item) => `        <item>
            <title>${escape(item.title)}</title>
            <pubDate>${escape(item.pubDate)}</pubDate>
            <dc:creator>${escape(item.creator)}</dc:creator>
${item.categories.map((category) => `            <category>${escape(category)}</category>`).join("\n")}
            <description>${escape(item.description)}</description>
            <guid isPermaLink="true">${escape(item.link)}</guid>
            <link>${escape(item.link)}</link>
            <media:content url="${escape(item.image)}" medium="image">
                <media:title type="html">${escape(item.alt)}</media:title>
            </media:content>
            <content:encoded><![CDATA[
                <div style="width:100%;display:block;"><pre>${escape(item.content)}
                </pre></div>]]>
            </content:encoded>
        </item>`).join("\n")}
    </channel>
</rss>`.trim();

  return new Response(rss, {
    headers: new Headers({
      "Content-Type": "text/xml",
      charset: "utf-8",
    }),
  });
}
