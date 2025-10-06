import {
    BuildContext,
    Mutable,
    MutableWidget,
    StateMutable,
    States,
    Widget,
    Widgets,
} from "../../../widgets/__init__";

interface RouterParams<
    S extends string,
    E extends Record<string, any>
> {
    key?: string;
    initialPage: S;
    pages: Widgets<S>
    navigationMap: States<S, E>
    init?: (context: BuildContext) => void
}

export class Router<
    S extends string,
    E extends Record<string, any>
> extends MutableWidget {
    initialPage: S;
    pages: Widgets<S>
    navigationMap: States<S, E>
    init?: (context: BuildContext) => void

    constructor({
        key,
        initialPage,
        pages,
        navigationMap,
        init,
    }: RouterParams<S, E>) {
        super({ key });

        this.initialPage = initialPage;
        this.pages = pages;
        this.navigationMap = navigationMap;
        this.init = init;
    }

    createMutable(): Mutable<this> {
        return new RouterMutable<this, S, E>(this, this.initialPage);
    }
}

class RouterMutable<
    T extends Router<any, any>,
    S extends string,
    E extends Record<string, any>
> extends StateMutable<T, S, E> {
    constructor(widget: T, init: S) {
        super(widget, { init: init });
    }

    init(): void {
        this.widget.init?.(this.context);
    }

    states() {
        return this.widget.navigationMap;
    }

    build(context: BuildContext) {
        return this.widget.pages;
    }
}