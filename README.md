# Synchronization between GitHub Issues to Google Tasks (AI-Assisted)

This tool syncs GitHub Issues to Google Tasks, using Google Gemini to summarize the issue content. It will only sync issues of the repositories you specify. Allowed for standard (free) account too.

## Features

- Fetches assigned issues from specified GitHub repositories.
- Summarizes issue details using Google Gemini. If the API doesn't work, then all the issues will be uploaded to Google Tasks
- Creates tasks in Google Tasks with the summary and link.
- Avoids duplicates by creating a `last_run.json` file. Even if you run [`index.js`](index.js) two times, the script recognizes if the issue was already uploaded to Google Tasks

## Setup Guide

This tool requires API keys from GitHub, Google Gemini, and Google Cloud (for Google Tasks). Follow these steps to configure your environment.

### 1. GitHub Personal Access Token (PAT)

1.  Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens).
2.  Click **Generate new token (classic)**.
3.  Give it a name (e.g., "Tasks Sync").
4.  Select the **repo** scope (this allows reading private repositories).
5.  Click **Generate token**.
6.  **Copy the token immediately**. You won't see it again.

### 2. Google Gemini API Key

1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Click **Create API key**.
3.  Select a project or create a new one.
4.  **Copy the API key**.

### 3. Google Tasks API (OAuth2)

This is the most complex part. We need to create a project in Google Cloud and enable the Tasks API.

1.  Go to the [Google Cloud Console](https://console.cloud.google.com).
2.  Create a **New Project** (e.g., "GitHub Tasks Sync").
3.  **Enable the API**:
    *   Go to **APIs & Services > Library**.
    *   Search for "Google Tasks API".
    *   Click **Enable**.
4.  **Configure OAuth Consent Screen**:
    *   Go to **APIs & Services > OAuth consent screen**.
    *   Select **External** (or Internal if you have a Workspace organization).
    *   Fill in the required fields (App name, email).
    *   Add Scope: `https://www.googleapis.com/auth/tasks` (search for "tasks" and select the one for creating/editing tasks).
    *   Add yourself as a **Test User**.
5.  **Create Credentials**:
    *   Go to **APIs & Services > Credentials**.
    *   Click **Create Credentials > OAuth client ID**.
    *   Application type: **Desktop app**.
    *   Name: "Desktop Client".
    *   Click **Create**.
    *   **Download the JSON file**. Rename it to [`credentials.json`](credentials.json) and place it in the root of this project folder.

### 4. Configuration
#### 4.1 Cloning this repository in your machine
1.  Create a [`.env`](.env) file in the directory.
2.  Fill in the values:

```ini
# GitHub
GITHUB_TOKEN=your_github_pat_here
GITHUB_OWNER=   # must be blank
GITHUB_REPOS=owner/repo_name_1, owner/repo_name_2

# Gemini
GEMINI_API_KEY=your_gemini_key_here
```

3. Open the terminal (cmd) and Install dependencies in the directory:
    ```bash
    npm install
    ```
4.  Run the script:
    ```bash
    node index.js
    ```
    On the first run, it will open a browser window to authenticate with Google. You can just follow to allow access to your Tasks. This will create a `token.json` file, and then the tool will run.

    After the tool syncs GitHub issues with Google Tasks, a file named "last_run.json" will be created.

#### 4.2 Using Github
Even using GitHub to sync using a workflow, we need to clone and create the `token.json` file mentioned above. This file is needed.
1. Go to your repository secrets: Settings > Secrets and Variables > Actions > Secrets > New Repository Secret, and create 5 new secrets.

   - For Gemini API KEY
      - title: `GEMINI_API_KEY`
      - secret: `paste_your_gemini_api_key_here`
   - For Google Credentials (Google Tasks)
      - title: `GOOGLE_CREDENTIALS_JSON`
      - secret: `paste_all_the_credentials.json_file_CONTENT_here`
   - To define repositories
      - title: `REPOS_GITHUB`
      - secret: `owner/repo_name_1`, `owner/repo_name_2`, `owner/repo_name_3`
   - For Github Token (API) (Github gives you a free token, but we will use the one we created anyway)
      - title: `TOKEN_GITHUB`
      - secret: `paste_your_github_token_here`
   - To connect to Google Tasks
      - title: `GOOGLE_REFRESH_TOKEN`
      - secret: `paste_the_refresh_token_attribute_in_token.json_file_content_here`
      - In `token.js`, there is a part for refresh_token. Next to it, you can find the code to copy and paste: `"refresh_token":"copy_this_code_and_paste_in_secret"`. Do not use the entire .json file, or the sync will not work.

2. Then, create the following workflow (a file in `repo/.github/workflows` directory)

```yml
name: Sync GitHub Issues to Google Tasks

on:
  schedule:
    - cron: '0 0 * * *' 
  
  push:
    branches: [ "main" ]

  issues:
    types: [opened]
  
  workflow_dispatch:

jobs:
  sync-job:
    runs-on: ubuntu-latest
    
    permissions:
      issues: read
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Create Google Credentials File
        run: echo '${{ secrets.GOOGLE_CREDENTIALS_JSON }}' > credentials.json

      - name: Run Sync Script
        run: node index.js
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GITHUB_OWNER:
          GITHUB_REPOS: ${{ secrets.REPOS_GITHUB }}
          GITHUB_TOKEN: ${{ secrets.TOKEN_GITHUB }}
          GOOGLE_REFRESH_TOKEN: ${{ secrets.GOOGLE_REFRESH_TOKEN }}
````

Check all the secrets (at the end of the code), use the same titles that are defined in your repository secrets.
