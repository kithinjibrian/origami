export enum MainAxisAlignment {
    start,
    center,
    end,
    spaceBetween,
    spaceAround,
    spaceEvenly
}

export enum CrossAxisAlignment {
    start,
    end,
    center,
    stretch,
    baseline
}

export enum MainAxisSize {
    min,
    max
}

export enum FlexFit {
    tight,
    loose,
}

export namespace FlexAlign {
    export function applyMainAxisAlignment(
        element: HTMLElement,
        alignment: MainAxisAlignment
    ): void {
        switch (alignment) {
            case MainAxisAlignment.start:
                element.style.justifyContent = "flex-start";
                break;
            case MainAxisAlignment.center:
                element.style.justifyContent = "center";
                break;
            case MainAxisAlignment.end:
                element.style.justifyContent = "flex-end";
                break;
            case MainAxisAlignment.spaceBetween:
                element.style.justifyContent = "space-between";
                break;
            case MainAxisAlignment.spaceAround:
                element.style.justifyContent = "space-around";
                break;
            case MainAxisAlignment.spaceEvenly:
                element.style.justifyContent = "space-evenly";
                break;
        }
    }

    export function applyCrossAxisAlignment(
        element: HTMLElement,
        alignment: CrossAxisAlignment
    ): void {
        switch (alignment) {
            case CrossAxisAlignment.start:
                element.style.alignItems = "flex-start";
                break;
            case CrossAxisAlignment.end:
                element.style.alignItems = "flex-end";
                break;
            case CrossAxisAlignment.center:
                element.style.alignItems = "center";
                break;
            case CrossAxisAlignment.stretch:
                element.style.alignItems = "stretch";
                break;
            case CrossAxisAlignment.baseline:
                element.style.alignItems = "baseline";
                break;
        }
    }

    export function applyMainAxisSize(
        element: HTMLElement,
        axisSize: MainAxisSize,
        direction: "column" | "row"
    ): void {
        if (direction === "column") {
            switch (axisSize) {
                case MainAxisSize.min:
                    element.style.height = "auto";
                    break;
                case MainAxisSize.max:
                    element.style.height = "100%";
                    break;
            }
        } else if (direction === "row") {
            switch (axisSize) {
                case MainAxisSize.min:
                    element.style.width = "auto";
                    break;
                case MainAxisSize.max:
                    element.style.width = "100%";
                    break;
            }
        }
    }
}
