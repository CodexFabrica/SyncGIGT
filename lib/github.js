const { Octokit } = require("octokit");
require('dotenv').config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

/**
 * Fetches issues from the configured repository that were created after a specific date.
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repository name
 * @param {string} since - ISO 8601 timestamp (YYYY-MM-DDTHH:MM:SSZ)
 * @returns {Promise<Array>} List of issues
 */
async function fetchNewIssues(owner, repo, since) {
    if (!owner || !repo) {
        throw new Error("Owner and repo must be provided");
    }

    try {
        const options = {
            owner,
            repo,
            state: 'open',
            sort: 'created',
            direction: 'asc',
        };

        if (since) {
            options.since = since;
        }

        const response = await octokit.request('GET /repos/{owner}/{repo}/issues', options);

        // Filter out pull requests, as they are also returned by the issues endpoint
        return response.data.filter(issue => !issue.pull_request);
    } catch (error) {
        console.error(`Error fetching issues from GitHub for ${owner}/${repo}:`, error.message);
        throw error;
    }
}

module.exports = { fetchNewIssues };
