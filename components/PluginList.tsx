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

    const updatePluginsAndNotify = (newPlugins: typeof plugins) => {
        setPlugins(newPlugins);
        const hasUpdates = newPlugins.some(p => p.needsUpdate);
        onUpdateCheck?.(hasUpdates, false);
    };

    const checkForUpdates = async (pluginList: typeof plugins) => {
        onLoadingChange(true, "Checking for updates...");

        const updatedPlugins = await Promise.all(pluginList.map(async plugin => {
            if (plugin.source !== "link") return plugin;

            const result = await Native.checkPluginUpdates(plugin.folderName);
            if (!result.success) return plugin;

            return {
                ...plugin,
                needsUpdate: result.data.needsUpdate,
                commitHash: result.data.currentHash
            };
        }));

        updatePluginsAndNotify(updatedPlugins);
        onLoadingChange(false);
    };

    useEffect(() => {
        async function initializePlugins() {
            const result = await Native.getPluginList();
            const folderMap = result.success
                ? Object.fromEntries(result.data?.map(({ pluginName, folderName }) => [pluginName, folderName]) ?? [])
                : {};

            const storedPlugins = await DataStore.get(PLUGINS_STORE_KEY) || [];
            const pluginMetaMap = Object.fromEntries(storedPlugins.map(plugin => [plugin.name, plugin]));

            const mapPlugin = (p: any, isPartial = false) => ({
                ...p,
                folderName: folderMap[p.name],
                source: pluginMetaMap[p.name]?.source,
                repoLink: pluginMetaMap[p.name]?.repoLink,
                partial: isPartial,
                needsUpdate: false
            });

            const allPlugins = [
                ...partialPlugins
                    .filter(p => folderMap[p.name])
                    .map(p => mapPlugin(p, true)),
                ...Object.values(Plugins)
                    .filter(p => PluginMeta[p.name]?.userPlugin && folderMap[p.name])
                    .map(p => mapPlugin(p))
            ];

            setPlugins(allPlugins);
            checkForUpdates(allPlugins);
        }

        initializePlugins();
    }, [partialPlugins]);

    const handleUpdate = (pluginName: string) => {
        updatePluginsAndNotify(
            plugins.map(p => p.name === pluginName ? { ...p, needsUpdate: false } : p)
        );
    };

    const handleDelete = (pluginName: string) => {
        updatePluginsAndNotify(
            plugins.filter(p => p.name !== pluginName)
        );
    };

    return (
        <div style={{ position: "relative" }}>
            <Grid columns={2} gap={"16px"}>
                {plugins.map(plugin => (
                    <PluginItem
                        key={plugin.name}
                        plugin={plugin as PartialOrNot}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                    />
                ))}
            </Grid>
        </div>
    );
}
