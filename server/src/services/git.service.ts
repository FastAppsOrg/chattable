import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import path from 'path';
import fs from 'fs';

export class GitService {
    private projectsDir: string;

    constructor() {
        this.projectsDir = path.join(process.cwd(), '.chattable');
    }

    private getGit(projectId: string): SimpleGit {
        const projectPath = path.join(this.projectsDir, projectId);
        if (!fs.existsSync(projectPath)) {
            throw new Error(`Project not found: ${projectId}`);
        }

        const options: Partial<SimpleGitOptions> = {
            baseDir: projectPath,
            binary: 'git',
            maxConcurrentProcesses: 6,
            trimmed: false,
        };

        return simpleGit(options);
    }

    async getStatus(projectId: string) {
        const git = this.getGit(projectId);
        const status = await git.status();
        return status;
    }

    async getLog(projectId: string, limit: number = 20) {
        const git = this.getGit(projectId);
        try {
            const log = await git.log({ maxCount: limit });
            return log;
        } catch (error) {
            // If no commits yet, return empty list
            return { all: [], total: 0, latest: null };
        }
    }

    async commit(projectId: string, message: string, files: string[] = ['.']) {
        const git = this.getGit(projectId);
        await git.add(files);
        const commitResult = await git.commit(message);
        return commitResult;
    }

    async push(projectId: string, remote: string = 'origin', branch: string = 'main') {
        const git = this.getGit(projectId);
        const pushResult = await git.push(remote, branch);
        return pushResult;
    }

    async pull(projectId: string, remote: string = 'origin', branch: string = 'main') {
        const git = this.getGit(projectId);
        const pullResult = await git.pull(remote, branch);
        return pullResult;
    }

    async init(projectId: string) {
        const git = this.getGit(projectId);
        await git.init();
        return { success: true };
    }

    async getBranches(projectId: string) {
        const git = this.getGit(projectId);
        const branches = await git.branchLocal();
        return branches;
    }
}

export const gitService = new GitService();
