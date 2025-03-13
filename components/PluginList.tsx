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
        const currentPluginsStr = JSON.stringify(plugins);
        const newPluginsStr = JSON.stringify(newPlugins);
        if (currentPluginsStr !== newPluginsStr) {
            setPlugins(newPlugins);
            const hasUpdates = newPlugins.some(p => p.needsUpdate);
            onUpdateCheck?.(hasUpdates, false);
        }
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
        let mounted = true;

        async function initializePlugins() {
            const result = await Native.getPluginList();

            if (!mounted) return;

            const folderMap = result.success
                ? Object.fromEntries(result.data?.map(({ pluginName, folderName }) => [pluginName, folderName]) ?? [])
                : {};

            const storedPlugins = await DataStore.get(PLUGINS_STORE_KEY) || [];

            if (!mounted) return;

            const pluginMetaMap = Object.fromEntries(storedPlugins.map(plugin => [plugin.name, plugin]));

            const mapPlugin = (p: any, isPartial = false) => {
                const folderName = isPartial ? p.folderName : (PluginMeta[p.name]?.userPlugin ? PluginMeta[p.name].folderName : folderMap[p.name]);
                const mapped = {
                    ...p,
                    folderName,
                    source: pluginMetaMap[p.name]?.source,
                    repoLink: pluginMetaMap[p.name]?.repoLink,
                    partial: isPartial,
                    needsUpdate: false
                };
                return mapped;
            };

            if (!mounted) return;

            const partialPluginsMapped = partialPlugins
                .filter(p => p.folderName)
                .map(p => mapPlugin(p, true));

            const fullPluginsMapped = Object.values(Plugins)
                .filter(p => PluginMeta[p.name]?.userPlugin || folderMap[p.name])
                .map(p => mapPlugin(p));

            const allPlugins = [...partialPluginsMapped, ...fullPluginsMapped];

            if (!mounted) return;

            const currentPluginsStr = JSON.stringify(plugins);
            const newPluginsStr = JSON.stringify(allPlugins);
            if (currentPluginsStr !== newPluginsStr) {
                setPlugins(allPlugins);
                checkForUpdates(allPlugins);
            }
        }

        initializePlugins();

        return () => {
            mounted = false;
        };
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
