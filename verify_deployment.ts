// import fetch from 'node-fetch'; // Built-in in Node 18+
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3001';

async function verify() {
    console.log('Starting verification...');

    // 1. Check Health
    try {
        const health = await fetch(`${API_URL}/health`).then(r => r.json());
        console.log('Server Health:', health);
    } catch (e) {
        console.error('Server is not running. Please start the server first.');
        process.exit(1);
    }

    // 2. Create Project
    const projectName = `test-project-${Date.now()}`;
    console.log(`Creating project: ${projectName}...`);

    const createRes = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: projectName,
            gitUrl: 'https://github.com/Jhvictor4/apps-sdk-template',
        }),
    });

    if (!createRes.ok) {
        console.error('Failed to create project:', await createRes.text());
        process.exit(1);
    }

    const project = await createRes.json();
    console.log('Project created:', project);

    // 3. Verify Filesystem
    const projectPath = path.join(process.cwd(), '.chattable', projectName);
    if (fs.existsSync(projectPath)) {
        console.log(`✅ Project folder exists: ${projectPath}`);
    } else {
        console.error(`❌ Project folder missing: ${projectPath}`);
        process.exit(1);
    }

    const gitPath = path.join(projectPath, '.git');
    if (fs.existsSync(gitPath)) {
        console.log(`✅ Git initialized: ${gitPath}`);
    } else {
        console.error(`❌ Git missing: ${gitPath}`);
        // It might be that the clone failed or is still in progress if async? 
        // But createProject awaits the clone.
    }

    // 4. Verify Git API
    console.log('Verifying Git API...');
    const statusRes = await fetch(`${API_URL}/api/git/${projectName}/status`, {
        headers: { 'Authorization': 'Bearer local-token' } // Just in case
    });

    if (statusRes.ok) {
        const status = await statusRes.json();
        console.log('✅ Git Status API working:', status);
    } else {
        console.error('❌ Git Status API failed:', await statusRes.text());
    }

    console.log('Verification Complete!');
}

verify();
