import { DataWidget, Widget } from "./framework";

interface ButtonParams {
    key?: string;
    onPressed?: () => void;
}

export class Button extends DataWidget {
    onPressed?: () => void;

    constructor(
        private child: Widget,
        { onPressed, key }: ButtonParams = {}
    ) {
        super({ key });

        this.onPressed = onPressed;
    }

    build(): Widget {
        return this;
    }

    render(): HTMLElement {
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

        button.appendChild(this.child.render());

        return button;
    }

    toString() {
        return `Button("${this.child}")`;
    }
}