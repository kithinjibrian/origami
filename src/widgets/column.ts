import { BuildContext, ImmutableWidget, Widget } from "./framework";

interface ColumnParams {
    key?: string;
}

export class Column extends ImmutableWidget {
    private childContext?: BuildContext;

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
        if (this.childContext) {
            this.childContext.dispose();
        }

        this.childContext = new BuildContext(this, context);
        context.addDisposable(() => this.childContext);

        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'column';

        this.children.forEach(child => {
            div.appendChild(child.render(this.childContext));
        });

        return this.setElement(div);
    }

    dispose(): void {
        super.dispose();
        if (this.childContext) {
            this.childContext.dispose();
        }

        this.children.forEach(ch => ch.dispose())
    }
}