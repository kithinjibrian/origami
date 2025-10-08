import { BuildContext, ImmutableWidget, Widget } from "./framework";


export class Spacer extends ImmutableWidget {
    private flex: number;

    constructor({ key, flex = 1 }: { key?: string; flex?: number } = {}) {
        super({ key });
        this.flex = flex;
    }

    build(context: BuildContext): Widget {
        const { flex } = this;

        return new class extends Widget {
            name = "SpacerBody";
            anchor: Comment | null = null;

            render(ctx: BuildContext): Node {
                const el = document.createElement("div");

                el.style.flexGrow = `${flex}`;
                el.style.flexShrink = "1";
                el.style.flexBasis = "0";

                el.style.minWidth = "0";
                el.style.minHeight = "0";

                return el;
            }
        }({ key: `${this.key}_body` });
    }
}
