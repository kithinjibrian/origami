import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface SizedBoxParams {
    key?: string;
    width?: number;
    height?: number;
}


export class SizedBox extends ImmutableWidget {
    private width?: number;
    private height?: number;
    private child?: Widget;

    constructor(params: SizedBoxParams = {}, child?: Widget) {
        super({ key: params.key });
        this.width = params.width;
        this.height = params.height;
        this.child = child;
    }

    static expand(params: { key?: string } = {}, child?: Widget): SizedBox {
        return new SizedBox({ ...params, width: Infinity, height: Infinity }, child);
    }

    static shrink(params: { key?: string } = {}): SizedBox {
        return new SizedBox({ ...params, width: 0, height: 0 });
    }

    build(context: BuildContext): Widget {
        const { width, height, child } = this;

        return new class extends Widget {
            name = "SizedBoxBody";
            anchor: Comment | null = null;

            render(ctx: BuildContext): Node {
                const el = document.createElement("div");

                if (typeof width === "number") {
                    if (width === Infinity) el.style.width = "100%";
                    else el.style.width = `${width}px`;
                }

                if (typeof height === "number") {
                    if (height === Infinity) el.style.height = "100%";
                    else el.style.height = `${height}px`;
                }

                if (child) {
                    const childEl = child.render(ctx);
                    el.appendChild(childEl);
                }

                return el;
            }
        }({ key: `${this.key}_body` });
    }
}
