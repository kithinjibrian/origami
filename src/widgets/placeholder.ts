import { BuildContext, ImmutableWidget, Widget } from "./framework";


interface PlaceholderParams {
    key?: string;
    width?: number;
    height?: number;
    color?: string;
    strokeWidth?: number;
}

export class Placeholder extends ImmutableWidget {
    private width?: number;
    private height?: number;
    private color: string;
    private strokeWidth: number;

    constructor(params: PlaceholderParams = {}) {
        super({ key: params.key });
        this.width = params.width;
        this.height = params.height;
        this.color = params.color ?? "#b0b0b0";
        this.strokeWidth = params.strokeWidth ?? 2;
    }

    build(context: BuildContext): Widget {
        const { width, height, color, strokeWidth } = this;

        return new class extends Widget {
            name = "PlaceholderBody";
            anchor: Comment | null = null;

            render(ctx: BuildContext): Node {
                const el = document.createElement("div");

                if (typeof width === "number") el.style.width = `${width}px`;
                if (typeof height === "number") el.style.height = `${height}px`;

                el.style.border = `${strokeWidth}px dashed ${color}`;
                el.style.boxSizing = "border-box";
                el.style.position = "relative";
                el.style.display = "flex";
                el.style.justifyContent = "center";
                el.style.alignItems = "center";

                const diagonal = document.createElement("div");
                diagonal.style.position = "absolute";
                diagonal.style.top = "0";
                diagonal.style.left = "0";
                diagonal.style.width = "100%";
                diagonal.style.height = "100%";
                diagonal.style.backgroundImage = `linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%, ${color}), 
                                                 linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%, ${color})`;
                diagonal.style.backgroundSize = "20px 20px";
                diagonal.style.backgroundPosition = "0 0, 10px 10px";
                diagonal.style.opacity = "0.2";
                el.appendChild(diagonal);

                return el;
            }
        }({ key: `${this.key}_body` });
    }
}
