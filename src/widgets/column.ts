import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface ColumnParams {
    key?: string;
}

export class Column extends ImmutableWidget {
    name = "Column";

    constructor(
        private children: Widget[],
        { key }: ColumnParams = {}
    ) {
        super({ key });
    }

    build(context: BuildContext): Widget {
        const children = this.children;

        return new class extends Widget {
            name = "ColumnBody";

            render(ctx: BuildContext): Node {
                const el = document.createElement("div");
                el.style.display = "flex";
                el.style.flexDirection = "column";

                for (const child of children) {
                    const childEl = child.render(ctx);
                    el.appendChild(childEl);
                }

                return this.setElement(el);
            }
        }({ key: `${this.key}_body` });
    }
}
