/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { SettingsTab } from "@components/VencordSettings/shared";
import { Margins } from "@utils/margins";
import { PluginNative } from "@utils/types";
import { Alerts, Button, Forms, useEffect, useState } from "@webpack/common";

import Plugins from "~plugins";

import { ErrorCodes, PartialPlugin } from "../shared";
import { AcknowledgementModal } from "./AcknowledgementModal";
import Header from "./Header";
import PluginList from "./PluginList";

const Native = VencordNative.pluginHelpers.UnofficialPluginInstaller as PluginNative<typeof import("../native")>;

let alertShown = false;
let acknowledged = false;

export function UnofficialPluginsSection() {
    const [isInitialising, setIsInitialising] = useState(false);
    const [initialised, setInitialised] = useState(false);
    const [currentState, setCurrentState] = useState("");
    const [partialPlugins, setPartialPlugins] = useState<PartialPlugin[]>([]);
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
                    onCloseCallback: () => (console.log(acknowledged), !acknowledged && Alerts.show(alert)),
                };

                Alerts.show(alert);
                alertShown = true;
            }

            setInitialised(await Native.isRepoDownloaded());

            if (await Native.isWorking()) {
                setInitialised(false);
            }

            const partialPluginsResult = await Native.getPartialPlugins();

            if (partialPluginsResult.success) {
                const filteredPlugins = (partialPluginsResult.data ?? []).filter(
                    plugin => !Object.keys(Plugins).includes(plugin.name)
                );
                setPartialPlugins(filteredPlugins);
            }
        })();
    });

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
        }

        setInitialised(true);
    };

    const onInstall = (partialPlugin: PartialPlugin) => {
        setPartialPlugins([...partialPlugins, partialPlugin]);
    };

    return (
        <SettingsTab title="Unofficial Plugins">
            {initialised ? <>
                <Header onInstall={onInstall} />
                <PluginList partialPlugins={partialPlugins} />
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

        </SettingsTab>
    );
}
