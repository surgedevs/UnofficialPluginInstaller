/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { CodeBlock } from "@components/CodeBlock";
import { Flex } from "@components/Flex";
import { Margins } from "@utils/margins";
import { showItemInFolder } from "@utils/native";
import { PluginNative } from "@utils/types";
import { Alerts, Button, Forms, showToast, Text, TextInput, Toasts, useState } from "@webpack/common";

import { PartialPlugin, PLUGINS_STORE_KEY, StoredPlugin } from "../shared";
import { BuildConfirmationModal } from "./BuildConfirmationModal";

const Native = VencordNative.pluginHelpers.UnofficialPluginInstaller as PluginNative<typeof import("../native")>;

export default function Header({
    onInstall,
    hasUpdates,
    onLoadingChange,
    onUpdateAll
}: {
    onInstall: (partialPlugin: PartialPlugin) => void;
    hasUpdates?: boolean;
    onLoadingChange: (loading: boolean, text?: string) => void;
    onUpdateAll?: () => void;
}) {
    const [linkInput, setLinkInput] = useState("");
    const [isWorking, setIsWorking] = useState(false);

    const setLoading = (loading: boolean, text?: string) => {
        setIsWorking(loading);
        onLoadingChange(loading, text);
    };

    const onLinkSubmit = async () => {
        setLoading(true, "Installing plugin...");
        const result = await Native.installFromRepoLink(linkInput);

        if (result.success) {
            Toasts.show({
                message: "Plugin installed!",
                id: "vc-up-install",
                type: Toasts.Type.SUCCESS,
            });

            const plugins = await DataStore.get(PLUGINS_STORE_KEY) || {};

            plugins.push({
                name: result.data.name ?? "Unknown",
                folderName: result.data.folderName ?? "Unknown",
                source: "link",
                repoLink: linkInput
            });

            await DataStore.set(PLUGINS_STORE_KEY, plugins);

            setLoading(false);
            onInstall({
                name: result.data.name ?? "Unknown",
                folderName: result.data.folderName ?? "Unknown",
                source: "link",
                repoLink: linkInput
            });
            return;
        }

        console.warn("Install resulted in an error!", result.error?.object);

        Alerts.show({
            title: result.error?.message,
            body: result.error?.stderr,
            className: "vc-up-alert-full"
        });

        setLoading(false);
    };

    const onClickOpenSource = async () => {
        showItemInFolder(await Native.getSourceFolder());
    };

    const onClickBuildAndInject = async () => {
        const handleConfirm = async (branch: "stable" | "ptb" | "canary") => {
            setLoading(true, "Building and injecting...");
            const buildResult = await Native.build();
            if (!buildResult.success) {
                console.warn("Build resulted in an error!", buildResult.error?.object);

                Alerts.show({
                    title: buildResult.error?.message,
                    body: <>
                        <Text
                            tag="h2"
                            variant="eyebrow"
                            style={{
                                color: "var(--header-primary)",
                                display: "inline"
                            }}
                        >
                            {buildResult.error?.message}
                        </Text>

                        <Forms.FormText>stdout:</Forms.FormText>
                        <CodeBlock lang="javascript" content={buildResult.error?.stdout} />

                        <Forms.FormText>stderr:</Forms.FormText>
                        <CodeBlock lang="javascript" content={buildResult.error?.stderr} />
                    </>,
                    className: "vc-up-alert-full"
                });

                setLoading(false);
                return;
            }

            Toasts.show({
                message: "Build success!",
                id: "vc-up-build",
                type: Toasts.Type.SUCCESS,
            });

            const injectResult = await Native.inject(branch);
            if (!injectResult.success) {
                console.warn("Injection resulted in an error!", injectResult.error?.object);

                Alerts.show({
                    title: injectResult.error?.message,
                    body: injectResult.error?.stderr,
                    className: "vc-up-alert-full"
                });

                setLoading(false);
                return;
            }

            Toasts.show({
                message: "Injection successful!",
                id: "vc-up-inject",
                type: Toasts.Type.SUCCESS,
            });

            setLoading(false);
        };

        const alert = {
            title: "Confirm Build & Inject",
            body: <BuildConfirmationModal onConfirm={handleConfirm} />,
            className: "vc-up-alert"
        };

        Alerts.show(alert);
    };

    const onClickUpdateAll = async () => {
        const alert = {
            title: "Update All Plugins",
            body: "Are you sure you want to update all plugins? You will need to Build & Inject after the update.",
            confirmText: "Update",
            cancelText: "Cancel",
            onConfirm: async () => {
                setLoading(true, "Updating all plugins...");
                const result = await Native.updateAllPlugins();
                if (result.success) {
                    showToast(`Updated ${result.data.updated.length} plugins. Build & Inject to apply changes.`, "success");
                    onUpdateAll?.();
                } else {
                    showToast("Failed to update plugins.", "failure");
                }
                setLoading(false);
            }
        };

        Alerts.show(alert);
    };

    const onClickInstallFromDirectory = async () => {
        setLoading(true, "Installing from directory...");
        const result = await Native.installFromDirectory();

        if (result.success) {
            Toasts.show({
                message: "Plugin installed!",
                id: "vc-up-install-dir",
                type: Toasts.Type.SUCCESS,
            });

            const plugin = {
                name: result.data.name ?? "Unknown",
                source: "directory" as const,
                folderName: result.data.folderName ?? "Unknown"
            };
            const plugins: StoredPlugin[] = await DataStore.get(PLUGINS_STORE_KEY) || [];

            plugins.push(plugin);
            await DataStore.set(PLUGINS_STORE_KEY, plugins);

            onInstall(plugin);
        } else {
            if (result.error?.message === "Plugin already exists!") {
                showToast("Plugin already exists!", "failure");
                setLoading(false);
                return;
            }

            console.warn("Install from directory resulted in an error!", result.error?.object);

            Alerts.show({
                title: result.error?.message,
                body: result.error?.stderr,
                className: "vc-up-alert-full"
            });
        }

        setLoading(false);
    };

    return <div className={"vc-up-container " + Margins.bottom16} style={{ position: "relative" }}>
        <Forms.FormTitle>
            Unofficial Plugin Management
        </Forms.FormTitle>

        <Forms.FormText>
            Install plugins from a Github repository link below
        </Forms.FormText>

        <Flex flexDirection="row" className={Margins.top16}>
            <TextInput
                className="vc-up-full-width"
                placeholder="Insert Repository Link Here"
                value={linkInput}
                onChange={setLinkInput}
            />
            <Button disabled={isWorking} onClick={onLinkSubmit}>Install</Button>
        </Flex>

        <div className={"vc-up-container-inner " + Margins.top20}>
            <Forms.FormTitle>Actions</Forms.FormTitle>

            <Flex flexDirection="row" className={Margins.top16} style={{ justifyContent: "space-between" }}>
                <Button disabled={isWorking} onClick={onClickInstallFromDirectory}>Install From Directory</Button>
                <Button disabled={isWorking} onClick={onClickOpenSource}>Open Source Folder</Button>
                <Button disabled={isWorking || !hasUpdates} onClick={onClickUpdateAll}>Update All</Button>
                <Button disabled={isWorking} color={Button.Colors.RED} onClick={onClickBuildAndInject}>Build & Inject</Button>
            </Flex>
        </div>
    </div >;
}
