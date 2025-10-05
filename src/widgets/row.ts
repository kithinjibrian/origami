import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface RowParams {
    key?: string;
}

export class Row extends ImmutableWidget {
    constructor(
        private children: Widget[],
        { key }: RowParams = {}
    ) {
        super({ key });
    }

    build(context: BuildContext): Widget {
        return this;
    }

    render(context: BuildContext): HTMLElement {
        const widgetContext = new BuildContext(this, context);

        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'row';

        this.children.forEach(child => {
            div.appendChild(child.render(widgetContext));
        });

        return this.setElement(div);
    }
}