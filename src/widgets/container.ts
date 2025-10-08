import { Color, EdgeInsets } from "../painting/__init__";
import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface ContainerParams {
    key?: string;
    margin?: EdgeInsets;
    padding?: EdgeInsets;
    color?: Color;
    width?: number;
    height?: number;
}

export class Container extends ImmutableWidget {
    constructor(
        private child: Widget,
        private params: ContainerParams = {}
    ) {
        super({ key: params.key });
    }

    build(context: BuildContext): Widget {
        const { margin, padding, color, width, height } = this.params;

        const child = this.child;

        return new class extends Widget {
            name = "ContainerBody";
            anchor: Comment | null = null;

            render(ctx: BuildContext): Node {
                const el = document.createElement("div");

                EdgeInsets.applyEdgeInset(el, margin, "margin")
                EdgeInsets.applyEdgeInset(el, padding, "padding")
                color?.applyColor(el, "bg");

                if (typeof width === "number") {
                    el.style.width = `${width}px`;
                }
                if (typeof height === "number") {
                    el.style.height = `${height}px`;
                }

                const childEl = child.render(ctx);
                el.appendChild(childEl);

                return el;
            }
        }({ key: `${this.key}_body` });
    }
}
