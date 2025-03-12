/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Margins } from "@utils/margins";
import { PluginNative } from "@utils/types";
import { Button, Forms, showToast } from "@webpack/common";

import { PartialOrNot } from "../shared";

const Native = VencordNative.pluginHelpers.UnofficialPluginInstaller as PluginNative<typeof import("../native")>;

export default function PluginItem({
    plugin,
    onUpdate
}: {
    plugin: PartialOrNot;
    onUpdate?: (pluginName: string) => void;
}) {
    const onDeleteClick = async () => {
        const result = await Native.deletePlugin(plugin.folderName);

        if (result.success) {
            showToast("Plugin source deleted successfully. Build & inject to remove from Discord.", "success");
        } else {
            showToast("Failed to delete plugin source.", "failure");
        }
    };

    const handleUpdate = async () => {
        try {
            await Native.updatePlugin(plugin.folderName);
            showToast("Plugin updated successfully!", "success");
            onUpdate?.(plugin.name);
        } catch (err) {
            showToast(`Failed to update plugin: ${err}`, "failure");
        }
    };

    return <div className="vc-up-container">
        <Forms.FormTitle>
            <Flex flexDirection="row" style={{ alignItems: "center" }}>
                <Forms.FormText style={{ flex: 1 }}>
                    {plugin.name}
                </Forms.FormText>

                <Flex style={{ gap: "8px" }}>
                    {plugin.source === "link" && plugin.needsUpdate && (
                        <Button
                            size={Button.Sizes.NONE}
                            look={Button.Looks.BLANK}
                            className="vc-up-update-btn"
                            onClick={handleUpdate}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                            </svg>
                        </Button>
                    )}

                    <Button
                        size={Button.Sizes.NONE}
                        look={Button.Looks.BLANK}
                        className="vc-up-delete-btn"
                        onClick={onDeleteClick}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z" />
                            <path fill="currentColor" d="M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z" />
                        </svg>
                    </Button>
                </Flex>
            </Flex>
        </Forms.FormTitle>

        {plugin.partial ? (
            <Forms.FormText>
                This plugin has just been installed! Build & Inject to load additional information.
            </Forms.FormText>
        ) : (
            <Forms.FormText>
                {plugin.description}
            </Forms.FormText>
        )}

        {plugin.source === "link" && (
            <Forms.FormText className={Margins.top16} style={{ wordBreak: "break-all", fontSize: "12px" }}>
                <Link href={plugin.repoLink} target="_blank">
                    {plugin.repoLink}
                </Link>
                {plugin.commitHash && (
                    <span className="vc-up-commit-hash">
                        @ {plugin.commitHash.substring(0, 7)}
                    </span>
                )}
            </Forms.FormText>
        )}
    </div>;
}
