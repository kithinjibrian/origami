import { DataWidget, Widget } from "./framework";

export class Text extends DataWidget {
    constructor(private value: string | (() => string)) {
        super();
    }

    build(): Widget {
        return this;
    }

    render(): HTMLElement {
        const span = document.createElement('span');

        if (typeof this.value === "string") {
            span.textContent = this.value;
        } else {
            this.effect(() => {
                span.textContent = (this.value as () => string)();
            });
        }

        return span;
    }

    toString(): string {
        if (typeof this.value === "string") {
            return `Text("${this.value}")`;
        } else {
            return `Text("${(this.value as () => string)()}")`;
        }
    }
}
