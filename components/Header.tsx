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

    const onClickBuild = async () => {
        setIsWorking(true);
        const result = await Native.build();

        if (result.success) {
            Toasts.show({
                message: "Build success!",
                id: "vc-up-build",
                type: Toasts.Type.SUCCESS,
            });
            setIsWorking(false);
            return;
        }

        console.warn("Build resulted in an error!", result.error?.object);

        Alerts.show({
            title: result.error?.message,
            body: <>
                <Text
                    tag="h2"
                    variant="eyebrow"
                    style={{
                        color: "var(--header-primary)",
                        display: "inline"
                    }}
                >
                    {result.error?.message}
                </Text>

                <Forms.FormText>stdout:</Forms.FormText>
                <CodeBlock lang="javascript" content={result.error?.stdout} />

                <Forms.FormText>stderr:</Forms.FormText>
                <CodeBlock lang="javascript" content={result.error?.stderr} />
            </>,
            className: "vc-up-alert-full"
        });

        setIsWorking(false);
    };

    const onClickInject = async () => {
        setIsWorking(true);
        const result = await Native.inject();

        if (result.success) {
            Toasts.show({
                message: "Injection successful!",
                id: "vc-up-inject",
                type: Toasts.Type.SUCCESS,
            });
            setIsWorking(false);
            return;
        }

        console.warn("Injection resulted in an error!", result.error?.object);

        Alerts.show({
            title: result.error?.message,
            body: result.error?.stderr,
            className: "vc-up-alert-full"
        });
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
                <Button disabled={isWorking} onClick={onClickBuild}>Build</Button>
                <Button disabled={isWorking} color={Button.Colors.RED} onClick={onClickInject}>Inject</Button>
            </Flex>
        </div>
    </div >;
}
