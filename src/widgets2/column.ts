import { DataWidget, Widget } from "./__init__";

interface ColumnParams {
    key?: string;
}

export class Column extends DataWidget {
    constructor(
        private children: Widget[],
        { key }: ColumnParams = {}
    ) {
        super({ key });
    }

    build(): Widget {
        return this;
    }

    render(): HTMLElement {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'column';

        this.children.forEach(child => {
            div.appendChild(child.render());
        });

        return div;
    }
}