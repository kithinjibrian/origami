export interface Type<T = any> extends Function {
    new(...args: any[]): T;
}

const INJECTABLE_METADATA_KEY = Symbol('injectable');
const SERVICE_TOKENS = new Map<Type, symbol>();

export function Injectable<T>(target: Type<T>): Type<T> {
    Reflect.defineMetadata(INJECTABLE_METADATA_KEY, true, target);
    const token = Symbol(target.name);
    SERVICE_TOKENS.set(target, token);
    return target;
}

function getServiceToken<T>(type: Type<T>): symbol {
    const token = SERVICE_TOKENS.get(type);
    if (!token) {
        throw new Error(`Service '${type.name}' is not marked as @Injectable. Did you forget the decorator?`);
    }
    return token;
}

type Provider<T> = T | (() => T);

//
// RemovalWatcher: single global observer watching subtree removals.
// When a watched element is part of a removed node, its callback is invoked.
// This avoids creating a MutationObserver per widget and is easier to manage.
//
class RemovalWatcher {
    private static _instance: RemovalWatcher | null = null;
    static get instance(): RemovalWatcher {
        if (!this._instance) this._instance = new RemovalWatcher();
        return this._instance;
    }

    private watchers = new Map<HTMLElement, () => void>();
    private observer?: MutationObserver;

    private constructor() {
        if (typeof document === 'undefined') return;

        // Observe the whole document for removals
        const root = document.documentElement || document.body;
        try {
            this.observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of Array.from(m.removedNodes)) {
                        if (!(node instanceof HTMLElement)) continue;
                        // Iterate snapshot of watchers
                        for (const [el, cb] of Array.from(this.watchers.entries())) {
                            if (node === el || node.contains(el)) {
                                try {
                                    cb();
                                } catch (err) {
                                    console.error('RemovalWatcher callback error:', err);
                                }
                                // remove watcher after it's triggered
                                this.watchers.delete(el);
                            }
                        }
                    }
                }
            });

            this.observer.observe(root, { childList: true, subtree: true });
        } catch (err) {
            // In unusual environments observer may fail; degrade gracefully.
            console.warn('RemovalWatcher: unable to create MutationObserver:', err);
            this.observer = undefined;
        }
    }

    watch(el: HTMLElement, cb: () => void) {
        this.watchers.set(el, cb);
    }

    unwatch(el: HTMLElement) {
        this.watchers.delete(el);
    }

    disconnect() {
        this.observer?.disconnect();
        this.watchers.clear();
    }
}

export class BuildContext {
    private _providers = new Map<symbol, Provider<any>>();
    private _disposables = new Set<() => void>();
    private _children = new Set<BuildContext>();
    private _disposed = false;

    constructor(
        private widget: Widget,
        private parent?: BuildContext
    ) {
        if (this.parent) {
            // register this context with the parent so parent.dispose cascades
            this.parent.registerChild(this);
        }
    }

    private registerChild(child: BuildContext) {
        if (!this._children.has(child)) {
            this._children.add(child);
            this.addDisposable(() => {
                try {
                    child.dispose();
                } catch (err) {
                    console.error('Error disposing child context:', err);
                }
                this._children.delete(child);
            });
        }
    }

    provide<T>(type: Type<T>, provider: Provider<T>): void {
        if (this._disposed) throw new Error('Cannot provide on a disposed context');
        if (!type) throw new Error('Service type cannot be null or undefined');
        if (provider === null || provider === undefined) {
            throw new Error(`Provider for ${type.name} cannot be null or undefined`);
        }

        const token = getServiceToken(type);
        this._providers.set(token, provider);
    }

    read<T>(type: Type<T>): T {
        if (this._disposed) throw new Error('Cannot read from a disposed context');
        const token = getServiceToken(type);
        const provider = this._providers.get(token);

        if (provider !== undefined) {
            return typeof provider === 'function' ? (provider as () => T)() : (provider as T);
        }

        if (this.parent) {
            return this.parent.read(type);
        }

        throw new Error(`${type.name} is not provided in this context or any parent context`);
    }

    addDisposable(dispose: () => void): void {
        if (this._disposed) {
            try { dispose(); } catch (err) { console.error('Error running immediate disposable:', err); }
            return;
        }
        this._disposables.add(dispose);
    }

    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;

        for (const dispose of Array.from(this._disposables)) {
            try {
                dispose();
            } catch (error) {
                console.error('Error during context disposal:', error);
            }
        }

        this._disposables.clear();

        for (const child of Array.from(this._children)) {
            try {
                child.dispose();
            } catch (err) {
                console.error('Error disposing child context in dispose():', err);
            }
        }
        this._children.clear();

        this._providers.clear();
        this.parent = undefined;
    }
}

export interface WidgetParams {
    key?: string;
}

export abstract class Widget {
    key: string;
    protected _element?: HTMLElement;
    protected _context?: BuildContext;
    protected _disposed = false;

    constructor({ key }: WidgetParams = {}) {
        this.key =
            key ??
            `${this.constructor.name}_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2, 5)}`;
    }

    abstract render(context?: BuildContext): HTMLElement;

    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;

        console.log(this._element);

        // Remove DOM element if present
        try {
            if (this._element && this._element.parentNode) {
                // detach element from DOM
                //  this._element.remove();
            }
        } catch (err) {
            console.error('Error removing widget element during dispose:', err);
        }

        // Unregister element from removal watcher to avoid callbacks after dispose
        // try {
        //     if (this._element) {
        //         RemovalWatcher.instance.unwatch(this._element);
        //     }
        // } catch (err) {
        //     // ignore
        // }

        // Dispose context (which will run all context disposables)
        // try {
        //     if (this._context) {
        //         this._context.dispose();
        //         this._context = undefined;
        //     }
        // } catch (err) {
        //     console.error('Error disposing widget context:', err);
        // }

        // this._element = undefined;
    }

    /**
     * Centralized element setter — sets data-key and registers the element
     * with the global removal watcher so the framework can auto-dispose
     * widgets removed from the DOM.
     */
    protected setElement(element: HTMLElement): HTMLElement {
        this._element = element;
        try {
            element.setAttribute('data-key', this.key);
        } catch (err) {
            // in some test environments setAttribute may fail; ignore
        }

        // register removal callback
        if (typeof document !== 'undefined') {
            const onRemoved = () => {
                if (!this._disposed) {
                    try {
                        this.dispose();
                    } catch (e) {
                        console.error('Error disposing widget on DOM removal:', e);
                    }
                }
            };

            try {
                RemovalWatcher.instance.watch(element, onRemoved);
            } catch (err) {
                console.warn('Failed to register element with RemovalWatcher:', err);
            }
        }

        return element;
    }
}

export abstract class ImmutableWidget extends Widget {
    private _childWidget?: Widget;

    constructor(params: WidgetParams = {}) {
        super(params);
    }

    abstract build(context: BuildContext): Widget;

    render(context?: BuildContext): HTMLElement {
        const widgetContext = new BuildContext(this, context);
        this._context = widgetContext;

        try {
            if (this._childWidget) {
                this._childWidget.dispose();
            }

            this._childWidget = this.build(widgetContext);
            const element = this._childWidget.render(widgetContext);
            return this.setElement(element);
        } catch (e) {
            console.error('Error rendering ImmutableWidget:', e);
            throw new Error("Error rendering widgets");
        }
    }

    dispose(): void {
        console.log("disposing");

        if (this._childWidget) {
            try {
                this._childWidget.dispose();
            } catch (err) {
                console.error('Error disposing child widget in ImmutableWidget.dispose():', err);
            }
            this._childWidget = undefined;
        }

        super.dispose();
    }
}

export abstract class MutableWidget extends Widget {
    private _mutable?: Mutable<this>;

    constructor(params: WidgetParams = {}) {
        super(params);
    }

    abstract createMutable(): Mutable<this>;

    render(context?: BuildContext, changed: boolean = false): HTMLElement {
        const widgetContext = new BuildContext(this, context);
        this._context = widgetContext;

        if (this._mutable == null) {
            this._mutable = this.createMutable();
            this._mutable.context = widgetContext;
            this._mutable.init();
        } else {
            this._mutable.context = widgetContext;
        }

        try {
            const widget = this._mutable.build(widgetContext);

            if (widget instanceof Widget) {
                const element = widget.render(widgetContext);

                if (changed && this._element?.parentNode) {
                    this._element.parentNode.replaceChild(element, this._element);
                }

                return this.setElement(element);
            } else {
                const element = (this._mutable as StateMutable<any, any, any>).render(widgetContext, widget);

                if (element instanceof HTMLElement) {
                    element.setAttribute('data-key', this.key);

                    if (changed && this._element?.parentNode) {
                        this._element.parentNode.replaceChild(element, this._element);
                    }
                }

                return this.setElement(element as HTMLElement);
            }
        } catch (e) {
            if ('renderLeaf' in this._mutable) {
                const element = (this._mutable as any).renderLeaf(widgetContext);
                return this.setElement(element);
            }
            console.error('Error rendering MutableWidget:', e);
            throw new Error("Error rendering widgets");
        }
    }

    dispose(): void {
        if (this._mutable) {
            try {
                this._mutable.dispose();
            } catch (err) {
                console.error('Error disposing Mutable._mutable:', err);
            }
            this._mutable = undefined;
        }
        super.dispose();
    }
}

export abstract class Mutable<T extends MutableWidget> {
    context!: BuildContext;

    constructor(public widget: T) { }

    build(context: BuildContext): any { }
    init() { }
    dispose() { }
}

let subscriber: (() => void) | null = null;

export interface Signal<T> {
    get value(): T;
    set value(updated: T);
    dispose(): void;
}

export abstract class ReactiveWidget<T extends MutableWidget> extends Mutable<T> {
    private _signals = new Set<Signal<any>>();
    private _effects = new Set<() => void>();

    signal<V>(value: V): Signal<V> {
        const subscriptions = new Set<() => void>();

        const sig: Signal<V> = {
            get value() {
                if (subscriber !== null) {
                    subscriptions.add(subscriber);
                }
                return value;
            },
            set value(updated: V) {
                value = updated;
                subscriptions.forEach(fn => {
                    try {
                        fn();
                    } catch (error) {
                        console.error('Error in signal subscription:', error);
                    }
                });
            },
            dispose() {
                subscriptions.clear();
            }
        };

        this._signals.add(sig);

        this.context?.addDisposable(() => sig.dispose());

        return sig;
    }

    effect(fn: () => void): () => void {
        const cleanup = () => {
            this._effects.delete(fn);
        };

        this._effects.add(fn);

        subscriber = fn;
        try {
            fn();
        } catch (error) {
            console.error('Error in effect:', error);
        } finally {
            subscriber = null;
        }

        this.context?.addDisposable(cleanup);

        return cleanup;
    }

    dispose(): void {
        this._signals.forEach(signal => signal.dispose());
        this._signals.clear();

        this._effects.clear();

        super.dispose();
    }
}

export abstract class DataMutable<T extends MutableWidget> extends ReactiveWidget<T> {
    abstract build(context: BuildContext): Widget;
}

export interface StateMutableParams<S extends string> {
    init?: S;
}

export type TransitionFunction<S extends string> = () => S | Promise<S>;

export type TransitionStates<S extends string, E extends string> =
    | Partial<Record<E, S | ((args: { payload: any }) => S)>>
    | TransitionFunction<S>;

export type States<S extends string, E extends string> = { [K in S]: TransitionStates<S, E> };

export type Widgets<S extends string> = Partial<
    Record<string, (args: { state: S }) => Widget | null>
>;

export abstract class StateMutable<
    T extends MutableWidget,
    S extends string,
    E extends string
> extends ReactiveWidget<T> {
    state: S;
    listeners: Record<E, Array<any>> = {} as Record<E, Array<any>>;

    constructor(public widget: T, { init }: StateMutableParams<S> = {}) {
        super(widget);

        const stateKeys = Object.keys(
            (() => {
                try {
                    return (this as any).states();
                } catch {
                    return {};
                }
            })()
        );

        this.state = init ?? (stateKeys[0] as S);
    }

    abstract states(): States<S, E>;
    abstract build(context: BuildContext): Widgets<S>;

    public subscribe(states: Partial<Record<E, any>>): this {
        for (let key in states) {
            if (this.listeners[key as E]) {
                this.listeners[key as E].push(states[key as E]);
            } else {
                this.listeners[key as E] = [states[key as E]];
            }
        }

        return this;
    }

    public send(event: E, payload?: any): void {
        const states = this.states();
        const handler = states[this.state];

        if (!handler) return;

        try {
            if (typeof handler === 'function') {
                const result = (handler as TransitionFunction<S>)();
                this.resolveTransition(result, payload);
            } else if (typeof handler === 'object') {
                const stateMap = handler as Partial<
                    Record<E, S | ((args: { payload: string }) => S)>
                >;
                if (stateMap[event] !== undefined) {
                    this.resolveTransition(stateMap[event]!, payload);
                }
            }

            if (this.listeners[event]) {
                this.listeners[event].forEach(cb => {
                    try {
                        cb();
                    } catch (error) {
                        console.error('Error in event listener:', error);
                    }
                });
            }
        } catch (error) {
            console.error(
                `Error handling event "${String(event)}" in state "${String(this.state)}":`,
                error
            );
        }
    }

    private resolveTransition(
        result: S | Promise<S> | ((args: { payload: string }) => S),
        payload: any
    ): void {
        if (result instanceof Promise) {
            result
                .then(next => this.applyTransition(next))
                .catch(error => console.error(`Async transition failed:`, error));
            return;
        }

        if (typeof result === 'function') {
            try {
                const fnResult = (result as (args: { payload: string }) => S)({ payload });
                this.applyTransition(fnResult);
            } catch (error) {
                console.error('Transition function threw an error:', error);
            }
            return;
        }

        this.applyTransition(result as S);
    }

    private applyTransition(next: S): void {
        if (!next || this.state === next) {
            return;
        }

        this.state = next;
        this.widget.render(this.context, true);
    }

    private async autoStep(maxSteps = 10): Promise<void> {
        let steps = 0;
        while (steps < maxSteps) {
            const handler = this.states()[this.state];
            if (typeof handler === 'function') {
                try {
                    const maybeResult = (handler as TransitionFunction<S>)();
                    const next = maybeResult instanceof Promise ? await maybeResult : maybeResult;

                    if (typeof next === 'function') {
                        try {
                            const fnResult = (next as any)();
                            if (fnResult instanceof Promise) {
                                const r = await fnResult;
                                if (r && r !== this.state) {
                                    this.applyTransition(r as S);
                                    steps++;
                                    continue;
                                } else {
                                    break;
                                }
                            } else if (fnResult && fnResult !== this.state) {
                                this.applyTransition(fnResult as S);
                                steps++;
                                continue;
                            } else {
                                break;
                            }
                        } catch (err) {
                            console.error(`Auto-step function transition failed:`, err);
                            break;
                        }
                    }

                    if (next && next !== this.state) {
                        this.applyTransition(next as S);
                        steps++;
                        continue;
                    }
                } catch (error) {
                    console.error(`Auto-step failed in state "${this.state}":`, error);
                    break;
                }
            }
            break;
        }

        if (steps >= maxSteps) {
            console.warn(`Auto-step reached max steps (${maxSteps}) - possible infinite loop`);
        }
    }

    private findWidget(
        widgets: Widgets<S>,
        state: S
    ): [((args: { state: S }) => Widget | null) | undefined, S | undefined] {
        if (widgets[state]) {
            return [widgets[state], state];
        }

        // pattern like "a|b|c"
        for (const pattern in widgets) {
            if (pattern.includes('|')) {
                const states = pattern.split('|').map(s => s.trim());
                if (states.includes(state)) {
                    return [widgets[pattern], state];
                }
            }
        }

        // wildcard prefix "prefix.*"
        for (const pattern in widgets) {
            if (pattern.endsWith('.*')) {
                const prefix = pattern.slice(0, -2);
                if (state.startsWith(prefix)) {
                    return [widgets[pattern], state];
                }
            }
        }

        // regex style "/regex/"
        for (const pattern in widgets) {
            if (pattern.startsWith('/') && pattern.endsWith('/')) {
                try {
                    const regex = new RegExp(pattern.slice(1, -1));
                    if (regex.test(state)) {
                        return [widgets[pattern], state];
                    }
                } catch (err) {
                    console.warn(`Invalid widget regex pattern "${pattern}":`, err);
                }
            }
        }

        if (widgets['*']) {
            return [widgets['*'], state];
        }

        return [undefined, undefined];
    }

    render(context: BuildContext, widgets: Widgets<S>): HTMLElement {
        try {
            const [widgetFactory, state] = this.findWidget(widgets, this.state);

            if (state) this.state = state;

            if (!widgetFactory) {
                throw new Error(`No widget defined for state "${this.state}"`);
            }

            const widget = widgetFactory({ state: this.state });

            if (!widget) {
                throw new Error(`Widget factory returned null for state "${this.state}"`);
            }

            const element = widget.render(context);

            this.autoStep();

            return element;
        } catch (e) {
            console.error('Error rendering StateMutable:', e);
            throw e;
        }
    }

    dispose(): void {
        for (const key in this.listeners) {
            this.listeners[key] = [];
        }

        super.dispose();
    }
}
