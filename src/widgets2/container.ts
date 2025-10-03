import { Color, EdgeInsets } from "../painting/__init__";
import { DataWidget, Widget } from "./framework";

interface ContainerParams {
    key?: string;
    margin?: EdgeInsets;
    padding?: EdgeInsets;
    color?: Color;
}

export class Container extends DataWidget {
    margin?: EdgeInsets;
    padding?: EdgeInsets;
    color?: Color;

    constructor(
        private child: Widget,
        {
            key,
            margin,
            padding,
            color,
        }: ContainerParams = {}
    ) {
        super({ key });
        this.margin = margin;
        this.padding = padding;
        this.color = color;
    }

    build(): Widget {
        return this;
    }

    render(): HTMLElement {
        const div = document.createElement('div');

        if (this.margin) {
            div.style.marginTop = `${this.margin.top || 0}px`;
            div.style.marginRight = `${this.margin.right || 0}px`;
            div.style.marginBottom = `${this.margin.bottom || 0}px`;
            div.style.marginLeft = `${this.margin.left || 0}px`;
        }

        if (this.padding) {
            div.style.paddingTop = `${this.padding.top || 0}px`;
            div.style.paddingRight = `${this.padding.right || 0}px`;
            div.style.paddingBottom = `${this.padding.bottom || 0}px`;
            div.style.paddingLeft = `${this.padding.left || 0}px`;
        }

        if (this.color) {
            div.style.backgroundColor = this.color.toString();
        }

        div.appendChild(this.child.render());

        return div;
    }
}