class UpdateScheduler {
    private pending = new Set<() => void>();
    private isScheduled = false;

    schedule(callback: () => void) {
        this.pending.add(callback);

        if (!this.isScheduled) {
            this.isScheduled = true;
            queueMicrotask(() => this.flush());
        }
    }

    private flush() {
        const callbacks = Array.from(this.pending);
        this.pending.clear();
        this.isScheduled = false;

        for (const callback of callbacks) {
            try {
                callback();
            } catch (error) {
                console.error('Error during scheduled update:', error);
            }
        }
    }
}

const scheduler = new UpdateScheduler();

const anchorCallbacks = new WeakMap<Comment, () => void>();

function attachToAnchor(anchor: Comment, callback: () => void) {
    anchorCallbacks.set(anchor, callback);
}

function detachFromAnchor(anchor: Comment) {
    const callback = anchorCallbacks.get(anchor);
    if (callback) {
        callback();
        anchorCallbacks.delete(anchor);
    }
}

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
        throw new Error(`Service '${type.name}' is not marked as @Injectable`);
    }
    return token;
}

type Provider<T> = T | (() => T);

export class BuildContext {
    private _providers = new Map<symbol, Provider<any>>();
    private _children: BuildContext[] = [];
    private _inheritedWidgets = new Map<Type, InheritedWidget>();
    private _isDisposed = false;

    constructor(
        private widget: Widget,
        private parent?: BuildContext
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
        if (this._isDisposed) throw new Error('Cannot provide on a disposed context');
        const token = getServiceToken(type);
        this._providers.set(token, provider);
    }

    read<T>(type: Type<T>): T {
        if (this._isDisposed) throw new Error('Cannot read from a disposed context');
        const token = getServiceToken(type);
        const provider = this._providers.get(token);

        if (provider !== undefined) {
            return typeof provider === 'function' ? (provider as () => T)() : (provider as T);
        }

        if (this.parent) return this.parent.read(type);
        throw new Error(`${type.name} is not provided in context`);
    }

    dependOnInheritedWidgetOfExactType<T extends InheritedWidget>(type: Type<T>): T | null {
        const widget = this._inheritedWidgets.get(type);
        if (widget) return widget as T;
        if (this.parent) return this.parent.dependOnInheritedWidgetOfExactType(type);
        return null;
    }

    dependOnInheritedWidgetOfExactTypeRequired<T extends InheritedWidget>(type: Type<T>): T {
        const widget = this.dependOnInheritedWidgetOfExactType(type);
        if (!widget) {
            throw new Error(`No ${type.name} found in widget tree`);
        }
        return widget;
    }

    get isDisposed(): boolean {
        return this._isDisposed;
    }

    dispose() {
        if (this._isDisposed) return;

        this._isDisposed = true;

        for (const child of this._children) {
            child.dispose();
        }
        this._children = [];

        try {
            this.widget.dispose();
        } catch (error) {
            console.error('Error disposing widget:', error);
        }
    }
}

export interface WidgetParams {
    key?: string;
    debugLabel?: string;
}

export abstract class Widget {
    key: string;
    debugLabel?: string;
    abstract name: string;
    abstract anchor: Comment | null;

    abstract render(context: BuildContext): Node;

    constructor({ key, debugLabel }: WidgetParams = {}) {
        this.key = key ?? this.generateKey();
        this.debugLabel = debugLabel;
    }

    private generateKey(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `${this.constructor.name}_${timestamp}_${random}`;
    }

    dispose(context?: BuildContext) {
        if (context) {
            context.dispose();
        }
    }

    protected logError(message: string, error?: any) {
        const label = this.debugLabel || this.key;
        console.error(`[${this.name}:${label}] ${message}`, error);
    }
}

export abstract class ImmutableWidget extends Widget {
    name: string = "ImmutableWidget";
    anchor: Comment | null = null;

    abstract build(context: BuildContext): Widget;

    render(context: BuildContext): Node {
        const widgetContext = new BuildContext(this, context);

        this.anchor = document.createComment(this.key);

        attachToAnchor(this.anchor, () => {
            this.dispose(widgetContext);
        });

        try {
            const child = this.build(widgetContext);
            const childNode = child.render(widgetContext);

            const fragment = document.createDocumentFragment();
            fragment.appendChild(this.anchor);
            fragment.appendChild(childNode);

            return fragment;
        } catch (error) {
            this.logError('Failed to build widget', error);

            const errorNode = document.createTextNode(
                `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
            );
            const fragment = document.createDocumentFragment();
            fragment.appendChild(this.anchor);
            fragment.appendChild(errorNode);
            return fragment;
        }
    }
}

export abstract class MutableWidget extends Widget {
    name: string = "MutableWidget";
    anchor: Comment | null = null;
    mutable?: Mutable<this, any>;

    abstract createMutable(): Mutable<this, any>;

    render(context: BuildContext): Node {
        const widgetContext = new BuildContext(this, context);

        this.anchor = document.createComment(this.key);

        attachToAnchor(this.anchor, () => {
            this.dispose();
        });

        if (!this.mutable) {
            this.mutable = this.createMutable();
            this.mutable.context = widgetContext;

            try {
                this.mutable.init?.();
            } catch (error) {
                this.logError('Error during mutable initialization', error);
            }
        }

        try {
            const buildResult = this.mutable.build(widgetContext);
            let node: Node;

            if (buildResult instanceof Widget) {
                node = buildResult.render(widgetContext);
            } else {
                if (this.mutable instanceof StateWidget) {
                    const widget = this.mutable.render(buildResult);
                    node = widget.render(widgetContext);
                } else {
                    throw new Error('Invalid build result type');
                }
            }

            const fragment = document.createDocumentFragment();
            fragment.appendChild(this.anchor);
            fragment.appendChild(node);

            return fragment;
        } catch (error) {
            this.logError('Failed to render mutable widget', error);
            throw error;
        }
    }

    dispose() {
        if (this.mutable) {
            try {
                this.mutable.dispose();
            } catch (error) {
                this.logError('Error during mutable disposal', error);
            }
            this.mutable = undefined;
        }
    }
}

const subscribers: Running[] = [];

interface Running {
    execute: () => void;
    dependencies: Set<Set<Running>>;
    cleanup?: () => void;
    debugLabel?: string;
}

function subscribe(running: Running, subscriptions: Set<Running>) {
    subscriptions.add(running);
    running.dependencies.add(subscriptions);
}

function unsubscribe(running: Running) {
    for (const subscriptions of running.dependencies) {
        subscriptions.delete(running);
    }
    running.dependencies.clear();
}

export interface Signal<T> {
    get value(): T;
    set value(updated: T);
}

abstract class Mutable<T extends MutableWidget, W> {
    abstract name: string;
    context!: BuildContext;
    private effects: Running[] = [];
    private isRebuilding = false;

    constructor(protected widget: T) { }

    abstract build(context: BuildContext): W;

    init() { }

    dispose() {
        // Clean up all effects
        for (const effect of this.effects) {
            try {
                unsubscribe(effect);
                effect.cleanup?.();
            } catch (error) {
                console.error('Error cleaning up effect:', error);
            }
        }
        this.effects = [];
    }

    public rebuild(newElement: Node) {
        // Prevent concurrent rebuilds
        if (this.isRebuilding) {
            console.warn('Rebuild already in progress, skipping');
            return;
        }

        const anchor = this.widget.anchor;
        if (!anchor || !anchor.parentNode) {
            console.warn('Cannot rebuild: anchor not in DOM');
            return;
        }

        this.isRebuilding = true;

        try {
            const parent = anchor.parentNode;
            let next = anchor.nextSibling;

            // Clean up old nodes
            while (next) {
                const toRemove = next;
                next = next.nextSibling;

                if (toRemove instanceof Comment && anchorCallbacks.has(toRemove)) {
                    detachFromAnchor(toRemove);
                }

                parent.removeChild(toRemove);
            }

            // Append new element
            parent.appendChild(newElement);
        } finally {
            this.isRebuilding = false;
        }
    }

    public signal<V>(value: V, debugLabel?: string): Signal<V> {
        const subscriptions = new Set<Running>();

        const sig = {
            get value() {
                const running = subscribers[subscribers.length - 1];
                if (running) {
                    subscribe(running, subscriptions);
                }
                return value;
            },
            set value(updated: V) {
                // Skip update if value hasn't changed
                if (Object.is(value, updated)) return;

                value = updated;

                // Batch all subscriber updates
                const subs = [...subscriptions];
                for (const sub of subs) {
                    scheduler.schedule(() => sub.execute());
                }
            }
        };

        return sig;
    }

    public effect = (
        fn: () => void | (() => void),
        debugLabel?: string
    ): (() => void) => {
        const execute = () => {
            // Prevent executing if context is disposed
            if (this.context.isDisposed) {
                return;
            }

            unsubscribe(running);

            try {
                running.cleanup?.();
            } catch (error) {
                console.error('Error in effect cleanup:', error);
            }

            subscribers.push(running);
            try {
                const result = fn();
                running.cleanup = typeof result === 'function' ? result : undefined;
            } catch (error) {
                console.error(`Error in effect${debugLabel ? ` (${debugLabel})` : ''}:`, error);
            } finally {
                subscribers.pop();
            }
        };

        const running: Running = {
            execute,
            dependencies: new Set(),
            debugLabel
        };

        this.effects.push(running);
        execute();

        // Return cleanup function
        return () => {
            unsubscribe(running);
            running.cleanup?.();
            const index = this.effects.indexOf(running);
            if (index > -1) {
                this.effects.splice(index, 1);
            }
        };
    };

    public derived<V>(fn: () => V, debugLabel?: string): Signal<V> {
        const sig = this.signal<V>(undefined as V, debugLabel);

        this.effect(() => {
            sig.value = fn();
        }, debugLabel ? `derived:${debugLabel}` : 'derived');

        return {
            get value() {
                return sig.value;
            },
            set value(_: V) {
                throw new Error('Cannot set derived signal directly');
            }
        };
    }
}

export abstract class DataWidget<T extends MutableWidget> extends Mutable<T, Widget> {
    name: string = "DataWidget";
}

export interface StateMutableParams<S extends string> {
    init?: S;
    debugLabel?: string;
}

type SOrArray<S extends string> = S | S[];

type Rule<S extends string> = (current: S, next: S) => boolean;

type StateDefinition<S extends string> =
    | SOrArray<S>
    | {
        next: SOrArray<S>;
        rules?: Rule<S>[];
    };

export type States<S extends string> = {
    [K in S]: StateDefinition<S>;
};

type EventArgs<P = void> = { payload: P; context: BuildContext };

type TransitionReturn<S> = S | Promise<S>;

type EventHandler<S, P> = (args: EventArgs<P>) => TransitionReturn<S>;

type TransitionHandler<S extends string, E extends Record<string, unknown>> =
    | (() => TransitionReturn<S>)
    | {
        [K in keyof E]?: S | EventHandler<S, E[K]>;
    };

export type Transitions<S extends string, E extends Record<string, unknown>> = {
    [K in S]: TransitionHandler<S, E>;
};

type IsVoidLike<T> = T extends void | undefined | never ? true : false;

export type Widgets<S extends string> = Partial<Record<string, (args: {
    state: S;
    context: BuildContext;
}) => Widget>>;

export abstract class StateWidget<
    T extends MutableWidget,
    S extends string,
    E extends Record<string, unknown> = Record<string, never>
> extends Mutable<T, Widgets<S>> {
    name: string = "StateWidget";
    private state: S;
    private transitionInProgress = false;
    private pendingTransition: S | null = null;

    constructor(widget: T, params?: StateMutableParams<S>) {
        super(widget);
        const stateKeys = Object.keys(this.states());
        this.state = (params?.init ?? stateKeys[0]) as S;
    }

    abstract states(): States<S>;

    transitions(): Transitions<S, E> | null {
        return null;
    }

    getCurrentState(): S {
        return this.state;
    }

    private getNextStates(current: S): S[] {
        const states = this.states();
        const stateDef = states[current];

        if (typeof stateDef === "string") {
            return [stateDef as S];
        }

        if (Array.isArray(stateDef)) {
            return stateDef;
        }

        const next = stateDef.next;
        return Array.isArray(next) ? next : [next];
    }

    protected shift(next: S) {
        this._shift(next, false);
    }

    private _shift(next: S, auto: boolean = false) {
        if (!next || this.state === next) return;

        if (this.transitionInProgress) {
            this.pendingTransition = next;
            return;
        }

        this.transitionInProgress = true;

        try {
            const states = this.states();
            const current = states[this.state];
            const allowedNext = this.getNextStates(this.state);

            if (typeof current === "object" && !Array.isArray(current)) {
                if (current.rules && current.rules.length > 0) {
                    const allPassed = current.rules.every(rule => {
                        try {
                            return rule(this.state, next);
                        } catch (error) {
                            console.error('Error in transition rule:', error);
                            return false;
                        }
                    });

                    if (!allPassed) {
                        throw new Error(
                            `Transition from "${this.state}" to "${next}" blocked by rules.`
                        );
                    }
                }
            }

            if (!allowedNext.includes(next)) {
                throw new Error(
                    `Invalid transition: cannot move from "${this.state}" to "${next}".`
                );
            }

            const prevState = this.state;
            this.state = next;

            try {
                const widget = this.render(this.build(this.context));
                this.rebuild(widget.render(this.context));
            } catch (error) {
                this.state = prevState;
                throw error;
            }

            if (auto) {
                this.autoStep();
            }
        } finally {
            this.transitionInProgress = false;

            if (this.pendingTransition) {
                const pending = this.pendingTransition;
                this.pendingTransition = null;
                this._shift(pending, auto);
            }
        }
    }

    private async autoStep() {
        const transitions = this.transitions();
        if (!transitions) return;

        const handler = transitions[this.state];

        if (typeof handler === "function") {
            this.handleEventTransition(handler as any, undefined);
        }
    }

    protected send<K extends keyof E & string>(
        event: K,
        ...args: IsVoidLike<E[K]> extends true ? [] | [payload?: E[K]] : [payload: E[K]]
    ) {
        const payload = args[0] as E[K];
        const handler = this.transitions()?.[this.state];

        if (!handler) {
            console.warn(`No transition handler for state "${this.state}"`);
            return;
        }

        try {
            if (typeof handler === 'object') {
                const eventHandler = (handler as any)[event];
                if (eventHandler !== undefined) {
                    return this.handleEventTransition(eventHandler, payload);
                }
            }

            throw new Error(
                `Cannot invoke event '${event}' from current state '${this.state}'.`
            );
        } catch (error) {
            console.error(`Error sending event '${event}':`, error);
            throw error;
        }
    }

    private handleEventTransition(
        handler: S | EventHandler<S, any>,
        payload: any
    ): void {
        if (typeof handler === 'string') {
            this._shift(handler, true);
        } else if (typeof handler === 'function') {
            try {
                const result = handler({ payload, context: this.context });
                this.handleTransition(result);
            } catch (error) {
                console.error('Error in event handler:', error);
                throw error;
            }
        }
    }

    private handleTransition(result: TransitionReturn<S>): void {
        if (result instanceof Promise) {
            result
                .then(next => this._shift(next, true))
                .catch(error => {
                    console.error('Async transition failed:', error);
                });
        } else {
            this._shift(result, true);
        }
    }

    private findWidget(
        widgets: Widgets<S>,
        state: S,
        context: BuildContext
    ): Widget | null {
        // Exact match
        if (widgets[state]) {
            return widgets[state]!({ state, context });
        }

        // Multiple states (pipe-separated)
        for (const pattern in widgets) {
            if (pattern.includes('|')) {
                const states = pattern.split('|').map(s => s.trim());
                if (states.includes(state)) {
                    return widgets[pattern]!({ state, context });
                }
            }
        }

        // Prefix match
        for (const pattern in widgets) {
            if (pattern.endsWith('.*')) {
                const prefix = pattern.slice(0, -2);
                if (state.startsWith(prefix)) {
                    return widgets[pattern]!({ state, context });
                }
            }
        }

        // Regex match
        for (const pattern in widgets) {
            if (pattern.startsWith('/') && pattern.endsWith('/')) {
                try {
                    const regex = new RegExp(pattern.slice(1, -1));
                    if (regex.test(state)) {
                        return widgets[pattern]!({ state, context });
                    }
                } catch (err) {
                    console.warn(`Invalid regex pattern "${pattern}":`, err);
                }
            }
        }

        // Wildcard fallback
        if (widgets['*']) {
            return widgets['*']({ state, context });
        }

        return null;
    }

    render(widgets: Widgets<S>): Widget {
        const widget = this.findWidget(widgets, this.state, this.context);

        if (!widget) {
            throw new Error(`No widget defined for state "${this.state}"`);
        }

        return widget;
    }
}

export abstract class InheritedWidget extends Widget {
    name: string = "InheritedWidget"
    anchor: Comment | null = null;

    constructor(private child: Widget, params: WidgetParams = {}) {
        super(params);
    }

    abstract updateShouldNotify(oldWidget: InheritedWidget): boolean;

    render(context: BuildContext): Node {
        const widgetContext = new BuildContext(this, context);

        this.anchor = document.createComment(this.key);

        attachToAnchor(this.anchor, () => {
            this.dispose(widgetContext);
        });

        try {
            const childNode = this.child.render(widgetContext);

            const fragment = document.createDocumentFragment();
            fragment.appendChild(this.anchor);
            fragment.appendChild(childNode);

            return fragment;
        } catch (error) {
            this.logError('Failed to build widget', error);

            const errorNode = document.createTextNode(
                `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
            );
            const fragment = document.createDocumentFragment();
            fragment.appendChild(this.anchor);
            fragment.appendChild(errorNode);
            return fragment;
        }
    }
}