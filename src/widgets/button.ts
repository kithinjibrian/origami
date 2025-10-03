import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface ButtonParams {
    key?: string;
    onPressed?: () => void;
}

export class Button extends ImmutableWidget {
    private child: Widget;
    onPressed?: () => void;
    private childContext?: BuildContext;

    constructor(child: Widget, { onPressed, key }: ButtonParams = {}) {
        super({ key });
        this.child = child;
        this.onPressed = onPressed;
    }

    build(context: BuildContext): Widget {
        return this;
    }

    render(context: BuildContext): HTMLElement {
        if (this.childContext) {
            this.childContext.dispose();
        }

        this.childContext = new BuildContext(this, context);
        context.addDisposable(() => this.childContext);

        const button = document.createElement('button');
        button.style.padding = '8px 16px';
        button.style.border = '1px solid #ccc';
        button.style.borderRadius = '4px';
        button.style.backgroundColor = '#f0f0f0';
        button.style.cursor = 'pointer';

        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#e0e0e0';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#f0f0f0';
        });

        if (this.onPressed) {
            button.addEventListener('click', this.onPressed);
        }

        const childElement = this.child.render(this.childContext);
        button.appendChild(childElement);

        return this.setElement(button);
    }

    dispose(): void {
        console.log("disposing");

        super.dispose();
        if (this.childContext) {
            this.childContext.dispose();
        }
        this.child.dispose();
    }

    toString() {
        return `Button("${this.child}")`;
    }
}
