/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeBlock } from "@components/CodeBlock";
import { Flex } from "@components/Flex";
import { Margins } from "@utils/margins";
import { showItemInFolder } from "@utils/native";
import { PluginNative } from "@utils/types";
import { Alerts, Button, Forms, Text, TextInput, Toasts, useState } from "@webpack/common";

import { PartialPlugin } from "../shared";
import { BuildConfirmationModal } from "./BuildConfirmationModal";

const Native = VencordNative.pluginHelpers.UnofficialPluginInstaller as PluginNative<typeof import("../native")>;

export default function Header({
    onInstall,
}: {
    onInstall: (partialPlugin: PartialPlugin) => void;
}) {
    const [linkInput, setLinkInput] = useState("");
    const [isWorking, setIsWorking] = useState(false);

    const onLinkSubmit = async () => {
        setIsWorking(true);
        const result = await Native.installFromRepoLink(linkInput);

        if (result.success) {
            Toasts.show({
                message: "Plugin installed!",
                id: "vc-up-install",
                type: Toasts.Type.SUCCESS,
            });

            setIsWorking(false);
            onInstall({
                name: result.data ?? "Unknown",
                description: "This plugin was just installed! Build & Inject to load additional information.",
            });
            return;
        }

        console.warn("Install resulted in an error!", result.error?.object);

        Alerts.show({
            title: result.error?.message,
            body: result.error?.stderr,
            className: "vc-up-alert-full"
        });

        setIsWorking(false);
    };

    const onClickOpenSource = async () => {
        showItemInFolder(await Native.getSourceFolder());
    };

    const onClickBuildAndInject = async () => {
        const handleConfirm = async (branch: "stable" | "ptb" | "canary") => {
            setIsWorking(true);

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

                setIsWorking(false);
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

                setIsWorking(false);
                return;
            }

            Toasts.show({
                message: "Injection successful!",
                id: "vc-up-inject",
                type: Toasts.Type.SUCCESS,
            });

            setIsWorking(false);
        };

        const alert = {
            title: "Confirm Build & Inject",
            body: <BuildConfirmationModal onConfirm={handleConfirm} />,
            className: "vc-up-alert"
        };

        Alerts.show(alert);
    };

    const onClickUpdateAll = async () => {
        // setIsWorking(true);
        // const result = await Native.updateAll();
    };

    return <div className={"vc-up-container " + Margins.bottom16}>
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
                <Button disabled={isWorking} onClick={onClickOpenSource}>Install From Directory</Button>
                <Button disabled={isWorking} onClick={onClickOpenSource}>Open Source Folder</Button>
                <Button disabled={isWorking} onClick={onClickUpdateAll}>Update All</Button>
                <Button disabled={isWorking} color={Button.Colors.RED} onClick={onClickBuildAndInject}>Build & Inject</Button>
            </Flex>
        </div>
    </div >;
}
