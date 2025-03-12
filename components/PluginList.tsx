/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Grid } from "@components/Grid";
import { PluginNative } from "@utils/types";
import { useEffect, useState } from "@webpack/common";

import Plugins, { PluginMeta } from "~plugins";

import { PartialOrNot, PartialPlugin, PLUGINS_STORE_KEY } from "../shared";
import PluginItem from "./PluginItem";

const Native = VencordNative.pluginHelpers.UnofficialPluginInstaller as PluginNative<typeof import("../native")>;

export default function PluginList({
    partialPlugins,
    onUpdateCheck,
    onLoadingChange
}: {
    partialPlugins: PartialPlugin[];
    onUpdateCheck?: (hasUpdates: boolean, isChecking?: boolean) => void;
    onLoadingChange: (loading: boolean, text?: string) => void;
}) {
    const [plugins, setPlugins] = useState<Array<{
        name: string;
        folderName: string;
        source?: "link" | "directory";
        repoLink?: string;
        partial?: boolean;
        commitHash?: string;
        needsUpdate?: boolean;
    }>>([]);

    const checkForUpdates = async (pluginList: typeof plugins) => {
        onLoadingChange(true, "Checking for updates...");
        const updatedPlugins = [...pluginList];
        let hasAvailableUpdates = false;

        for (const plugin of updatedPlugins) {
            if (plugin.source === "link") {
                const result = await Native.checkPluginUpdates(plugin.folderName);
                if (result.success) {
                    plugin.needsUpdate = result.data.needsUpdate;
                    plugin.commitHash = result.data.currentHash;
                    if (result.data.needsUpdate) {
                        hasAvailableUpdates = true;
                    }
                }
            }
        }

        setPlugins(updatedPlugins);
        onUpdateCheck?.(hasAvailableUpdates, false);
        onLoadingChange(false);
    };

    const resetUpdateStates = () => {
        const updatedPlugins = plugins.map(p => ({ ...p, needsUpdate: false }));
        setPlugins(updatedPlugins);
        onUpdateCheck?.(false, false);
    };

    useEffect(() => {
        (async () => {
            const result = await Native.getPluginList();
            const folderMap = result.success ? Object.fromEntries(
                result.data?.map(({ pluginName, folderName }) => [pluginName, folderName]) ?? []
            ) : {};

            const storedPlugins = await DataStore.get(PLUGINS_STORE_KEY) || {};

            const pluginMetaMap = Array.isArray(storedPlugins)
                ? Object.fromEntries(storedPlugins.map(plugin => [plugin.name, plugin]))
                : Object.fromEntries(
                    Object.entries(storedPlugins)
                        .map(([name, data]) => [name, data as PartialPlugin])
                        .filter(([_, data]) => data !== undefined)
                );

            const allPlugins = [
                ...partialPlugins
                    .filter(p => folderMap[p.name])
                    .map(p => {
                        return {
                            ...p,
                            folderName: folderMap[p.name],
                            source: pluginMetaMap[p.name]?.source,
                            repoLink: pluginMetaMap[p.name]?.repoLink,
                            partial: true,
                            needsUpdate: false
                        };
                    }),

                ...Object.values(Plugins)
                    .filter(p => PluginMeta[p.name]?.userPlugin && folderMap[p.name])
                    .map(p => {
                        return {
                            ...p,
                            folderName: folderMap[p.name],
                            source: pluginMetaMap[p.name]?.source,
                            repoLink: pluginMetaMap[p.name]?.repoLink,
                            needsUpdate: false
                        };
                    })
            ];

            setPlugins(allPlugins);
            checkForUpdates(allPlugins);
        })();
    }, [partialPlugins]);

    const handleUpdate = (pluginName: string) => {
        const updatedPlugins = plugins.map(p => {
            if (p.name === pluginName) {
                return { ...p, needsUpdate: false };
            }
            return p;
        });
        setPlugins(updatedPlugins);
        // Check if any plugins still need updates
        const stillNeedsUpdates = updatedPlugins.some(p => p.needsUpdate);
        onUpdateCheck?.(stillNeedsUpdates, false);
    };

    return (
        <div style={{ position: "relative" }}>
            <Grid columns={2} gap={"16px"}>
                {plugins.map(plugin => (
                    <PluginItem
                        key={plugin.name}
                        plugin={plugin as PartialOrNot}
                        onUpdate={handleUpdate}
                        resetUpdateStates={resetUpdateStates}
                    />
                ))}
            </Grid>
        </div>
    );
}
