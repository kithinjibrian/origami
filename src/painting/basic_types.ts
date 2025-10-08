export enum VerticalDirection {
    up,
    down,
}

export namespace BasicTypes {
    export function applyVerticalDirection(
        element: HTMLElement,
        direction: VerticalDirection,
    ): void {
        switch (direction) {
            case VerticalDirection.down:
                element.style.flexDirection = "column";
                break;
            case VerticalDirection.up:
                element.style.flexDirection = "column-reverse";
                break;
        }
    }
}