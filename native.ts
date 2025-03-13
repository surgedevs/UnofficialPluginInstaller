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

interface FailableWithInformation {
    code: ErrorCodes;
    information?: string;
}

interface ExecInformation {
    error: ExecException | null;
    stdout?: string;
    stderr?: string;
}

interface NativeResultSuccessState<T> {
    success: true,
    data: T,
}

interface NativeResultFailState {
    success: false,
    error?: {
        object: any,
        message: string,
        stdout?: string,
        stderr?: string,
    };
}

type NativeResult<T> = NativeResultFailState | NativeResultSuccessState<T>;

let working = false;

function execAsync(command, additionalOptions = {}): Promise<ExecInformation> {
    return new Promise((res, rej) => {
        exec(command, additionalOptions, (error, stdout, stderr) => {
            if (error) {
                rej({
                    error,
                    stdout,
                    stderr
                });
            } else {
                res({
                    error,
                    stdout,
                    stderr
                });
            }
        });
    });
}

function getPluginNameFromPath(pluginPath: string): string | null {
    const indexFiles = ["index.tsx", "index.jsx", "index.js", "index.ts"];

    const indexFile = indexFiles.find(file => fs.existsSync(path.join(pluginPath, file)));
    if (!indexFile) return null;

    try {
        const fileContent = fs.readFileSync(path.join(pluginPath, indexFile), "utf8");
        const nameMatch = fileContent.match(/name:\s*["']([^"']+)["']/);
        if (nameMatch) return nameMatch[1];
    } catch {
        // Ignore errors reading file
    }

    return null;
}

function isValidRepoLink(repoLink: string): boolean {
    return repoLink.endsWith(".git") ||
        repoLink.startsWith("https://github.com/") ||
        repoLink.startsWith("git@github.com:") ||
        repoLink.startsWith("https://gitlab.com/") ||
        repoLink.startsWith("git@gitlab.com:") ||
        repoLink.startsWith("https://bitbucket.org/") ||
        repoLink.startsWith("git@bitbucket.org:") ||
        /^https?:\/\/.*\.git$/.test(repoLink) ||
        /^git@.*:.+\/.+$/.test(repoLink);
}

function createPluginDownloaderFolderIfNotExists(): void {
    const pluginDownloaderPath = getFSPath();

    if (!fs.existsSync(pluginDownloaderPath)) {
        fs.mkdirSync(pluginDownloaderPath, { recursive: true });
    }
}

export function getFSPath(): string {
    const appDataPath = process.env.APPDATA || (
        os.platform() === "darwin"
            ? path.join(os.homedir(), "Library", "Application Support")
            : path.join(os.homedir(), ".config")
    );
    const vencordPath = path.join(appDataPath, "Vencord");

    return path.join(vencordPath, "UnofficialPluginDownloader");
}

export function getSourceFolder(): string {
    return path.join(getFSPath(), "Vencord");
}

export async function initialiseRepo(): Promise<FailableWithInformation> {
    working = true;

    const gitCheck = "git --version && pnpm --version";
    const gitSuccess = await execAsync(gitCheck).catch(err => err);

    if (gitSuccess.error) {
        return {
            code: ErrorCodes.GIT_MISSING,
            information: `stdout: ${gitSuccess.stdout}; stderr: ${gitSuccess.stderr}`
        };
    }

    createPluginDownloaderFolderIfNotExists();
    const cloneCommand = `cd "${getFSPath()}" && git clone https://github.com/Vendicated/Vencord.git`;
    const cloneSuccess = await execAsync(cloneCommand).catch(err => err);

    if (cloneSuccess.error) {
        return {
            code: ErrorCodes.GIT_MISSING,
            information: `stdout: ${cloneSuccess.stdout}; stderr: ${cloneSuccess.stderr}`
        };
    }

    // Patch runInstaller.mjs to allow us to pass cli args ;(
    const installerPath = path.join(getSourceFolder(), "scripts", "runInstaller.mjs");
    try {
        let content = fs.readFileSync(installerPath, "utf8");
        content = content.replace(
            /execFileSync\(installerBin,\s*{/g,
            "execFileSync(installerBin, process.argv.slice(3), {"
        );
        fs.writeFileSync(installerPath, content);
    } catch (err) {
        return {
            code: ErrorCodes.FAILED_PACKAGE_INSTALL,
            information: `Failed to patch runInstaller.mjs: ${err}`
        };
    }

    const packageCommand = `cd "${getSourceFolder()}" && pnpm i --no-frozen-lockfile`;
    const packageSuccess = await execAsync(packageCommand).catch(err => err);

    if (packageSuccess.error) {
        return {
            code: ErrorCodes.FAILED_PACKAGE_INSTALL,
            information: `stdout: ${packageSuccess.stdout}; stderr: ${packageSuccess.stderr}`
        };
    }

    if (!fs.existsSync(path.join(getSourceFolder(), "src/userplugins"))) {
        fs.mkdirSync(path.join(getSourceFolder(), "src/userplugins"), { recursive: true });
    }

    const pluginCloneCommand = `cd "${getSourceFolder()}/src/userplugins" && git clone https://github.com/surgedevs/UnofficialPluginInstaller.git`;
    const pluginCloneSuccess = await execAsync(pluginCloneCommand).catch(err => err);

    if (pluginCloneSuccess.error) {
        return {
            code: ErrorCodes.FAILED_PACKAGE_INSTALL,
            information: `stdout: ${pluginCloneSuccess.stdout}; stderr: ${pluginCloneSuccess.stderr}`
        };
    }

    working = false;

    return { code: ErrorCodes.SUCCESS, information: `${gitSuccess.stdout}${gitSuccess.stderr}${cloneSuccess.stdout}${cloneSuccess.stderr}` };
}

export function isRepoDownloaded(): boolean {
    createPluginDownloaderFolderIfNotExists();

    const repoPath = path.join(getFSPath(), "Vencord");

    return fs.existsSync(repoPath);
}

export function isWorking(): boolean {
    return working;
}

export async function build(): Promise<NativeResult<null>> {
    const path = getSourceFolder();
    const buildResult = await execAsync(`cd ${path} && pnpm run build`).catch(e => e);

    if (buildResult.error) {
        return {
            success: false,
            error: {
                object: buildResult.error,
                message: "Failed to build!",
                stdout: buildResult.stdout,
                stderr: buildResult.stderr
            }
        };
    }

    return { success: true, data: null };
}

async function getLatestCommitHash(repoPath: string): Promise<string | null> {
    try {
        const result = await execAsync(`cd "${repoPath}" && git rev-parse HEAD`);
        return result.stdout?.trim() ?? null;
    } catch {
        return null;
    }
}

async function getRemoteCommitHash(repoPath: string): Promise<string | null> {
    try {
        const result = await execAsync(`cd "${repoPath}" && git ls-remote origin HEAD`);
        return result.stdout?.split("\t")[0]?.trim() ?? null;
    } catch {
        return null;
    }
}

export async function checkPluginUpdates(_ipcEvent: IpcMainInvokeEvent, pluginName: string): Promise<NativeResult<{ needsUpdate: boolean, currentHash?: string, remoteHash?: string; }>> {
    const sourceFolder = getSourceFolder();
    const pluginPath = path.join(sourceFolder, "src/userplugins", pluginName);

    if (!fs.existsSync(pluginPath)) {
        return {
            success: false,
            error: {
                object: null,
                message: "Plugin not found!"
            }
        };
    }

    const currentHash = await getLatestCommitHash(pluginPath);
    const remoteHash = await getRemoteCommitHash(pluginPath);

    if (!currentHash || !remoteHash) {
        return {
            success: false,
            error: {
                object: null,
                message: "Failed to get commit hashes!"
            }
        };
    }

    return {
        success: true,
        data: {
            needsUpdate: currentHash !== remoteHash,
            currentHash,
            remoteHash
        }
    };
}

export async function updatePlugin(_ipcEvent: IpcMainInvokeEvent, pluginName: string): Promise<NativeResult<{ commitHash: string; }>> {
    const sourceFolder = getSourceFolder();
    const pluginPath = path.join(sourceFolder, "src/userplugins", pluginName);

    if (!fs.existsSync(pluginPath)) {
        return {
            success: false,
            error: {
                object: null,
                message: "Plugin not found!"
            }
        };
    }

    const updateResult = await execAsync(`cd "${pluginPath}" && git pull`).catch(e => e);

    if (updateResult.error) {
        return {
            success: false,
            error: {
                object: updateResult.error,
                message: "Failed to update plugin!",
                stdout: updateResult.stdout,
                stderr: updateResult.stderr
            }
        };
    }

    const commitHash = await getLatestCommitHash(pluginPath);
    if (!commitHash) {
        return {
            success: false,
            error: {
                object: null,
                message: "Failed to get commit hash!"
            }
        };
    }

    return {
        success: true,
        data: {
            commitHash
        }
    };
}

export async function updateAllPlugins(): Promise<NativeResult<{ updated: string[]; }>> {
    const sourceFolder = getSourceFolder();
    const userPluginsFolder = path.join(sourceFolder, "src/userplugins");
    const updatedPlugins: string[] = [];

    if (!fs.existsSync(userPluginsFolder)) {
        return {
            success: true,
            data: { updated: [] }
        };
    }

    const plugins = fs.readdirSync(userPluginsFolder);

    for (const plugin of plugins) {
        const updateResult = await execAsync(`cd "${path.join(userPluginsFolder, plugin)}" && git pull`).catch(e => e);
        if (!updateResult.error) {
            updatedPlugins.push(plugin);
        }
    }

    return {
        success: true,
        data: { updated: updatedPlugins }
    };
}

export async function installFromRepoLink(_ipcEvent: IpcMainInvokeEvent, repoLink: string): Promise<NativeResult<{ name: string | null; folderName: string; source: string; commitHash?: string; }>> {
    const sourceFolder = getSourceFolder();

    if (!isValidRepoLink(repoLink)) {
        return {
            success: false,
            error: {
                object: null,
                message: "Invalid repository link!"
            }
        };
    }

    if (!fs.existsSync(path.join(sourceFolder, "src/userplugins"))) {
        fs.mkdirSync(path.join(sourceFolder, "src/userplugins"), { recursive: true });
    }

    const repoName = repoLink.split("/").pop() ?? "";
    const targetPath = path.join(sourceFolder, "src/userplugins", repoName);

    if (fs.existsSync(targetPath)) {
        return {
            success: false,
            error: {
                object: null,
                message: "Plugin already exists!"
            }
        };
    }

    const cloneCommand = `cd ${sourceFolder}/src/userplugins && git clone ${repoLink}`;
    const cloneResult = await execAsync(cloneCommand).catch(e => e);

    if (cloneResult.error) {
        return {
            success: false,
            error: {
                object: cloneResult.error,
                message: "Failed to clone repository!",
                stdout: cloneResult.stdout,
                stderr: cloneResult.stderr
            }
        };
    }

    const pluginName = getPluginNameFromPath(path.join(sourceFolder, "src/userplugins", repoLink.split("/").pop() ?? ""));
    const commitHash = await getLatestCommitHash(path.join(sourceFolder, "src/userplugins", repoLink.split("/").pop() ?? ""));

    return {
        success: true,
        data: {
            name: pluginName,
            folderName: repoName,
            source: "link",
            commitHash: commitHash ?? undefined
        }
    };
}

export async function getPluginList(): Promise<NativeResult<{ pluginName: string; folderName: string; }[]>> {
    const sourceFolder = getSourceFolder();
    const userPluginsFolder = path.join(sourceFolder, "src/userplugins");

    if (!fs.existsSync(userPluginsFolder)) {
        return {
            success: true,
            data: []
        };
    }

    const plugins = fs.readdirSync(userPluginsFolder);

    return {
        success: true,
        data: plugins.map(plugin => ({
            pluginName: getPluginNameFromPath(path.join(userPluginsFolder, plugin)) ?? plugin,
            folderName: plugin
        }))
    };
}

export async function getPartialPlugins(): Promise<NativeResult<PartialPlugin[]>> {
    const sourceFolder = getSourceFolder();
    const partialPlugins: PartialPlugin[] = [];

    const userPluginsFolder = path.join(sourceFolder, "src/userplugins");

    if (!fs.existsSync(userPluginsFolder)) {
        return {
            success: true,
            data: []
        };
    }

    const userPlugins = fs.readdirSync(userPluginsFolder);

    for (const plugin of userPlugins) {
        const pluginName = getPluginNameFromPath(path.join(userPluginsFolder, plugin));
        if (pluginName) {
            partialPlugins.push({
                name: pluginName,
                folderName: plugin,
            });
        }
    }

    return {
        success: true,
        data: partialPlugins
    };
}

export async function inject(_ipcEvent: IpcMainInvokeEvent, branch: string): Promise<NativeResult<null>> {
    const sourceFolder = getSourceFolder();
    const injectResult = await execAsync(`cd ${sourceFolder} && pnpm run inject -- --install --branch ${branch}`, {
        stdio: "inherit",
        env: {
            ...process.env,
            VENCORD_USER_DATA_DIR: getSourceFolder(),
        }
    }).catch(e => e);

    if (injectResult.error) {
        return {
            success: false,
            error: {
                object: injectResult.error,
                message: "Failed to inject!",
                stdout: injectResult.stdout,
                stderr: injectResult.stderr
            }
        };
    }

    return { success: true, data: null };
}

export async function deletePlugin(_ipcEvent: IpcMainInvokeEvent, pluginName: string): Promise<NativeResult<null>> {
    const sourceFolder = getSourceFolder();

    if (!fs.existsSync(path.join(sourceFolder, "src/userplugins", pluginName))) {
        return {
            success: false,
            error: {
                object: null,
                message: "Plugin not found!"
            }
        };
    }

    fs.rmSync(path.join(sourceFolder, "src/userplugins", pluginName), { recursive: true, force: true });

    return { success: true, data: null };
}

export async function installFromDirectory(_ipcEvent: IpcMainInvokeEvent): Promise<NativeResult<{ name: string | null; folderName: string; source: string; }>> {
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return {
            success: false,
            error: {
                object: null,
                message: "No directory selected"
            }
        };
    }

    const sourceDir = result.filePaths[0];
    const sourceFolder = getSourceFolder();
    const folderName = path.basename(sourceDir);
    const targetPath = path.join(sourceFolder, "src/userplugins", folderName);

    if (fs.existsSync(targetPath)) {
        return {
            success: false,
            error: {
                object: null,
                message: "Plugin already exists!"
            }
        };
    }

    try {
        fs.cpSync(sourceDir, targetPath, { recursive: true });
        const pluginName = getPluginNameFromPath(targetPath);
        return {
            success: true,
            data: {
                name: pluginName,
                folderName: folderName,
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
