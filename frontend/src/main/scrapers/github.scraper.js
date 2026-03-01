const { launchBrowser, navigateTo, fetchInPage, closeBrowser } = require('./browser')
const { getDb } = require('../db')
const { v4: uuidv4 } = require('uuid')

function parseGithubRepoUrl(repoUrl) {
  const url = new URL(repoUrl)
  const parts = url.pathname.replace(/^\//, '').replace(/\/$/, '').split('/')
  if (parts.length < 2) throw new Error('Invalid GitHub repo URL: ' + repoUrl)
  const owner = parts[0]
  const repo = parts[1]
  return { owner, repo }
}

async function scrapeGithubRepo(repoUrl, profileDirName, workspaceId, profileId, integrationId) {
  const { owner, repo } = parseGithubRepoUrl(repoUrl)

  await launchBrowser(profileDirName)
  await navigateTo('https://github.com')

  const headers = {
    headers: { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  }

  // Test authentication
  const authResp = await fetchInPage('https://api.github.com/user', headers)
  if (!authResp.ok) {
    await closeBrowser()
    return { count: 0, error: 'Please sign in to GitHub in this browser profile' }
  }

  const db = getDb()
  let totalFetched = 0
  let page = 1

  const insertItem = db.prepare(`
    INSERT OR REPLACE INTO github_items
      (id, workspace_id, profile_id, integration_id, repo_url, type, title, status, repo, author, updated_at, url, body, synced_at, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertReview = db.prepare(`
    INSERT OR REPLACE INTO github_reviews (id, github_id, reviewer, state, submitted_at)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insertFile = db.prepare(`
    INSERT OR REPLACE INTO github_changed_files (id, github_id, filename, status, additions, deletions)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  while (true) {
    const resp = await fetchInPage(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=50&page=${page}`,
      headers
    )
    if (!resp.ok) break

    const items = JSON.parse(resp.body)
    if (!Array.isArray(items) || items.length === 0) break

    for (const item of items) {
      const isPr = !!item.pull_request
      const type = isPr ? 'pr' : 'issue'

      db.transaction(() => {
        insertItem.run(
          item.number,
          workspaceId,
          profileId,
          integrationId,
          repoUrl,
          type,
          item.title || '',
          item.state || '',
          `${owner}/${repo}`,
          item.user?.login || '',
          item.updated_at || null,
          item.html_url || '',
          item.body || null,
          Date.now(),
          JSON.stringify(item)
        )
      })()

      if (isPr) {
        // Fetch reviews
        const reviewsResp = await fetchInPage(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${item.number}/reviews`,
          headers
        )
        if (reviewsResp.ok) {
          const reviews = JSON.parse(reviewsResp.body)
          db.transaction(() => {
            for (const r of (reviews || [])) {
              insertReview.run(uuidv4(), item.number, r.user?.login || '', r.state || '', r.submitted_at || null)
            }
          })()
        }

        // Fetch changed files
        const filesResp = await fetchInPage(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${item.number}/files`,
          headers
        )
        if (filesResp.ok) {
          const files = JSON.parse(filesResp.body)
          db.transaction(() => {
            for (const f of (files || [])) {
              insertFile.run(uuidv4(), item.number, f.filename || '', f.status || '', f.additions || 0, f.deletions || 0)
            }
          })()
        }
      }
    }

    totalFetched += items.length
    if (items.length < 50) break
    page++
  }

  await closeBrowser()
  return { count: totalFetched }
}

module.exports = { scrapeGithubRepo }
