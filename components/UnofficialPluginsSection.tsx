/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { SettingsTab } from "@components/VencordSettings/shared";
import { PluginNative } from "@utils/types";
import { Alerts, useEffect, useState } from "@webpack/common";

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
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState<string>();
    const [hasUpdates, setHasUpdates] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [plugins, setPlugins] = useState<PartialPlugin[]>([]);

    const handleLoadingChange = (isLoading: boolean, text?: string) => {
        setLoading(isLoading);
        setLoadingText(text);
    };

    const handleUpdateCheck = (hasUpdates: boolean, isChecking?: boolean) => {
        setHasUpdates(hasUpdates);
        if (isChecking !== undefined) setIsChecking(isChecking);
    };

    const handleUpdateAll = () => {
        setHasUpdates(false);
        setIsChecking(false);
    };

    const onModalConfirm = async () => {
        acknowledged = true;

        const alertButton: HTMLButtonElement | null = document.querySelector(
            '.vc-up-alert [class*="primaryButton_"]'
        );
        alertButton?.click();

        await DataStore.set("vc-unofficialplugins-acknowledged", true);
    };

    useEffect(() => {
        (async () => {
            acknowledged = await DataStore.get("vc-unofficialplugins-acknowledged") || false;

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

            const partialPluginsResult = await Native.getPartialPlugins();

            if (partialPluginsResult.success) {
                const filteredPlugins = (partialPluginsResult.data ?? []).filter(
                    plugin => !Object.keys(Plugins).includes(plugin.name)
                );
                setPlugins(filteredPlugins);
            }
        })();
    }, []);

    const onInitialiseClick = async () => {
        setLoading(true);

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

        console.log(errorCode.information);

        if (alert) {
            Alerts.show(alert);
            return;
        }

        setPlugins([{
            name: "Unofficial Plugin Installer",
            source: "link",
            repoLink: "https://github.com/surgedevs/UnofficialPluginInstaller",
            folderName: "UnofficialPluginInstaller"
        }]);

        await DataStore.set(PLUGINS_STORE_KEY, plugins);
    };

    const handleInstall = (partialPlugin: PartialPlugin) => {
        setPlugins([...plugins, partialPlugin]);
    };

    return (
        <SettingsTab title="Unofficial Plugins">
            <div style={{ position: "relative" }}>
                <Header
                    onInstall={handleInstall}
                    hasUpdates={hasUpdates}
                    onLoadingChange={handleLoadingChange}
                    onUpdateAll={handleUpdateAll}
                />

                <PluginList
                    partialPlugins={plugins}
                    onUpdateCheck={handleUpdateCheck}
                    onLoadingChange={handleLoadingChange}
                />
                {loading && <LoadingOverlay text={loadingText} />}
            </div>
        </SettingsTab>
    );
}
