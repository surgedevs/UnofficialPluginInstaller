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

let alertShown = false;
let acknowledged = false;

export default function UnofficialPluginsSection() {
    const [isInitialising, setIsInitialising] = useState(false);
    const [initialised, setInitialised] = useState(false);
    const [currentState, setCurrentState] = useState("");
    const [partialPlugins, setPartialPlugins] = useState<PartialPlugin[]>([]);
    const [hasUpdates, setHasUpdates] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState<string>();

    const onModalConfirm = async () => {
        acknowledged = true;

        const alertButton: HTMLButtonElement | null = document.querySelector(
            '.vc-up-alert [class*="primaryButton_"]'
        );
        alertButton?.click();

        await DataStore.set("vc-unofficialplugins-acknowledged", true);
    };

    useEffect(() => {
        let mounted = true;

        (async () => {
            acknowledged = await DataStore.get("vc-unofficialplugins-acknowledged") || false;

            if (!mounted) return;

            if (!alertShown && !acknowledged) {
                const alert = {
                    title: "Attention!",
                    body: <AcknowledgementModal onConfirm={onModalConfirm} />,
                    className: "vc-up-alert",
                    onCloseCallback: () => !acknowledged && Alerts.show(alert),
                };

                Alerts.show(alert);
                alertShown = true;
            }

            const isDownloaded = await Native.isRepoDownloaded();

            if (!mounted) return;
            setInitialised(isDownloaded);

            if (await Native.isWorking()) {
                if (!mounted) return;
                setInitialised(false);
            }

            const partialPluginsResult = await Native.getPartialPlugins();

            if (!mounted) return;

            if (partialPluginsResult.success) {
                const filteredPlugins = (partialPluginsResult.data ?? []).filter(
                    plugin => !Object.keys(Plugins).includes(plugin.name)
                );
                setPartialPlugins(filteredPlugins);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const onInitialiseClick = async () => {
        setIsInitialising(true);

        const errorCode = await Native.initialiseRepo();

        let alert: Parameters<typeof Alerts.show>[0] | null = null;

        switch (errorCode.code) {
            case ErrorCodes.GIT_MISSING: {
                alert = {
                    title: "Failed!",
                    body: "You do not have git installed. Please install git before continuing."
                };
                break;
            }
            case ErrorCodes.COULD_NOT_PULL: {
                alert = {
                    title: "Failed!",
                    body: "Could not pull the Vencord repository."
                };
                break;
            }
            case ErrorCodes.FAILED_PACKAGE_INSTALL: {
                alert = {
                    title: "Failed!",
                    body: "Could not install required packages"
                };
            }
        }

        if (alert) {
            Alerts.show(alert);
            setIsInitialising(false);
            return;
        }

        if (errorCode.code !== 0) {
            Alerts.show({
                title: "Failed!",
                body: "Failed to initialize repository."
            });
            setIsInitialising(false);
            return;
        }

        await DataStore.set(PLUGINS_STORE_KEY, [{
            name: "UnofficialPluginInstaller",
            source: "link",
            repoLink: "https://github.com/surgedevs/UnofficialPluginInstaller",
            folderName: "UnofficialPluginInstaller"
        }]);

        setInitialised(true);
        setIsInitialising(false);
    };

    const onInstall = (partialPlugin: PartialPlugin) => {
        setPartialPlugins([...partialPlugins, partialPlugin]);
    };

    const handlePluginUpdate = (hasAvailableUpdates: boolean, isChecking?: boolean) => {
        setHasUpdates(hasAvailableUpdates);
        if (isChecking !== undefined) {
            setIsLoading(isChecking);
            setLoadingText(isChecking ? "Checking for updates..." : undefined);
        }
    };

    const handleRefreshPlugins = async () => {
        setHasUpdates(false);
        setIsLoading(true);
        setLoadingText("Refreshing plugins...");

        const result = await Native.getPluginList();
        if (result.success) {
            const partialPluginsResult = await Native.getPartialPlugins();
            if (partialPluginsResult.success) {
                const filteredPlugins = (partialPluginsResult.data ?? []).filter(
                    plugin => !Object.keys(Plugins).includes(plugin.name)
                );
                setPartialPlugins(filteredPlugins);
            }
            setIsLoading(false);
            setLoadingText(undefined);
        } else {
            setIsLoading(false);
            setLoadingText(undefined);
            Toasts.show({
                message: "Failed to refresh plugins",
                type: Toasts.Type.FAILURE,
                id: "vc-up-refresh-failed"
            });
        }
    };

    return (
        <SettingsTab title="Unofficial Plugins">
            <div style={{ position: "relative" }}>
                {(isLoading || isInitialising) && <LoadingOverlay text={loadingText || currentState} />}
                {initialised ? <>
                    <Header
                        onInstall={onInstall}
                        hasUpdates={hasUpdates}
                        onLoadingChange={(loading, text) => {
                            setIsLoading(loading);
                            setLoadingText(text);
                        }}
                        onUpdateAll={handleRefreshPlugins}
                    />
                    <PluginList
                        partialPlugins={partialPlugins}
                        onUpdateCheck={handlePluginUpdate}
                        onLoadingChange={(loading, text) => {
                            setIsLoading(loading);
                            setLoadingText(text);
                        }}
                    />
                </> : <>
                    <div className="vc-up-container">
                        <Forms.FormTitle>
                            Uninitialised!
                        </Forms.FormTitle>

                        <Forms.FormText>
                            The Unofficial Plugin Loader is not yet initliased, click the button below to start.<br />
                            Note that this will install a bunch of extra files on your computer.

                            <Forms.FormText type={Forms.FormText.Types.ERROR} className={Margins.top16}>
                                Requires Git and PNPM installed.<br />
                                Git for windows: https://git-scm.com/download/win
                                PNPM: https://pnpm.io/installation
                            </Forms.FormText>

                            <Forms.FormText className={Margins.top16}>
                                Install paths:
                                Windows: %appdata%/Vencord/UnofficialPluginDownloader
                                Linux: ~/.config/Vencord/UnofficialPluginDownloader
                                MacOS: ~/Library/Application Support/Vencord/UnofficialPluginDownloader
                            </Forms.FormText>

                            <Button
                                onClick={onInitialiseClick}
                                disabled={isInitialising}
                                size={Button.Sizes.LARGE}
                                className={Margins.top16}
                                color={Button.Colors.RED}
                            >Initialise</Button>

                            <Forms.FormText type="description">
                                {currentState}
                            </Forms.FormText>
                        </Forms.FormText>
                    </div>
                </>}
            </div>
        </SettingsTab>
    );
}
