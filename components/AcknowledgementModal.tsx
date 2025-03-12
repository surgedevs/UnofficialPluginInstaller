/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Margins } from "@utils/margins";
import { Button, Text, TextInput, useState } from "@webpack/common";

function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

function stringSimilarity(str1: string, str2: string): number {
    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return (maxLength - distance) / maxLength;
}

const confirmText = "I acknowledge that custom plugins may contain malware and are provided with no support. I will not go into the Vencord Discord server to gain support and I will not complain about viruses, cryptominers or other types of malware entering my computer.";

export function AcknowledgementModal({ onConfirm }: { onConfirm: () => void; }) {
    const [input, setInput] = useState("");

    const onButtonClick = () => {
        const similarity = stringSimilarity(input.trim().toLowerCase(), confirmText.toLowerCase());

        if (similarity > 0.8 || input.trim().toLowerCase() === "dev-skip") {
            onConfirm();
        }
    };

    return (
        <div>
            <Text className={Margins.top16}>Please type in the following text to use this plugin:</Text>
            <Text className={`${Margins.top16} ${Margins.bottom16}`}>"{confirmText}"</Text>

            <TextInput
                type="text"
                placeholder="Type in the text above"
                onChange={e => setInput(e)}
                className={Margins.bottom16}
            />

            <Button
                size={Button.Sizes.SMALL}
                color={Button.Colors.RED}
                wrapperClassName={Margins.bottom16}
                onClick={onButtonClick}
            >
                Confirm
            </Button>
        </div>
    );
}
