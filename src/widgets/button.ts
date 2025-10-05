import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface ButtonParams {
    key?: string;
    onPressed?: () => void;
}

export class Button extends ImmutableWidget {
    private child: Widget;
    onPressed?: () => void;

    constructor(child: Widget, { onPressed, key }: ButtonParams = {}) {
        super({ key });
        this.child = child;
        this.onPressed = onPressed;
    }

    build(context: BuildContext): Widget {
        return this;
    }

    render(context: BuildContext): HTMLElement {
        const widgetContext = new BuildContext(this, context);

        const button = document.createElement('button');

        if (this.onPressed) {
            button.addEventListener('click', this.onPressed);
        }

        const childElement = this.child.render(widgetContext);
        button.appendChild(childElement);

        return this.setElement(button);
    }

    toString() {
        return `Button("${this.child}")`;
    }
}
