const { _decryptApiKey } = require('../services/llm-classifier')

// ── GitHub Classifier Agent ───────────────────────────────────────────────────
// Takes raw HTML from /issues and /pulls pages for a single repo +
// the logged-in username, sends them to OpenAI, returns structured items.
//
// Output shape per item:
// {
//   number: 123,
//   type: 'issue' | 'pr',
//   title: string,
//   status: 'open' | 'closed' | 'merged' | 'draft',
//   author: string,
//   assignees: string[],
//   labels: string[],
//   milestone: string,
//   updatedAt: string,        // ISO date string
//   createdAt: string,        // ISO date string
//   commentCount: number,
//   reviewStatus: string,     // '' | 'approved' | 'changes requested' | 'review required'
//   url: string,
//   myInvolvement: string[],  // e.g. ['assigned', 'authored', 'review-requested', 'mentioned']
//   priority: 'high' | 'medium' | 'low',
//   summary: string           // 1-line LLM summary
// }

const SYSTEM_PROMPT = `You are a GitHub work item classifier. You will receive pre-extracted issue and PR data from a GitHub repository as a JSON array, plus the logged-in username.

Your job:
1. Process EVERY item in the input array — do not skip any
2. For each item, determine the logged-in user's involvement by checking if they are the author or in assignees
3. Assign a priority: "high" if labels contain bug/urgent/critical/blocker, "medium" for active PRs or assigned issues, "low" otherwise
4. Write a one-sentence summary of what action is needed

Respond ONLY with a raw JSON array — no markdown, no explanation. Start your response with [ and end with ].

Each object must have exactly these fields:
{
  "number": <integer>,
  "type": "issue" or "pr",
  "title": <string>,
  "status": "open" or "closed" or "merged" or "draft",
  "author": <string>,
  "assignees": [<string>],
  "labels": [<string>],
  "milestone": <string or "">,
  "updatedAt": <ISO date string or "">,
  "createdAt": <ISO date string or "">,
  "commentCount": <integer>,
  "reviewStatus": <"" or "approved" or "changes requested" or "review required">,
  "url": <string>,
  "myInvolvement": [<"authored" and/or "assigned" if applicable, else empty array>],
  "priority": "high" or "medium" or "low",
  "summary": <one sentence>
}`

async function classifyGithubRepo({ owner, repo, repoUrl, issuesData, pullsData, loggedInUser }) {
  const apiKey = _decryptApiKey()
  console.log('[github-classifier] API key present:', !!apiKey, '| key prefix:', apiKey ? apiKey.slice(0, 8) + '...' : 'NONE')

  if (!apiKey) {
    console.warn('[github-classifier] No API key — set OPEN_AI_KEY in .env or enter one in onboarding Step 2')
    return { owner, repo, repoUrl, items: [], error: 'No LLM API key configured' }
  }

  const model = process.env.OPEN_AI_MODEL || 'gpt-4o-mini'
  const allRows = [...(issuesData || []), ...(pullsData || [])]
  console.log('[github-classifier] Model:', model)
  console.log('[github-classifier] loggedInUser:', loggedInUser || '(not detected)')
  console.log('[github-classifier] Total pre-extracted rows:', allRows.length)
  console.log('[github-classifier] Rows:', JSON.stringify(allRows, null, 2))

  if (allRows.length === 0) {
    console.warn('[github-classifier] No rows extracted — skipping LLM call')
    return { owner, repo, repoUrl, items: [] }
  }

  const { OpenAI } = require('openai')
  const client = new OpenAI({ apiKey })

  const userContent = `Repository: ${owner}/${repo}
Logged-in user: ${loggedInUser || 'unknown'}

Pre-extracted rows (JSON):
${JSON.stringify(allRows, null, 2)}`

  console.log('[github-classifier] Sending to OpenAI...')

  let raw
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      temperature: 0
    })

    raw = response.choices[0].message.content
    console.log('[github-classifier] Raw LLM response length:', raw.length)
    console.log('[github-classifier] Raw LLM response (first 500 chars):', raw.slice(0, 500))

  } catch (err) {
    console.error('[github-classifier] OpenAI API error:', err.message)
    if (err.status) console.error('[github-classifier] HTTP status:', err.status)
    if (err.error) console.error('[github-classifier] API error detail:', JSON.stringify(err.error))
    return { owner, repo, repoUrl, items: [], error: err.message }
  }

  let items = []
  try {
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)
    console.log('[github-classifier] Parsed type:', Array.isArray(parsed) ? 'array' : typeof parsed)
    if (!Array.isArray(parsed)) console.log('[github-classifier] Parsed keys:', Object.keys(parsed))

    items = Array.isArray(parsed)
      ? parsed
      : (parsed.items || parsed.issues || parsed.pullRequests || parsed.data || Object.values(parsed).find(v => Array.isArray(v)) || [])

    console.log('[github-classifier] Extracted', items.length, 'items')
  } catch (err) {
    console.error('[github-classifier] JSON parse failed:', err.message)
    console.error('[github-classifier] Raw response was:', raw)
    return { owner, repo, repoUrl, items: [], error: 'JSON parse failed: ' + err.message }
  }

  console.group('[github-classifier] Results: ' + owner + '/' + repo + ' (' + items.length + ' items)')
  items.forEach(item => {
    console.log(
      `#${item.number} [${(item.type || '?').toUpperCase()}] ${item.title}`,
      `| status: ${item.status} | priority: ${item.priority}`,
      `| involvement: [${(item.myInvolvement || []).join(', ')}]`,
      `\n  → ${item.summary}`
    )
  })
  console.groupEnd()

  return { owner, repo, repoUrl, items }
}

module.exports = { classifyGithubRepo }
