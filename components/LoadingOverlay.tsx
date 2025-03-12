/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Forms } from "@webpack/common";

export function LoadingOverlay({ text }: { text?: string; }) {
    return (
        <div className="vc-up-loading-overlay">
            <Flex flexDirection="column" style={{ alignItems: "center", gap: "16px" }}>
                <div className="vc-up-spinner" />
                {text && (
                    <Forms.FormText style={{ color: "var(--text-normal)" }}>
                        {text}
                    </Forms.FormText>
                )}
            </Flex>
        </div>
    );
}
