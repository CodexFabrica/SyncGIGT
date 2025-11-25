const fs = require('fs').promises;
const path = require('path');
const { fetchNewIssues } = require('./lib/github');
const { summarizeIssue } = require('./lib/gemini');
const { createTask } = require('./lib/tasks');

const LAST_RUN_FILE = path.join(process.cwd(), 'last_run.json');

async function getLastRunData() {
    try {
        const data = await fs.readFile(LAST_RUN_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {}; // First run or file doesn't exist
    }
}

async function updateLastRunData(data) {
    await fs.writeFile(LAST_RUN_FILE, JSON.stringify(data, null, 2));
    console.log(`Updated last run data.`);
}

async function main() {
    console.log("Starting GitHub to Google Tasks Sync...");

    // 1. Get Repositories from Env
    const reposEnv = process.env.GITHUB_REPOS;
    let repos = [];
    if (reposEnv) {
        repos = reposEnv.split(',').map(r => r.trim());
    } else if (process.env.GITHUB_OWNER && process.env.GITHUB_REPO) {
        // Fallback for backward compatibility
        repos = [`${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`];
    }

    if (repos.length === 0) {
        console.error("No repositories configured. Set GITHUB_REPOS in .env (e.g., owner/repo1,owner/repo2).");
        process.exit(1);
    }

    console.log(`Processing repositories: ${repos.join(', ')}`);

    // 2. Load Last Run Data
    const lastRunData = await getLastRunData();
    const currentRunTime = new Date().toISOString();
    let dataUpdated = false;

    try {
        for (const repoString of repos) {
            const [owner, repo] = repoString.split('/');
            if (!owner || !repo) {
                console.error(`Invalid repository format: ${repoString}. Expected owner/repo.`);
                continue;
            }

            console.log(`\n--- Processing ${owner}/${repo} ---`);

            // Determine 'since' for this repo
            // Use specific repo timestamp, or global timestamp (legacy), or null (first run)
            const lastRun = lastRunData[repoString] || lastRunData.timestamp || null;
            console.log(`  Last run for this repo: ${lastRun || "Never (First Run)"}`);

            // 3. Fetch new issues
            console.log("  Fetching new issues from GitHub...");
            const issues = await fetchNewIssues(owner, repo, lastRun);

            if (issues.length === 0) {
                console.log("  No new issues found.");
            } else {
                console.log(`  Found ${issues.length} new issue(s).`);

                // 4. Process each issue
                for (const issue of issues) {
                    console.log(`  Processing issue #${issue.number}: ${issue.title}`);

                    // 5. Summarize with Gemini
                    console.log("    Summarizing with Gemini...");
                    const taskData = await summarizeIssue(issue);
                    console.log(`    Generated Task: "${taskData.title}"`);

                    // 6. Create Google Task
                    // Use the repo name as the task list title
                    console.log(`    Creating Google Task in list "${repo}"...`);
                    await createTask(taskData, repo); // Pass repo name as list title
                    console.log("    Done.");
                }
            }

            // Update timestamp for this repo
            lastRunData[repoString] = currentRunTime;
            dataUpdated = true;
        }

        // 7. Save updated last run times
        if (dataUpdated) {
            // Also update global timestamp for legacy/fallback
            lastRunData.timestamp = currentRunTime;
            await updateLastRunData(lastRunData);
        }

        console.log("\nSync completed successfully.");

    } catch (error) {
        console.error("An error occurred during the sync process:", error);
        process.exit(1);
    }
}

main();
