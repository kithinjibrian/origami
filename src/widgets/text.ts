import { TextStyle } from "../painting/text_style";
import { Reactive } from "../types/__init__";
import { resolveReactive } from "../utils/__init__";
import {
    BuildContext,
    DataMutable,
    MutableWidget,
    Widget
} from "./framework";

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

    createMutable(): DataMutable<this> {
        return new TextMutable(this);
    }
}

class TextMutable<T extends Text> extends DataMutable<T> {
    constructor(widget: T) {
        super(widget);
    }

    build(context: BuildContext): Widget {
        throw new Error("Can't build leaf widget");
    }

    renderLeaf(context: BuildContext): HTMLElement {
        const span = document.createElement('span');

        this.effect(() => {
            const v = resolveReactive(this.widget.value);
            span.textContent = v!;
        });

        this.widget.style?.applyTo(span, (fn) => this.effect(fn));

        return span;
    }

}
