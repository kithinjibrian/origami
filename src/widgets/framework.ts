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

class RemovalWatcher {
    private static _instance: RemovalWatcher | null = null;
    static get instance(): RemovalWatcher {
        if (!this._instance) this._instance = new RemovalWatcher();
        return this._instance;
    }

    private watchers = new Map<HTMLElement, Set<() => void>>();
    private observer?: MutationObserver;

    private constructor() {
        if (typeof document === 'undefined') return;

        const root = document.documentElement || document.body;
        try {
            this.observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of Array.from(m.removedNodes)) {
                        if (!(node instanceof HTMLElement)) continue;

                        for (const [el, callbacks] of Array.from(this.watchers.entries())) {
                            if (node === el || node.contains(el)) {
                                callbacks.forEach(cb => {
                                    try {
                                        cb();
                                    } catch (err) {
                                        console.error('RemovalWatcher callback error:', err);
                                    }
                                });
                                this.watchers.delete(el);
                            }
                        }
                    }
                }
            });

            this.observer.observe(root, { childList: true, subtree: true });
        } catch (err) {
            console.warn('RemovalWatcher: unable to create MutationObserver:', err);
            this.observer = undefined;
        }
    }

    watch(el: HTMLElement, cb: () => void) {
        if (!this.watchers.has(el)) {
            this.watchers.set(el, new Set());
        }
        this.watchers.get(el)!.add(cb);
    }

    unwatch(el: HTMLElement, cb?: () => void) {
        if (!cb) {
            this.watchers.delete(el);
            return;
        }
        const callbacks = this.watchers.get(el);
        if (callbacks) {
            callbacks.delete(cb);
            if (callbacks.size === 0) {
                this.watchers.delete(el);
            }
        }
    }

    disconnect() {
        this.observer?.disconnect();
        this.watchers.clear();
    }
}

type Provider<T> = T | (() => T);

export class BuildContext {
    private _providers = new Map<symbol, Provider<any>>();
    private _inheritedWidgets = new Map<Type, InheritedWidget>();
    private _disposed = false;
    private _children: BuildContext[] = [];

    constructor(
        public widget: Widget,
        public parent?: BuildContext
    ) {
        parent?._children.push(this);

        if (parent) {
            this._inheritedWidgets = new Map(parent._inheritedWidgets);
        }

        if (widget instanceof InheritedWidget) {
            const widgetType = widget.constructor as Type<InheritedWidget>;

            const existingWidget = this._inheritedWidgets.get(widgetType);
            if (!existingWidget || widget.updateShouldNotify(existingWidget)) {
                this._inheritedWidgets.set(widgetType, widget);
            }
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

    dependOnInheritedWidgetOfExactType<T extends InheritedWidget>(type: Type<T>): T | null {
        const inheritedWidget = this._inheritedWidgets.get(type);

        if (inheritedWidget) {
            return inheritedWidget as T;
        }

        if (this.parent) {
            return this.parent.dependOnInheritedWidgetOfExactType(type);
        }

        return null;
    }

    dependOnInheritedWidgetOfExactTypeRequired<T extends InheritedWidget>(type: Type<T>): T {
        const widget = this.dependOnInheritedWidgetOfExactType(type);
        if (!widget) {
            throw new Error(`No ${type.name} found in widget tree. Make sure to wrap your widget with ${type.name}.`);
        }
        return widget;
    }

    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;

        // Dispose all children first
        this._children.forEach(child => child.dispose());
        this._children = [];

        // Clear providers
        this._providers.clear();

        // Remove from parent
        if (this.parent) {
            const idx = this.parent._children.indexOf(this);
            if (idx !== -1) {
                this.parent._children.splice(idx, 1);
            }
        }
    }
}

export interface WidgetParams {
    key?: string;
}

export abstract class Widget {
    key: string;
    public elements: Array<HTMLElement> = [];
    protected _context?: BuildContext;
    protected _disposed = false;
    protected _onRemoveCallback?: () => void;
    abstract name: string;

    constructor({ key }: WidgetParams = {}) {
        this.key =
            key ??
            `${this.constructor.name}_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2, 5)}`;
    }

    abstract render(context?: BuildContext): HTMLElement;

    protected setElement(element: HTMLElement): HTMLElement {
        this.elements.push(element);
        try {
            element.setAttribute('data-key', this.key);
        } catch (err) { }

        if (typeof document !== 'undefined') {
            this._onRemoveCallback = () => {
                if (!this._disposed) {
                    try {
                        this.dispose();
                    } catch (e) {
                        console.error('Error disposing widget on DOM removal:', e);
                    }
                }
            };

            try {
                RemovalWatcher.instance.watch(element, this._onRemoveCallback);
            } catch (err) {
                console.warn('Failed to register element with RemovalWatcher:', err);
            }
        }

        return element;
    }

    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;

        // Clean up RemovalWatcher
        if (this._onRemoveCallback) {
            this.elements.forEach(el => {
                RemovalWatcher.instance.unwatch(el, this._onRemoveCallback);
            });
        }

        // Dispose context
        if (this._context) {
            this._context.dispose();
            this._context = undefined;
        }

        this.elements = [];
    }
}

export abstract class ImmutableWidget extends Widget {
    name: string = "ImmutableWidget";

    constructor(params: WidgetParams = {}) {
        super(params);
    }

    abstract build(context: BuildContext): Widget;

    render(context?: BuildContext): HTMLElement {
        const widgetContext = new BuildContext(this, context);
        this._context = widgetContext;

        try {
            const element = this.build(widgetContext).render(widgetContext);
            return this.setElement(element);
        } catch (e) {
            console.error('Error rendering ImmutableWidget:', e);
            throw new Error("Error rendering widgets");
        }
    }

    dispose(): void {
        super.dispose();
    }
}

export abstract class MutableWidget extends Widget {
    name: string = "MutableWidget";

    public mutable?: Mutable<this>;

    constructor(params: WidgetParams = {}) {
        super(params);
    }

    abstract createMutable(): Mutable<this>;

    render(context?: BuildContext, changed: boolean = false): HTMLElement {
        const widgetContext = new BuildContext(this, context);
        this._context = widgetContext;

        if (this.mutable == null) {
            this.mutable = this.createMutable();
            this.mutable.context = widgetContext;
            this.mutable.init();
        } else {
            this.mutable.context = widgetContext;
        }

        try {
            const widget = this.mutable.build(widgetContext);

            if (widget instanceof Widget) {
                const element = widget.render(widgetContext);

                // If changed, replace the old element
                if (changed && this.elements.length > 0) {
                    const oldElement = this.elements[this.elements.length - 1];
                    oldElement.replaceWith(element);
                    this.elements[this.elements.length - 1] = element;
                    return element;
                }

                return this.setElement(element);
            } else {
                const element = (this.mutable as StateMutable<any, any, any, any>).render(widgetContext, widget);

                if (element instanceof HTMLElement) {
                    element.setAttribute('data-key', this.key);

                    // If changed, replace the old element in the DOM
                    if (changed && this.elements.length > 0) {
                        const oldElement = this.elements[this.elements.length - 1];
                        if (oldElement.parentNode) {
                            oldElement.parentNode.replaceChild(element, oldElement);
                        }
                        // Update the elements array
                        this.elements[this.elements.length - 1] = element;

                        // Re-register with RemovalWatcher
                        if (this._onRemoveCallback) {
                            RemovalWatcher.instance.unwatch(oldElement, this._onRemoveCallback);
                            RemovalWatcher.instance.watch(element, this._onRemoveCallback);
                        }

                        return element;
                    }
                }

                return this.setElement(element as HTMLElement);
            }
        } catch (e) {
            if ('renderLeaf' in this.mutable) {
                const element = (this.mutable as any).renderLeaf(widgetContext);
                return this.setElement(element);
            }
            console.error('Error rendering MutableWidget:', e);
            throw new Error("Error rendering widgets");
        }
    }

    dispose(): void {
        if (this.mutable) {
            this.mutable.dispose();
            this.mutable = undefined;
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
}

export abstract class ReactiveWidget<T extends MutableWidget> extends Mutable<T> {
    private _signals = new Set<Signal<any>>();
    private _cleanupFns = new Set<() => void>();

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
            }
        };

        this._signals.add(sig);
        return sig;
    }

    effect(fn: () => void): () => void {
        const cleanup = () => {
            this._cleanupFns.delete(cleanup);
        };

        this._cleanupFns.add(cleanup);

        subscriber = fn;
        try {
            fn();
        } catch (error) {
            console.error('Error in effect:', error);
        } finally {
            subscriber = null;
        }

        return cleanup;
    }

    dispose(): void {
        // Clean up all effects
        this._cleanupFns.forEach(cleanup => {
            try {
                cleanup();
            } catch (err) {
                console.error('Error during effect cleanup:', err);
            }
        });
        this._cleanupFns.clear();
        this._signals.clear();

        super.dispose();
    }
}

export abstract class DataMutable<T extends MutableWidget> extends ReactiveWidget<T> {
    abstract build(context: BuildContext): Widget;
}

export interface StateMutableParams<S extends string> {
    init?: S;
}

// Type-safe state machine types
export type FunctionArgs<P> = {
    payload: P
}

export type TransitionFunction<S extends string> = () => S | Promise<S>;

export type TransitionFunction2<S extends string> = (
    next: (args?: any) => S | Promise<S>,
    args?: any
) => S | Promise<S>;

export type PayloadTransitionFn<S extends string, P> = (args: FunctionArgs<P>) => S | Promise<S>;

export type MiddlewareTransitionFn<S extends string, P> = (
    args: FunctionArgs<P>,
    next: (args: FunctionArgs<P>) => S | Promise<S>
) => S | Promise<S>;

export type EventBasedTransitions<
    S extends string,
    E extends string,
    Payloads extends Partial<Record<E, unknown>>
> = {
        [K in E]?:
        | S
        | (K extends keyof Payloads
            ? PayloadTransitionFn<S, Payloads[K]>
            : PayloadTransitionFn<S, undefined>)
        | ReadonlyArray<
            K extends keyof Payloads
            ? MiddlewareTransitionFn<S, Payloads[K]>
            : MiddlewareTransitionFn<S, undefined>
        >;
    };

export type TransitionStates<
    S extends string,
    E extends string = string,
    Payloads extends Partial<Record<E, unknown>> = Record<E, never>
> =
    | EventBasedTransitions<S, E, Payloads>
    | TransitionFunction<S>
    | ReadonlyArray<TransitionFunction2<S>>;

export type States<
    S extends string,
    E extends string,
    Payloads extends Partial<Record<E, unknown>> = Record<E, never>
> = {
        [K in S]: TransitionStates<S, E, Payloads>;
    };

export type Widgets<S extends string> = Partial<
    Record<string, (args: { state: S }) => Widget>
>;

export abstract class StateMutable<
    T extends MutableWidget,
    S extends string,
    E extends string,
    Payloads extends Partial<Record<E, unknown>> = Record<E, never>
> extends ReactiveWidget<T> {
    state: S;
    listeners: Partial<Record<E, Array<() => void>>> = {};
    private _rendering = false;
    private _pendingState?: S;

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

    abstract states(): States<S, E, Payloads>;
    abstract build(context: BuildContext): Widgets<S>;

    public subscribe(callbacks: Partial<Record<E, () => void>>): this {
        for (const key in callbacks) {
            const event = key as E;
            const callback = callbacks[event];
            if (callback) {
                if (!this.listeners[event]) {
                    this.listeners[event] = [];
                }
                this.listeners[event]!.push(callback);
            }
        }
        return this;
    }

    public send<K extends E>(
        event: K,
        ...args: K extends keyof Payloads
            ? Payloads[K] extends never
            ? []
            : [payload: Payloads[K]]
            : []
    ): void {
        const payload = args[0];
        const states = this.states();
        const handler = states[this.state];

        if (!handler) return;

        try {
            if (typeof handler === 'function') {
                const result = (handler as TransitionFunction<S>)();
                this.resolveTransition(result, payload);
            } else if (Array.isArray(handler)) {
                this.resolveMiddlewareChain(handler as ReadonlyArray<TransitionFunction2<S>>);
            } else if (typeof handler === 'object') {
                const eventHandler = (handler as EventBasedTransitions<S, E, Payloads>)[event];
                if (eventHandler !== undefined) {
                    this.resolveTransition(eventHandler, payload);
                }
            }

            // Trigger listeners
            const eventListeners = this.listeners[event];
            if (eventListeners) {
                eventListeners.forEach(cb => {
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

    private resolveMiddlewareChain(
        middleware: ReadonlyArray<TransitionFunction2<S>>,
    ): void {
        let index = 0;
        const next = (args?: any) => {
            if (index >= middleware.length) {
                return this.state;
            }
            const fn = middleware[index++];
            const result = fn(next, args);
            return result;
        };

        const result = next(undefined);
        this.resolveTransition(result, undefined);
    }

    private resolveTransition(
        result: S | Promise<S> | PayloadTransitionFn<S, any> | ReadonlyArray<MiddlewareTransitionFn<S, any>>,
        payload: any
    ): void {
        if (result instanceof Promise) {
            result
                .then(next => this.applyTransition(next))
                .catch(error => console.error(`Async transition failed:`, error));
            return;
        }

        if (Array.isArray(result)) {
            // Middleware array for specific event
            this.resolveEventMiddlewareChain(result, payload);
            return;
        }

        if (typeof result === 'function') {
            try {
                const fnResult = (result as PayloadTransitionFn<S, any>)({ payload });
                if (fnResult instanceof Promise) {
                    fnResult
                        .then(next => this.applyTransition(next))
                        .catch(error => console.error(`Async transition function failed:`, error));
                } else {
                    this.applyTransition(fnResult);
                }
            } catch (error) {
                console.error('Transition function threw an error:', error);
            }
            return;
        }

        this.applyTransition(result as S);
    }

    private resolveEventMiddlewareChain(
        middleware: ReadonlyArray<MiddlewareTransitionFn<S, any>>,
        payload: any
    ): void {
        let index = 0;
        const next = (p: any): S | Promise<S> => {
            if (index >= middleware.length) {
                return this.state; // No more middleware
            }
            const fn = middleware[index++];
            const result = fn({ payload: p }, next);
            return result;
        };

        const result = next(payload);
        if (result instanceof Promise) {
            result
                .then(nextState => this.applyTransition(nextState))
                .catch(error => console.error(`Middleware chain failed:`, error));
        } else {
            this.applyTransition(result);
        }
    }

    private applyTransition(next: S): void {
        if (!next || this.state === next) {
            return;
        }

        // Prevent re-render during render cycle
        if (this._rendering) {
            this._pendingState = next;
            return;
        }

        this.state = next;
        this._rendering = true;

        try {
            this.widget.render(this.context, true);
        } finally {
            this._rendering = false;

            // Apply any pending state change
            if (this._pendingState && this._pendingState !== this.state) {
                const pending = this._pendingState;
                this._pendingState = undefined;
                this.applyTransition(pending);
            }
        }
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
        // Clear listeners
        this.listeners = {};

        super.dispose();
    }
}

export abstract class InheritedWidget extends Widget {
    name: string = "InheritedWidget";

    constructor(public child: Widget, params: WidgetParams = {}) {
        super(params);
    }

    abstract updateShouldNotify(old_widget: InheritedWidget): boolean;

    render(context?: BuildContext): HTMLElement {
        const widgetContext = new BuildContext(this, context);
        return this.child.render(widgetContext);
    }

    dispose(): void {

    }
}