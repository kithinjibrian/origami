import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface ButtonParams {
    key?: string;
    onPressed?: () => void;
}

export class Button extends ImmutableWidget {
    name = "Button";
    onPressed?: () => void;

    constructor(
        private child: Widget,
        { onPressed, key }: ButtonParams = {}
    ) {
        super({ key });
        this.child = child;
        this.onPressed = onPressed;
    }

    build(context: BuildContext): Widget {
        const child = this.child;
        const onPressed = this.onPressed;

        return new class extends Widget {
            name = "ButtonBody";

            render(ctx: BuildContext): Node {
                const el = document.createElement('button');

                if (onPressed) {
                    el.addEventListener('click', onPressed);
                }

                const childElement = child.render(ctx);
                el.appendChild(childElement);

                return this.setElement(el);
            }
        }({ key: `${this.key}_body` });
    }
}
