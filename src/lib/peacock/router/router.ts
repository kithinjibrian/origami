import {
    BuildContext,
    Mutable,
    MutableWidget,
    StateMutable,
    States,
    Widget,
    Widgets
} from "../../../widgets/__init__";

interface RouterParams<
    P extends string,
    E extends string,
    Payloads extends Partial<Record<E, unknown>> = Record<E, never>
> {
    key?: string;
    initialPage: P;
    pages: Record<P, (args: { state: P }) => Widget>
    navigationMap: States<P, E, Payloads>
    init?: (context: BuildContext) => void
}

export class Router<
    P extends string,
    E extends string,
    Payloads extends Partial<Record<E, unknown>> = Record<E, never>
> extends MutableWidget {
    initialPage: P;
    pages: Record<P, (args: { state: P }) => Widget>;
    navigationMap: States<P, E, Payloads>;
    init?: (context: BuildContext) => void;

    constructor({
        key,
        initialPage,
        pages,
        navigationMap,
        init,
    }: RouterParams<P, E, Payloads>) {
        super({ key });

        this.initialPage = initialPage;
        this.pages = pages;
        this.navigationMap = navigationMap;
        this.init = init;
    }

    createMutable(): Mutable<this> {
        return new RouterMutable<this, P, E>(this);
    }
}

class RouterMutable<
    T extends Router<any, any>,
    P extends string,
    E extends string,
> extends StateMutable<T, P, E> {
    constructor(widget: T) {
        super(widget);
    }

    init(): void {
        this.widget.init?.(this.context);
    }

    states() {
        return this.widget.navigationMap;
    }

    build(context: BuildContext): Widgets<P> {
        return this.widget.pages;
    }
}