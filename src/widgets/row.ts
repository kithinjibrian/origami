import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface RowParams {
    key?: string;
}

export class Row extends ImmutableWidget {
    name = "Row";

    constructor(
        private children: Widget[],
        { key }: RowParams = {}
    ) {
        super({ key });
    }

    build(context: BuildContext): Widget {
        const children = this.children;

        return new class extends Widget {
            name = "RowBody";

            render(ctx: BuildContext): Node {
                const el = document.createElement("div");
                el.style.display = "flex";
                el.style.flexDirection = "row";

                for (const child of children) {
                    const childEl = child.render(ctx);
                    el.appendChild(childEl);
                }

                return this.setElement(el);
            }
        }({ key: `${this.key}_body` });
    }
}