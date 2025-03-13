/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec, ExecException } from "child_process";
import { dialog, IpcMainInvokeEvent } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { ErrorCodes, PartialPlugin } from "./shared";

interface ExecResult {
    error: ExecException | null;
    stdout?: string;
    stderr?: string;
}

interface NativeResult<T> {
    success: boolean;
    data?: T;
    error?: {
        object: any;
        message: string;
        stdout?: string;
        stderr?: string;
    };
}

const INDEX_FILES = ["index.tsx", "index.jsx", "index.js", "index.ts"] as const;
let workingState = false;

const execAsync = (command: string, options = {}): Promise<ExecResult> =>
    new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) reject({ error, stdout, stderr });
            else resolve({ error, stdout, stderr });
        });
    });

const getPluginNameFromPath = (pluginPath: string): string | null => {
    const indexFile = INDEX_FILES.find(file => fs.existsSync(path.join(pluginPath, file)));
    if (!indexFile) return null;

    try {
        const content = fs.readFileSync(path.join(pluginPath, indexFile), "utf8");
        const match = content.match(/name:\s*["']([^"']+)["']/);
        return match?.[1] ?? null;
    } catch {
        return null;
    }
};

const isValidRepoLink = (repoLink: string): boolean => {
    const validPatterns = [
        /\.git$/,
        /^https:\/\/github\.com\//,
        /^git@github\.com:/,
        /^https:\/\/gitlab\.com\//,
        /^git@gitlab\.com:/,
        /^https:\/\/bitbucket\.org\//,
        /^git@bitbucket\.org:/,
        /^https?:\/\/.*\.git$/,
        /^git@.*:.+\/.+$/
    ];
    return validPatterns.some(pattern => pattern.test(repoLink));
};

const getFSPath = (): string => {
    const appDataPath = process.env.APPDATA || (
        os.platform() === "darwin"
            ? path.join(os.homedir(), "Library", "Application Support")
            : path.join(os.homedir(), ".config")
    );
    return path.join(appDataPath, "Vencord", "UnofficialPluginDownloader");
};

export const getSourceFolder = (): string => path.join(getFSPath(), "Vencord");

const createPluginDownloaderFolder = (): void => {
    const path = getFSPath();
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
    }
};

const getLatestCommitHash = async (repoPath: string): Promise<string | null> => {
    try {
        const result = await execAsync(`cd "${repoPath}" && git rev-parse HEAD`);
        return result.stdout?.trim() ?? null;
    } catch {
        return null;
    }
};

const getRemoteCommitHash = async (repoPath: string): Promise<string | null> => {
    try {
        const result = await execAsync(`cd "${repoPath}" && git ls-remote origin HEAD`);
        return result.stdout?.split("\t")[0]?.trim() ?? null;
    } catch {
        return null;
    }
};

export async function initialiseRepo(): Promise<{ code: ErrorCodes; information?: string; }> {
    workingState = true;

    try {
        await execAsync("git --version && pnpm --version");
        createPluginDownloaderFolder();

        await execAsync(`cd "${getFSPath()}" && git clone https://github.com/Vendicated/Vencord.git`);
        const sourceFolder = getSourceFolder();

        // Patch runInstaller.mjs
        const installerPath = path.join(sourceFolder, "scripts", "runInstaller.mjs");
        let content = fs.readFileSync(installerPath, "utf8");
        content = content.replace(/execFileSync\(installerBin,\s*{/g, "execFileSync(installerBin, process.argv.slice(3), {");
        fs.writeFileSync(installerPath, content);

        await execAsync(`cd "${sourceFolder}" && pnpm i --no-frozen-lockfile`);

        const userPluginsPath = path.join(sourceFolder, "src/userplugins");
        if (!fs.existsSync(userPluginsPath)) {
            fs.mkdirSync(userPluginsPath, { recursive: true });
        }

        await execAsync(`cd "${userPluginsPath}" && git clone https://github.com/surgedevs/UnofficialPluginInstaller.git`);

        workingState = false;
        return { code: ErrorCodes.SUCCESS };
    } catch (error: any) {
        workingState = false;
        return {
            code: error.message.includes("git") ? ErrorCodes.GIT_MISSING : ErrorCodes.FAILED_PACKAGE_INSTALL,
            information: error.message
        };
    }
}

export function isRepoDownloaded(): boolean {
    createPluginDownloaderFolder();
    return fs.existsSync(getSourceFolder());
}

export function isWorking(): boolean {
    return workingState;
}

export async function build(): Promise<NativeResult<null>> {
    try {
        await execAsync(`cd ${getSourceFolder()} && pnpm run build`);
        return { success: true, data: null };
    } catch (error: any) {
        return {
            success: false,
            error: {
                object: error,
                message: "Failed to build!",
                stdout: error.stdout,
                stderr: error.stderr
            }
        };
    }
}

export async function checkPluginUpdates(_ipcEvent: IpcMainInvokeEvent, pluginName: string): Promise<NativeResult<{ needsUpdate: boolean; currentHash?: string; remoteHash?: string; }>> {
    const pluginPath = path.join(getSourceFolder(), "src/userplugins", pluginName);

    console.log(`FS PATH: ${getFSPath()}`);
    console.log(`SOURCE FOLDER: ${getSourceFolder()}`);
    console.log(`PLUGIN PATH: ${pluginPath}`);

    if (!fs.existsSync(pluginPath)) {
        return { success: false, error: { object: null, message: "Plugin not found!" } };
    }

    const [currentHash, remoteHash] = await Promise.all([
        getLatestCommitHash(pluginPath),
        getRemoteCommitHash(pluginPath)
    ]);

    if (!currentHash || !remoteHash) {
        return { success: false, error: { object: null, message: "Failed to get commit hashes!" } };
    }

    const needsUpdate = currentHash !== remoteHash;

    return {
        success: true,
        data: { needsUpdate, currentHash, remoteHash }
    };
}

export async function updatePlugin(_ipcEvent: IpcMainInvokeEvent, pluginName: string): Promise<NativeResult<{ commitHash: string; }>> {
    const pluginPath = path.join(getSourceFolder(), "src/userplugins", pluginName);
    if (!fs.existsSync(pluginPath)) {
        return { success: false, error: { object: null, message: "Plugin not found!" } };
    }

    try {
        const pluginName = getPluginNameFromPath(pluginPath);
        if (!pluginName) {
            return { success: false, error: { object: null, message: "Invalid plugin structure!" } };
        }

        const statusResult = await execAsync(`cd "${pluginPath}" && git status --porcelain`);
        if (statusResult.stdout?.trim()) {
            return { success: false, error: { object: null, message: "Plugin has uncommitted changes! Please commit or stash them first." } };
        }

        const defaultBranchResult = await execAsync(`cd "${pluginPath}" && git remote show origin | grep "HEAD branch:" | cut -d ":" -f 2 | tr -d " "`);
        if (!defaultBranchResult.stdout?.trim()) {
            return { success: false, error: { object: null, message: "Failed to determine default branch!" } };
        }
        const defaultBranch = defaultBranchResult.stdout.trim();

        await execAsync(`cd "${pluginPath}" && git fetch origin && git checkout ${defaultBranch} && git pull origin ${defaultBranch}`);

        const commitHash = await getLatestCommitHash(pluginPath);
        if (!commitHash) {
            return { success: false, error: { object: null, message: "Failed to verify update!" } };
        }

        const updatedPluginName = getPluginNameFromPath(pluginPath);
        if (!updatedPluginName || updatedPluginName !== pluginName) {
            return { success: false, error: { object: null, message: "Plugin structure invalid after update!" } };
        }

        return { success: true, data: { commitHash } };
    } catch (error: any) {
        return {
            success: false,
            error: {
                object: error,
                message: "Failed to update plugin!",
                stdout: error.stdout,
                stderr: error.stderr
            }
        };
    }
}

export async function updateAllPlugins(): Promise<NativeResult<{ updated: string[]; failed: { name: string; error: string; }[]; }>> {
    const userPluginsFolder = path.join(getSourceFolder(), "src/userplugins");
    if (!fs.existsSync(userPluginsFolder)) {
        return { success: true, data: { updated: [], failed: [] } };
    }

    const plugins = fs.readdirSync(userPluginsFolder);
    const results = await Promise.all(
        plugins.map(async plugin => {
            try {
                const pluginPath = path.join(userPluginsFolder, plugin);

                const pluginName = getPluginNameFromPath(pluginPath);
                if (!pluginName) {
                    return { success: false, name: plugin, error: "Invalid plugin structure" };
                }

                const statusResult = await execAsync(`cd "${pluginPath}" && git status --porcelain`);
                if (statusResult.stdout?.trim()) {
                    return { success: false, name: plugin, error: "Has uncommitted changes" };
                }

                const defaultBranchResult = await execAsync(`cd "${pluginPath}" && git remote show origin | grep "HEAD branch:" | cut -d ":" -f 2 | tr -d " "`);

                if (!defaultBranchResult.stdout?.trim()) {
                    return { success: false, name: plugin, error: "Failed to determine default branch" };
                }
                const defaultBranch = defaultBranchResult.stdout.trim();

                await execAsync(`cd "${pluginPath}" && git fetch origin && git checkout ${defaultBranch} && git pull origin ${defaultBranch}`);

                const commitHash = await getLatestCommitHash(pluginPath);
                if (!commitHash) {
                    return { success: false, name: plugin, error: "Failed to verify update" };
                }

                const updatedPluginName = getPluginNameFromPath(pluginPath);
                if (!updatedPluginName || updatedPluginName !== pluginName) {
                    return { success: false, name: plugin, error: "Invalid structure after update" };
                }

                return { success: true, name: plugin };
            } catch (error: any) {
                return {
                    success: false,
                    name: plugin,
                    error: error.message || "Update failed"
                };
            }
        })
    );

    const updated = results.filter(r => r.success).map(r => r.name);
    const failed = results.filter(r => !r.success).map(r => ({ name: r.name, error: r.error }));

    return {
        success: true,
        data: { updated, failed }
    };
}

export async function installFromRepoLink(_ipcEvent: IpcMainInvokeEvent, repoLink: string): Promise<NativeResult<{ name: string | null; folderName: string; source: string; commitHash?: string; }>> {
    if (!isValidRepoLink(repoLink)) {
        return { success: false, error: { object: null, message: "Invalid repository link!" } };
    }

    const sourceFolder = getSourceFolder();
    const userPluginsPath = path.join(sourceFolder, "src/userplugins");
    if (!fs.existsSync(userPluginsPath)) {
        fs.mkdirSync(userPluginsPath, { recursive: true });
    }

    const repoName = repoLink.split("/").pop() ?? "";
    const targetPath = path.join(userPluginsPath, repoName);
    if (fs.existsSync(targetPath)) {
        return { success: false, error: { object: null, message: "Plugin already exists!" } };
    }

    try {
        await execAsync(`cd ${userPluginsPath} && git clone ${repoLink}`);
        const pluginName = getPluginNameFromPath(targetPath);
        const commitHash = await getLatestCommitHash(targetPath);

        return {
            success: true,
            data: {
                name: pluginName,
                folderName: repoName,
                source: "link",
                commitHash: commitHash ?? undefined
            }
        };
    } catch (error: any) {
        return {
            success: false,
            error: {
                object: error,
                message: "Failed to clone repository!",
                stdout: error.stdout,
                stderr: error.stderr
            }
        };
    }
}

export async function getPluginList(): Promise<NativeResult<{ pluginName: string; folderName: string; }[]>> {
    const userPluginsFolder = path.join(getSourceFolder(), "src/userplugins");
    if (!fs.existsSync(userPluginsFolder)) {
        return { success: true, data: [] };
    }

    const plugins = fs.readdirSync(userPluginsFolder);
    return {
        success: true,
        data: plugins.map(plugin => ({
            pluginName: getPluginNameFromPath(path.join(userPluginsFolder, plugin)) ?? plugin,
            folderName: path.basename(plugin)
        }))
    };
}

export async function getPartialPlugins(): Promise<NativeResult<PartialPlugin[]>> {
    const userPluginsFolder = path.join(getSourceFolder(), "src/userplugins");
    if (!fs.existsSync(userPluginsFolder)) {
        return { success: true, data: [] };
    }

    const plugins = fs.readdirSync(userPluginsFolder);
    const partialPlugins = plugins
        .map(plugin => {
            const pluginName = getPluginNameFromPath(path.join(userPluginsFolder, plugin));
            return pluginName ? { name: pluginName, folderName: plugin } : null;
        })
        .filter((p): p is PartialPlugin => p !== null);

    return { success: true, data: partialPlugins };
}

export async function inject(_ipcEvent: IpcMainInvokeEvent, branch: string): Promise<NativeResult<null>> {
    try {
        console.log(`Starting injection process for branch: ${branch}`);
        const sourceFolder = getSourceFolder();
        console.log(`Source folder: ${sourceFolder}`);

        const command = `cd ${sourceFolder} && pnpm run inject -- --install --branch ${branch}`;
        console.log(`Executing command: ${command}`);

        const result = await execAsync(command, {
            stdio: "inherit",
            env: {
                ...process.env,
            }
        });

        if (result.error) {
            console.error("Injection failed:", result.error);
            return {
                success: false,
                error: {
                    object: result.error,
                    message: "Failed to inject!",
                    stdout: result.stdout,
                    stderr: result.stderr
                }
            };
        }

        console.log(result);

        console.log("Injection completed successfully");
        return { success: true, data: null };
    } catch (error: any) {
        console.error("Injection process failed:", error);
        return {
            success: false,
            error: {
                object: error,
                message: "Failed to inject!",
                stdout: error.stdout,
                stderr: error.stderr
            }
        };
    }
}

export async function deletePlugin(_ipcEvent: IpcMainInvokeEvent, pluginName: string): Promise<NativeResult<null>> {
    const pluginPath = path.join(getSourceFolder(), "src/userplugins", pluginName);
    if (!fs.existsSync(pluginPath)) {
        return { success: false, error: { object: null, message: "Plugin not found!" } };
    }

    fs.rmSync(pluginPath, { recursive: true, force: true });
    return { success: true, data: null };
}

export async function installFromDirectory(_ipcEvent: IpcMainInvokeEvent): Promise<NativeResult<{ name: string | null; folderName: string; source: string; }>> {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: { object: null, message: "No directory selected" } };
    }

    const sourceDir = result.filePaths[0];
    const sourceFolder = getSourceFolder();
    const folderName = path.basename(sourceDir);
    const targetPath = path.join(sourceFolder, "src/userplugins", folderName);

    if (fs.existsSync(targetPath)) {
        return { success: false, error: { object: null, message: "Plugin already exists!" } };
    }

    try {
        fs.cpSync(sourceDir, targetPath, { recursive: true });
        const pluginName = getPluginNameFromPath(targetPath);
        return {
            success: true,
            data: {
                name: pluginName,
                folderName,
                source: "directory"
            }
        };
    } catch (error: any) {
        return {
            success: false,
            error: {
                object: error,
                message: "Failed to copy plugin directory!",
                stderr: error.message
            }
        };
    }
}
