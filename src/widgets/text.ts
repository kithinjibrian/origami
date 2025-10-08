import { TextStyle } from "../painting/__init__";
import { Reactive } from "../types/__init__";
import { bind } from "../utils/__init__";
import { BuildContext, DataWidget, MutableWidget, Widget } from "./framework";

interface TextParams {
    style?: TextStyle
}

export class Text extends MutableWidget {
    style?: TextStyle;

    constructor(
        public value: Reactive<string>,
        {
            style
        }: TextParams = {}
    ) {
        super();

        this.style = style;
    }

    createMutable(): DataWidget<this> {
        return new TextMutable(this);
    }
}

class TextMutable<T extends Text> extends DataWidget<T> {
    constructor(
        widget: T
    ) {
        super(widget);
    }

    dispose(): void {
        super.dispose();
    }

    build(_context: BuildContext): Widget {
        let value = this.widget.value;
        let style = this.widget.style;
        let effect = this.effect;

        return new class extends Widget {
            name: string = "Text"
            anchor: Comment | null = null;

            render(_ctx: BuildContext): Node {
                const span = document.createElement("span");

                bind(
                    span,
                    "textContent",
                    value,
                    effect
                );

                style?.applyTo(span, effect);

                return span;
            }
        }();
    }
}