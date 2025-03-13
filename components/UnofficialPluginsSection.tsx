/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { SettingsTab } from "@components/VencordSettings/shared";
import { Margins } from "@utils/margins";
import { PluginNative } from "@utils/types";
import { Alerts, Button, Forms, Toasts, useEffect, useState } from "@webpack/common";

import Plugins from "~plugins";

import { ErrorCodes, PartialPlugin, PLUGINS_STORE_KEY } from "../shared";
import { AcknowledgementModal } from "./AcknowledgementModal";
import Header from "./Header";
import { LoadingOverlay } from "./LoadingOverlay";
import PluginList from "./PluginList";

const Native = VencordNative.pluginHelpers.UnofficialPluginInstaller as PluginNative<typeof import("../native")>;

interface LoadingState {
    isLoading: boolean;
    text?: string;
}

export default function UnofficialPluginsSection() {
    const [isInitialised, setIsInitialised] = useState(false);
    const [plugins, setPlugins] = useState<PartialPlugin[]>([]);
    const [hasUpdates, setHasUpdates] = useState(false);
    const [loading, setLoading] = useState<LoadingState>({ isLoading: false });
    const [isAcknowledged, setIsAcknowledged] = useState(false);

    const updateLoadingState = (isLoading: boolean, text?: string) => {
        setLoading({ isLoading, text });
    };

    const handleError = (title: string, body: string) => {
        Alerts.show({ title, body });
        updateLoadingState(false);
    };

    const handleInitialisation = async () => {
        updateLoadingState(true, "Initializing...");

        const errorCode = await Native.initialiseRepo();

        const errorMessages = {
            [ErrorCodes.GIT_MISSING]: "You do not have git installed. Please install git before continuing.",
            [ErrorCodes.COULD_NOT_PULL]: "Could not pull the Vencord repository.",
            [ErrorCodes.FAILED_PACKAGE_INSTALL]: "Could not install required packages"
        };

        if (errorCode.code !== 0) {
            handleError("Failed!", errorMessages[errorCode.code] ?? "Failed to initialize repository.");
            return;
        }

        await DataStore.set(PLUGINS_STORE_KEY, [{
            name: "UnofficialPluginInstaller",
            source: "link",
            repoLink: "https://github.com/surgedevs/UnofficialPluginInstaller",
            folderName: "UnofficialPluginInstaller"
        }]);

        setIsInitialised(true);
        updateLoadingState(false);
    };

    const refreshPlugins = async () => {
        updateLoadingState(true, "Refreshing plugins...");

        try {
            const result = await Native.getPluginList();
            if (!result.success) throw new Error();

            const pluginsResult = await Native.getPartialPlugins();
            if (pluginsResult.success) {
                const filteredPlugins = (pluginsResult.data ?? [])
                    .filter(plugin => !Object.keys(Plugins).includes(plugin.name));
                setPlugins(filteredPlugins);
            }
        } catch {
            Toasts.show({
                message: "Failed to refresh plugins",
                type: Toasts.Type.FAILURE,
                id: "vc-up-refresh-failed"
            });
        }

        updateLoadingState(false);
    };

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            const acknowledged = await DataStore.get("vc-unofficialplugins-acknowledged");
            if (!mounted) return;

            setIsAcknowledged(!!acknowledged);
            if (!acknowledged) {
                Alerts.show({
                    title: "Attention!",
                    body: <AcknowledgementModal onConfirm={async () => {
                        setIsAcknowledged(true);
                        await DataStore.set("vc-unofficialplugins-acknowledged", true);
                    }} />,
                    className: "vc-up-alert"
                });
            }

            const isDownloaded = await Native.isRepoDownloaded();
            if (!mounted) return;

            setIsInitialised(isDownloaded && !(await Native.isWorking()));

            const pluginsResult = await Native.getPartialPlugins();
            if (!mounted || !pluginsResult.success) return;

            setPlugins(pluginsResult.data?.filter(
                plugin => !Object.keys(Plugins).includes(plugin.name)
            ) ?? []);
        };

        init();
        return () => { mounted = false; };
    }, []);

    if (!isInitialised) {
        return (
            <SettingsTab title="Unofficial Plugins">
                <div className="vc-up-container">
                    <Forms.FormTitle>Uninitialised!</Forms.FormTitle>
                    <Forms.FormText>
                        The Unofficial Plugin Loader is not yet initialized, click the button below to start.
                        <Forms.FormText type={Forms.FormText.Types.ERROR} className={Margins.top16}>
                            Requires Git and PNPM installed.<br />
                            Git for windows: https://git-scm.com/download/win
                            PNPM: https://pnpm.io/installation
                        </Forms.FormText>
                        <Button
                            onClick={handleInitialisation}
                            disabled={loading.isLoading}
                            size={Button.Sizes.LARGE}
                            className={Margins.top16}
                            color={Button.Colors.RED}
                        >
                            Initialise
                        </Button>
                    </Forms.FormText>
                </div>
            </SettingsTab>
        );
    }

    return (
        <SettingsTab title="Unofficial Plugins">
            <div style={{ position: "relative" }}>
                {loading.isLoading && <LoadingOverlay text={loading.text} />}
                <Header
                    onInstall={plugin => setPlugins([...plugins, plugin])}
                    hasUpdates={hasUpdates}
                    onLoadingChange={updateLoadingState}
                    onUpdateAll={refreshPlugins}
                />
                <PluginList
                    partialPlugins={plugins}
                    onUpdateCheck={(hasAvailableUpdates, isChecking) => {
                        setHasUpdates(hasAvailableUpdates);
                        if (isChecking !== undefined) {
                            updateLoadingState(isChecking, isChecking ? "Checking for updates..." : undefined);
                        }
                    }}
                    onLoadingChange={updateLoadingState}
                />
            </div>
        </SettingsTab>
    );
}
