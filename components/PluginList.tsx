/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Grid } from "@components/Grid";
import { PluginNative } from "@utils/types";
import { useCallback, useEffect, useRef, useState } from "@webpack/common";

import Plugins, { PluginMeta } from "~plugins";

import { PartialOrNot, PartialPlugin, PLUGINS_STORE_KEY } from "../shared";
import PluginItem from "./PluginItem";

const Native = VencordNative.pluginHelpers.UnofficialPluginInstaller as PluginNative<typeof import("../native")>;

interface Plugin {
    name: string;
    folderName: string;
    source?: "link" | "directory";
    repoLink?: string;
    partial?: boolean;
    commitHash?: string;
    needsUpdate?: boolean;
}

export default function PluginList({
    partialPlugins,
    onUpdateCheck,
    onLoadingChange
}: {
    partialPlugins: PartialPlugin[];
    onUpdateCheck?: (hasUpdates: boolean, isChecking?: boolean) => void;
    onLoadingChange: (loading: boolean, text?: string) => void;
}) {
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [error, setError] = useState<string | null>(null);
    const isInitialMount = useRef(true);

    const checkForUpdates = useCallback(async (pluginList: Plugin[]) => {
        onLoadingChange(true, "Checking for updates...");
        setError(null);

        try {
            const updatedPlugins = await Promise.all(pluginList.map(async plugin => {
                if (plugin.source !== "link") return plugin;

                console.log("Checking updates for", plugin);

                const result = await Native.checkPluginUpdates(plugin.folderName);
                console.log(result);
                if (!result.success) {
                    console.error(`Failed to check updates for ${plugin.name}:`, result.error);
                    return plugin;
                }

                return {
                    ...plugin,
                    needsUpdate: result.data?.needsUpdate ?? false,
                    commitHash: result.data?.currentHash
                };
            }));

            setPlugins(updatedPlugins);
            const hasUpdates = updatedPlugins.some(p => p.needsUpdate);
            onUpdateCheck?.(hasUpdates, false);
        } catch (err) {
            setError("Failed to check for updates");
            console.error("Update check failed:", err);
        } finally {
            onLoadingChange(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        async function initializePlugins() {
            try {
                onLoadingChange(true, "Loading plugins...");
                setError(null);

                const result = await Native.getPluginList();
                console.log("girlcockx", result);
                if (!result.success) {
                    throw new Error(result.error?.message || "Failed to get plugin list");
                }

                if (!mounted) return;

                const folderMap = Object.fromEntries(
                    (result.data ?? []).map(({ pluginName, folderName }) => [pluginName, folderName])
                );

                console.log("folderMap", folderMap);

                const storedPlugins = await DataStore.get(PLUGINS_STORE_KEY) || [];
                const pluginMetaMap = Object.fromEntries(
                    storedPlugins.map(plugin => [plugin.name, plugin])
                );

                console.log("pluginMeta", PluginMeta);
                console.log("pluginMetaMap", pluginMetaMap);

                const mapPlugin = (p: any, isPartial = false): Plugin => {
                    const folderName = isPartial ? p.folderName : (
                        p.name === "UnofficialPluginInstaller" ? folderMap[p.name] :
                            PluginMeta[p.name]?.userPlugin ? PluginMeta[p.name].folderName.replace("\\", "/").split("/").pop() :
                                folderMap[p.name]
                    );

                    return {
                        ...p,
                        folderName,
                        source: pluginMetaMap[p.name]?.source,
                        repoLink: pluginMetaMap[p.name]?.repoLink,
                        partial: isPartial,
                        needsUpdate: false
                    };
                };

                if (!mounted) return;

                const partialPluginsMapped = partialPlugins
                    .filter(p => p.folderName)
                    .map(p => mapPlugin(p, true));

                console.log("partialPluginsMapped", partialPluginsMapped);

                const fullPluginsMapped = Object.values(Plugins)
                    .filter(p => PluginMeta[p.name]?.userPlugin || folderMap[p.name])
                    .map(p => mapPlugin(p));

                console.log("fullPluginsMapped", fullPluginsMapped);

                const allPlugins = [...partialPluginsMapped, ...fullPluginsMapped];

                if (!mounted) return;

                setPlugins(allPlugins);

                if (isInitialMount.current) {
                    isInitialMount.current = false;
                    await checkForUpdates(allPlugins);
                }
            } catch (err) {
                if (!mounted) return;
                setError("Failed to load plugins");
                console.error("Plugin initialization failed:", err);
            } finally {
                if (mounted) {
                    onLoadingChange(false);
                }
            }
        }

        initializePlugins();

        return () => {
            mounted = false;
        };
    }, [partialPlugins]);

    const handleUpdate = useCallback((pluginName: string) => {
        setPlugins(prev => prev.map(p =>
            p.name === pluginName ? { ...p, needsUpdate: false } : p
        ));
    }, []);

    const handleDelete = useCallback((pluginName: string) => {
        setPlugins(prev => prev.filter(p => p.name !== pluginName));
    }, []);

    if (error) {
        return (
            <div style={{ color: "var(--text-danger)", padding: "1rem" }}>
                {error}
            </div>
        );
    }

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
