import { FlexFit } from "../rendering/__init__";
import { BuildContext, ImmutableWidget, Widget } from "./framework";

export class Flexible extends ImmutableWidget {
    private child: Widget;
    private flex: number;
    private fit: FlexFit;

    constructor(
        child: Widget,
        {
            key,
            flex = 1,
            fit = FlexFit.loose,
        }: { key?: string; flex?: number; fit?: FlexFit } = {}
    ) {
        super({ key });
        this.child = child;
        this.flex = flex;
        this.fit = fit;
    }

    build(context: BuildContext): Widget {
        const { child, flex, fit } = this;

        return new class extends Widget {
            name = "FlexibleBody";
            anchor: Comment | null = null;

            render(ctx: BuildContext): Node {
                const el = document.createElement("div");

                el.style.flexGrow = `${flex}`;
                el.style.flexShrink = "1";

                if (fit === FlexFit.tight) {
                    el.style.flexBasis = "0";
                    el.style.display = "flex";
                    el.style.flexDirection = "column";
                    el.style.minWidth = "0";
                    el.style.minHeight = "0";
                } else {
                    el.style.flexBasis = "auto";
                }

                const childEl = child.render(ctx);
                el.appendChild(childEl);

                return el;
            }
        }({ key: `${this.key}_body` });
    }
}
