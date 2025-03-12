/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const PLUGINS_STORE_KEY = "vc-unofficialplugins-plugins";
export const ACKNOWLEDGEMENT_STORE_KEY = "vc-unofficialplugins-acknowledged";

export enum ErrorCodes {
    SUCCESS = 0,
    GIT_MISSING = 1,
    COULD_NOT_PULL = 2,
    FAILED_PACKAGE_INSTALL = 3,
}

export interface PartialPlugin {
    name: string;
    folderName: string;
    source?: "link" | "directory";
    repoLink?: string;
    partial?: boolean;
    commitHash?: string;
    needsUpdate?: boolean;
    updating?: boolean;
}

export type StoredPlugin = {
    name: string;
    folderName: string;
    source: "link" | "directory";
    repoLink?: string;
    commitHash?: string;
    needsUpdate?: boolean;
};

export type UnofficialPlugin = {
    name: string;
    folderName: string;
    source?: "link" | "directory" | undefined;
    partial?: boolean | undefined;
    description: string;
    repoLink?: string;
    commitHash?: string;
    needsUpdate?: boolean;
};

export type PartialOrNot = PartialPlugin | (UnofficialPlugin & { partial?: boolean; });
