/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */


import { Grid } from "@components/Grid";

import Plugins, { PluginMeta } from "~plugins";
import PluginItem from "./PluginItem";
import { PartialPlugin } from "../shared";

export default function PluginList({ partialPlugins }: { partialPlugins: PartialPlugin[]; }) {
    return <Grid columns={2} gap={"16px"}>
        {
            partialPlugins.map((plugin) =>
                <PluginItem key={plugin.name} plugin={plugin} partial={true} />
            )
        }
        {
            Object.entries(Plugins)
                .filter(([name, _]) => PluginMeta[name].userPlugin)
                .map(([_, plugin]) =>
                    <PluginItem key={plugin.name} plugin={plugin} />
                )
        }
    </Grid>;
}
