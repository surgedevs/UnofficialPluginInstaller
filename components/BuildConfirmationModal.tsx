/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Margins } from "@utils/margins";
import { Button, Select, Text, useState } from "@webpack/common";

type DiscordBranch = "stable" | "ptb" | "canary";

interface BranchOption {
    label: string;
    value: DiscordBranch;
    default?: boolean;
}

const BRANCH_OPTIONS: BranchOption[] = [
    { label: "Stable", value: "stable" },
    { label: "PTB", value: "ptb" },
    { label: "Canary", value: "canary", default: true }
];

export function BuildConfirmationModal({ onConfirm }: { onConfirm: (branch: DiscordBranch) => void; }) {
    const [selectedBranch, setSelectedBranch] = useState<DiscordBranch>(
        BRANCH_OPTIONS.find(o => o.default)?.value ?? "canary"
    );

    const onButtonClick = () => {
        const alertButton: HTMLButtonElement | null = document.querySelector(
            '.vc-up-alert [class*="primaryButton_"]'
        );
        alertButton?.click();

        onConfirm(selectedBranch);
    };

    const onCancelClick = () => {
        const alertButton: HTMLButtonElement | null = document.querySelector(
            '.vc-up-alert [class*="primaryButton_"]'
        );
        alertButton?.click();
    };

    return (
        <div>
            <Text className={Margins.top16}>
                This will build all plugins and inject them into Discord. Discord will close and must be reopened manually.
            </Text>

            <div className={Margins.top16}>
                <Text variant="text-sm/normal">Select Discord Branch:</Text>
                <Select
                    options={BRANCH_OPTIONS}
                    placeholder="Select Discord Branch"
                    maxVisibleItems={5}
                    closeOnSelect={true}
                    select={v => setSelectedBranch(v)}
                    isSelected={v => v === selectedBranch}
                    serialize={String}
                    className={Margins.top8}
                />
            </div>

            <div className={Margins.top16} style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button
                    onClick={onCancelClick}
                    look={Button.Looks.LINK}
                    color={Button.Colors.PRIMARY}
                >
                    Cancel
                </Button>
                <Button
                    onClick={onButtonClick}
                    color={Button.Colors.RED}
                >
                    Build & Inject
                </Button>
            </div>
        </div>
    );
}
