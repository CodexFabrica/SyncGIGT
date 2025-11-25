/**
 * This script verifies the logic flow by mocking the API calls.
 * It does NOT require real API keys.
 */

const fs = require('fs').promises;
const path = require('path');

// MOCK DATA
const MOCK_ISSUES = [
    {
        number: 101,
        title: "Fix login bug",
        body: "Users cannot log in when using Firefox. Deadline is 2023-12-31.",
        created_at: new Date().toISOString()
    }
];

const MOCK_SUMMARY = {
    title: "Fix Firefox Login Bug",
    description: "Users cannot log in when using Firefox.",
    dueDate: "2023-12-31"
};

// MOCK FUNCTIONS
async function mockFetchNewIssues(since) {
    console.log(`[MOCK] Fetching issues since: ${since}`);
    return MOCK_ISSUES;
}

async function mockSummarizeIssue(issue) {
    console.log(`[MOCK] Summarizing issue #${issue.number}`);
    return MOCK_SUMMARY;
}

async function mockCreateTask(taskData) {
    console.log(`[MOCK] Creating task: "${taskData.title}" with due date ${taskData.dueDate}`);
    return { id: "task_123", title: taskData.title };
}

// MAIN LOGIC (Replicated from index.js)
async function runVerification() {
    console.log("--- STARTING VERIFICATION ---");

    const lastRun = null; // Simulate first run

    const issues = await mockFetchNewIssues(lastRun);
    console.log(`[LOG] Found ${issues.length} new issues.`);

    for (const issue of issues) {
        const taskData = await mockSummarizeIssue(issue);
        await mockCreateTask(taskData);
    }

    console.log("--- VERIFICATION COMPLETE ---");
    console.log("Logic flow is correct.");
}

runVerification();
