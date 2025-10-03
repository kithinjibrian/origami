import { DataWidget, Widget } from "./__init__";

interface RowParams {
    key?: string;
}

export class Row extends DataWidget {

    constructor(
        private children: Widget[],
        { key }: RowParams = {}
    ) {
        super({ key });
    }

    build(): Widget {
        return this;
    }

    render(): HTMLElement {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'row';

        this.children.forEach(child => {
            div.appendChild(child.render());
        });

        return div;
    }
}