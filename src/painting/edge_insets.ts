export interface EdgeInsetsParams {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export class EdgeInsets {
    left: number = 0;
    top: number = 0;
    right: number = 0;
    bottom: number = 0;

    constructor({
        left,
        top,
        right,
        bottom
    }: EdgeInsetsParams) {
        this.left = left;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
    }

    static fromLTRB(
        left: number,
        top: number,
        right: number,
        bottom: number,
    ): EdgeInsets {
        return new EdgeInsets({
            left,
            top,
            right,
            bottom,
        });
    }

    static all(value: number): EdgeInsets {
        return new EdgeInsets({
            left: value,
            top: value,
            right: value,
            bottom: value,
        });
    }

    static only({
        left,
        top,
        right,
        bottom
    }: Partial<EdgeInsetsParams>): EdgeInsets {
        return new EdgeInsets({
            left: left ?? 0,
            top: top ?? 0,
            right: right ?? 0,
            bottom: bottom ?? 0,
        });
    }

    static symmetric({
        horizontal,
        vertical,
    }: {
        horizontal?: number,
        vertical?: number,
    }): EdgeInsets {
        return new EdgeInsets({
            left: horizontal ?? 0,
            top: vertical ?? 0,
            right: horizontal ?? 0,
            bottom: vertical ?? 0,
        });
    }

    toString() {
        return `${this.top}px ${this.right}px ${this.bottom}px ${this.left}px`
    }
}

export namespace EdgeInsets {
    export function applyEdgeInset(
        element: HTMLElement,
        edge: EdgeInsets | undefined,
        property: "margin" | "padding"
    ): void {
        if (edge) {
            if (property === "margin") {
                element.style.margin = edge.toString();
            } else if (property === "padding") {
                element.style.margin = edge.toString();
            }
        }

    }
}