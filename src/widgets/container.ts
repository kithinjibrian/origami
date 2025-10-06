import { Color, EdgeInsets } from "../painting/__init__";
import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface ContainerParams {
    key?: string;
    margin?: EdgeInsets;
    padding?: EdgeInsets;
    color?: Color;
}

export class Container extends ImmutableWidget {
    name = "Container";

    constructor(
        private child: Widget,
        private params: ContainerParams = {}
    ) {
        super({ key: params.key });
    }

    build(context: BuildContext): Widget {
        const { margin, padding, color } = this.params;
        const child = this.child;

        return new class extends Widget {
            name = "ContainerBody";

            render(ctx: BuildContext): Node {
                const el = document.createElement("div");

                if (margin) {
                    el.style.margin = margin.toString();
                }

                if (padding) {
                    el.style.padding = padding.toString();
                }

                if (color) {
                    el.style.backgroundColor = color.toString();
                }

                const childEl = child.render(ctx);
                el.appendChild(childEl);

                return this.setElement(el) as Node;
            }
        }({ key: `${this.key}_body` });
    }
}
