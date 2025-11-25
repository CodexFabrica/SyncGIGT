const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

// Scopes necesarios
const SCOPES = ['https://www.googleapis.com/auth/tasks'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Intenta cargar credenciales guardadas.
 * 1. Primero busca el archivo físico 'token.json' (Entorno Local).
 * 2. Si falla, busca la variable de entorno 'GOOGLE_REFRESH_TOKEN' (GitHub Actions).
 */
async function loadSavedCredentialsIfExist() {
    try {
        // 1. Intento Local
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        // 2. Intento GitHub Actions (Inyección de Secreto)
        if (process.env.GOOGLE_REFRESH_TOKEN) {
            console.log("  Authenticating using GOOGLE_REFRESH_TOKEN from secrets...");
            
            // Necesitamos el Client ID y Secret del credentials.json
            // (Este archivo YA existe porque el workflow lo creó con 'echo')
            const content = await fs.readFile(CREDENTIALS_PATH);
            const keys = JSON.parse(content);
            const key = keys.installed || keys.web;

            const credentials = {
                type: 'authorized_user',
                client_id: key.client_id,
                client_secret: key.client_secret,
                refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
            };
            return google.auth.fromJSON(credentials);
        }
        return null;
    }
}

/**
 * Guarda las credenciales en un archivo (Solo para uso Local)
 */
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Autoriza el cliente. 
 * Si estamos en GitHub Actions, usa el token inyectado y SALTA la autenticación de navegador.
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }

    // Si llegamos aquí y estamos en un entorno CI/CD (GitHub Actions), debemos fallar
    // porque no podemos abrir un navegador.
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
        throw new Error("No valid credentials found in CI environment. Did you set GOOGLE_REFRESH_TOKEN secret?");
    }

    // Solo ejecuta esto en tu PC local
    console.log("Initiating new authentication flow. Please check your browser to authorize the app...");
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

/**
 * Busca o crea una lista de tareas.
 */
async function getOrCreateTaskList(service, title) {
    let pageToken = null;
    do {
        const response = await service.tasklists.list({
            maxResults: 100,
            pageToken: pageToken
        });

        const taskLists = response.data.items || [];
        const existingList = taskLists.find(list => list.title === title);

        if (existingList) {
            return existingList.id;
        }

        pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(`  Task list "${title}" not found. Creating it...`);
    const newTaskList = await service.tasklists.insert({
        resource: { title: title }
    });
    return newTaskList.data.id;
}

/**
 * Crea una tarea (y sus subtareas) en Google Tasks.
 */
async function createTask(taskData, taskListTitle) {
    const auth = await authorize();
    const service = google.tasks({ version: 'v1', auth });

    // 1. Obtener ID de la lista
    const taskListId = await getOrCreateTaskList(service, taskListTitle);

    // 2. Preparar Tarea Padre
    const resource = {
        title: taskData.title,
        notes: taskData.description,
    };

    if (taskData.dueDate) {
        resource.due = new Date(taskData.dueDate).toISOString();
    }

    try {
        // 3. Insertar Tarea Padre
        const result = await service.tasks.insert({
            tasklist: taskListId,
            resource: resource,
        });
        
        const parentId = result.data.id;
        console.log(`  Task created in list "${taskListTitle}": ${result.data.title}`);

        // 4. Insertar Subtareas (Si existen)
        if (taskData.subtasks && Array.isArray(taskData.subtasks) && taskData.subtasks.length > 0) {
            console.log(`    Adding ${taskData.subtasks.length} subtasks...`);
            for (const subTitle of taskData.subtasks) {
                await service.tasks.insert({
                    tasklist: taskListId,
                    resource: {
                        title: subTitle
                    },
                    parent: parentId // Vinculamos con el padre
                });
            }
        }

        return result.data;
    } catch (err) {
        console.error('Error creating task:', err);
        throw err;
    }
}

module.exports = { createTask };
