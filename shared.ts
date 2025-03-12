/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const IPC_DONE_EVENT = "vc-up-done";
export const IPC_STATE_EVENT = "vc-up-state";

export enum ErrorCodes {
    SUCCESS = 0,
    GIT_MISSING = 1,
    COULD_NOT_PULL = 2,
    FAILED_PACKAGE_INSTALL = 3,
}

export interface PartialPlugin {
    name: string;
    description: string;
}
