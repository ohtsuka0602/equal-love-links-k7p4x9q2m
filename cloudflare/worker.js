const WORKFLOWS_BY_CRON = Object.freeze({
  "43 2,8,14,20 * * *": "update-members.yml",
  "13 14 * * *": "update-schedule.yml",
});

const DEFAULT_OWNER = "ohtsuka0602";
const DEFAULT_REPO = "equal-love-links-k7p4x9q2m";
const DEFAULT_REF = "main";
const GITHUB_API_VERSION = "2022-11-28";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatchWorkflow(event.cron, env));
  },

  async fetch() {
    return new Response("equal-love-links dispatcher is scheduled-only.\n", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};

export async function dispatchWorkflow(cron, env) {
  const workflow = WORKFLOWS_BY_CRON[cron];

  if (!workflow) {
    console.log(`No workflow mapped for cron: ${cron}`);
    return;
  }

  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN secret is required. Set it with `wrangler secret put GITHUB_TOKEN`.");
  }

  const owner = env.GITHUB_OWNER || DEFAULT_OWNER;
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  const ref = env.GITHUB_REF || DEFAULT_REF;
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": "equal-love-links-cloudflare-cron",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref }),
  });

  console.log(`${workflow} dispatch status: ${response.status}`);

  if (response.status === 204) {
    console.log(`${workflow} dispatch accepted for ref ${ref}`);
    return;
  }

  const body = await response.text();
  console.error(`${workflow} dispatch failed: ${response.status} ${body}`);
  throw new Error(`${workflow} dispatch failed: ${response.status} ${body}`);
}