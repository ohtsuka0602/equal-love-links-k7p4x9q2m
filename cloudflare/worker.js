const WORKFLOW_KEYS = Object.freeze({
  members: "update-members.yml",
  schedule: "update-schedule.yml",
});

const WORKFLOW_KEYS_BY_CRON = Object.freeze({
  "43 2,8,14,20 * * *": "members",
  "13 14 * * *": "schedule",
});

const DEFAULT_OWNER = "ohtsuka0602";
const DEFAULT_REPO = "equal-love-links-k7p4x9q2m";
const DEFAULT_REF = "main";
const GITHUB_API_VERSION = "2022-11-28";

export default {
  async scheduled(event, env, ctx) {
    const cron = normalizeCron(event.cron);
    const workflowKey = resolveWorkflowKeyForCron(cron);

    console.log(`Cloudflare scheduled event.cron: ${JSON.stringify(event.cron)}`);
    console.log(`Normalized cron: ${cron || "(empty)"}`);
    console.log(`Dispatch target workflow: ${workflowKey ? WORKFLOW_KEYS[workflowKey] : "(none)"}`);

    ctx.waitUntil(dispatchWorkflowByKey(workflowKey, env, { source: "cron", cron }));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const workflowKey = normalizeWorkflowKey(url.searchParams.get("workflow"));

    if (!workflowKey) {
      return jsonResponse({
        ok: true,
        message: "equal-love-links dispatcher",
        usage: "Use ?workflow=members or ?workflow=schedule for manual dispatch tests.",
      });
    }

    try {
      const result = await dispatchWorkflowByKey(workflowKey, env, { source: "manual", cron: null });
      return jsonResponse({ ok: true, ...result });
    } catch (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }
  },
};

export function normalizeCron(cron) {
  return String(cron || "").trim().replace(/\s+/g, " ");
}

export function resolveWorkflowKeyForCron(cron) {
  const normalizedCron = normalizeCron(cron);
  const exactMatch = WORKFLOW_KEYS_BY_CRON[normalizedCron];

  if (exactMatch) {
    return exactMatch;
  }

  const parts = normalizedCron.split(" ");
  if (parts.length !== 5) {
    return null;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const isDailyWildcard = dayOfMonth === "*" && month === "*" && dayOfWeek === "*";

  if (!isDailyWildcard) {
    return null;
  }

  if (minute === "13" && hour === "14") {
    return "schedule";
  }

  if (minute === "43" && hasSameCsvValues(hour, ["2", "8", "14", "20"])) {
    return "members";
  }

  return null;
}

export function normalizeWorkflowKey(value) {
  const key = String(value || "").trim().toLowerCase();

  if (key === "member") {
    return "members";
  }

  if (key === "members" || key === "schedule") {
    return key;
  }

  return null;
}

export async function dispatchWorkflowByKey(workflowKey, env, context = {}) {
  if (!workflowKey) {
    console.log(`No workflow mapped for source=${context.source || "unknown"}, cron=${context.cron || "(none)"}`);
    return { skipped: true, reason: "no workflow mapped" };
  }

  const workflow = WORKFLOW_KEYS[workflowKey];
  if (!workflow) {
    throw new Error(`Unknown workflow key: ${workflowKey}`);
  }

  return dispatchWorkflow(workflow, env, context);
}

export async function dispatchWorkflow(workflow, env, context = {}) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN secret is required. Set it with `wrangler secret put GITHUB_TOKEN`.");
  }

  const owner = env.GITHUB_OWNER || DEFAULT_OWNER;
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  const ref = env.GITHUB_REF || DEFAULT_REF;
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;

  console.log(`Dispatch source: ${context.source || "unknown"}`);
  console.log(`Dispatch cron: ${context.cron || "(none)"}`);
  console.log(`Dispatch workflow: ${workflow}`);
  console.log(`Dispatch repo/ref: ${owner}/${repo}@${ref}`);

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
    return { skipped: false, workflow, status: response.status, ref };
  }

  const body = await response.text();
  console.error(`${workflow} dispatch failed: ${response.status} ${body}`);
  throw new Error(`${workflow} dispatch failed: ${response.status} ${body}`);
}

function hasSameCsvValues(value, expectedValues) {
  const actual = String(value || "").split(",").map((item) => item.trim()).filter(Boolean).sort();
  const expected = [...expectedValues].sort();

  return actual.length === expected.length && actual.every((item, index) => item === expected[index]);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
