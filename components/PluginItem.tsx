import { Margins } from "@utils/margins";
import { Button, Forms } from "@webpack/common";
import { Flex } from "@components/Flex";
import { Plugin } from "@utils/types";
import { PartialPlugin } from "../shared";

export default function PluginItem({ plugin, partial }: { plugin: Plugin | PartialPlugin, partial?: boolean; }) {
    return <div className="vc-up-container">
        <Forms.FormTitle>
            <Flex flexDirection="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <Forms.FormText>
                    {plugin.name}
                </Forms.FormText>

                {!partial && <Button
                    size={Button.Sizes.NONE}
                    look={Button.Looks.BLANK}
                    className="vc-up-delete-btn"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z" />
                        <path fill="currentColor" d="M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z" />
                    </svg>
                </Button>
                }
            </Flex>
        </Forms.FormTitle>

        <Forms.FormText>
            {plugin.description}
        </Forms.FormText>
    </div>;
}
