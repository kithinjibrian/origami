import {
    BuildContext,
    DataMutable,
    Mutable,
    MutableWidget,
    Widget
} from "./framework";

export class Text extends MutableWidget {
    constructor(public value: string | (() => string)) {
        super();
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

        if (typeof this.widget.value === "string") {
            span.textContent = this.widget.value;
        } else {
            this.effect(() => {
                span.textContent = (this.widget.value as () => string)();
            });
        }

        return span;
    }
}
