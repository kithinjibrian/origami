import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface ColumnParams {
    key?: string;
}

export class Column extends ImmutableWidget {
    constructor(
        private children: Widget[],
        { key }: ColumnParams = {}
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
        div.style.flexDirection = 'column';

        this.children.forEach(child => {
            div.appendChild(child.render(widgetContext));
        });

        return this.setElement(div);
    }
}