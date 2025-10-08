import { BasicTypes, VerticalDirection } from "../painting/__init__";
import { CrossAxisAlignment, FlexAlign, MainAxisAlignment, MainAxisSize } from "../rendering/__init__";
import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface ColumnParams {
    key?: string;
    mainAxisAlignment?: MainAxisAlignment,
    crossAxisAlignment?: CrossAxisAlignment,
    mainAxisSize?: MainAxisSize;
    verticalDirection?: VerticalDirection,
}

export class Column extends ImmutableWidget {
    private mainAxisAlignment: MainAxisAlignment;
    private crossAxisAlignment: CrossAxisAlignment;
    private mainAxisSize: MainAxisSize;
    private verticalDirection: VerticalDirection;

    constructor(
        private children: Widget[],
        {
            key,
            mainAxisAlignment = MainAxisAlignment.start,
            crossAxisAlignment = CrossAxisAlignment.center,
            mainAxisSize = MainAxisSize.max,
            verticalDirection = VerticalDirection.down
        }: ColumnParams = {}
    ) {
        super({ key });

        this.mainAxisAlignment = mainAxisAlignment;
        this.crossAxisAlignment = crossAxisAlignment;
        this.mainAxisSize = mainAxisSize;
        this.verticalDirection = verticalDirection;
    }

    build(context: BuildContext): Widget {
        const {
            children,
            mainAxisAlignment,
            crossAxisAlignment,
            mainAxisSize,
            verticalDirection,
        } = this;

        return new class extends Widget {
            name = "ColumnBody";
            anchor: Comment | null = null;

            render(ctx: BuildContext): Node {
                const div = document.createElement("div");

                div.style.display = "flex";
                div.style.flexDirection = "column";

                // Apply vertical direction (affects flow order)
                BasicTypes.applyVerticalDirection(div, verticalDirection);

                FlexAlign.applyMainAxisAlignment(div, mainAxisAlignment);
                FlexAlign.applyCrossAxisAlignment(div, crossAxisAlignment);
                FlexAlign.applyMainAxisSize(div, mainAxisSize, "column");

                children.map(child => {
                    const el = child.render(ctx);
                    div.appendChild(el);
                });

                return div;
            }
        }({ key: `${this.key}_body` });
    }
}
