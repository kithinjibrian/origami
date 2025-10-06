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

    private watchers: WeakMap<Node, Set<() => void>> = new WeakMap();
    private observer?: MutationObserver;

    private constructor() {
        if (typeof document === 'undefined') return;

        const root = document.documentElement || document.body;
        try {
            this.observer = new MutationObserver((mutations) => this.processMutations(mutations));
            this.observer.observe(root, { childList: true, subtree: true });
        } catch (err) {
            console.warn('RemovalWatcher: unable to create MutationObserver:', err);
            this.observer = undefined;
        }
    }

    private processMutations(mutations: MutationRecord[]) {
        for (const m of mutations) {
            for (const node of Array.from(m.removedNodes)) {
                this.triggerForRemoved(node);
            }
        }

        Promise.resolve().then(() => this.checkDisconnected());
    }

    private strongRefs: Map<Node, Set<() => void>> = new Map();

    private triggerForRemoved_iterable(node: Node) {
        for (const [watchedNode, callbacks] of Array.from(this.strongRefs.entries())) {
            if (node === watchedNode || node.contains(watchedNode)) {
                callbacks.forEach(cb => {
                    try { cb(); } catch (err) { console.error('RemovalWatcher callback error:', err); }
                });
                this.unwatch(watchedNode);
            }
        }
    }

    private triggerForRemoved(node: Node) {
        this.triggerForRemoved_iterable(node);
    }

    private checkDisconnected() {
        for (const [node, callbacks] of Array.from(this.strongRefs.entries())) {
            if (!(node as any).isConnected) {
                callbacks.forEach(cb => {
                    try { cb(); } catch (err) { console.error('RemovalWatcher callback error (disconnected):', err); }
                });
                this.unwatch(node);
            }
        }
    }

    watch(node: Node, cb: () => void) {
        if (!node) return;
        this.strongRefs.set(node, this.strongRefs.get(node) ?? new Set());
        this.strongRefs.get(node)!.add(cb);

        const existing = this.watchers.get(node) ?? new Set();
        existing.add(cb);
        this.watchers.set(node, existing);
    }

    unwatch(node: Node, cb?: () => void) {
        if (!node) return;
        const set = this.strongRefs.get(node);
        if (!set) return;
        if (!cb) {
            this.strongRefs.delete(node);
            this.watchers.delete(node);
            return;
        }
        set.delete(cb);
        if (set.size === 0) {
            this.strongRefs.delete(node);
            this.watchers.delete(node);
        }
    }

    disconnect() {
        this.observer?.disconnect();
        this.strongRefs.clear();
        this.watchers = new WeakMap();
    }
}

type Provider<T> = T | (() => T);

export class BuildContext {
    private _providers = new Map<symbol, Provider<any>>();
    private _inheritedWidgets = new Map<Type, InheritedWidget>();
    private _disposed = false;
    private _children: BuildContext[] = [];

    constructor(public widget: Widget, public parent?: BuildContext) {
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
        if (inheritedWidget) return inheritedWidget as T;
        if (this.parent) return this.parent.dependOnInheritedWidgetOfExactType(type);
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

        this._children.forEach(child => child.dispose());
        this._children = [];
        this._providers.clear();
        this._inheritedWidgets.clear();

        if (this.parent) {
            const idx = this.parent._children.indexOf(this);
            if (idx !== -1) this.parent._children.splice(idx, 1);
        }
    }
}


export interface WidgetParams { key?: string }

const MAX_RENDER_DEPTH = 100;

export abstract class Widget {
    key: string;
    public elements: Node[] = [];
    public _renderDepth = 0;
    protected _context?: BuildContext;
    protected _disposed = false;
    protected _onRemoveCallback?: () => void;
    abstract name: string;

    protected _anchorStart?: Comment;
    protected _anchorEnd?: Comment;

    constructor({ key }: WidgetParams = {}) {
        this.key = key ?? `${this.constructor.name}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    }

    abstract render(context: BuildContext): Node;

    protected setElement(node: Node): Node {
        this.elements.push(node);
        try {
            if (node instanceof HTMLElement) node.setAttribute('data-key', this.key);
        } catch (err) { }

        if (typeof document !== 'undefined') {
            if (!this._onRemoveCallback) {
                this._onRemoveCallback = () => {
                    if (!this._disposed) {
                        try { this.dispose(); } catch (e) { console.error('Error disposing widget on DOM removal:', e); }
                    }
                };
            }

            try { RemovalWatcher.instance.watch(node, this._onRemoveCallback); } catch (err) { console.warn('Failed to register element with RemovalWatcher:', err); }
        }

        return node;
    }

    protected createAnchors(): [Comment, Comment] {
        if (this._anchorStart && this._anchorEnd) return [this._anchorStart, this._anchorEnd];
        const start = document.createComment(`widget:start:${this.key}`);
        const end = document.createComment(`widget:end:${this.key}`);
        this._anchorStart = start;
        this._anchorEnd = end;

        if (!this._onRemoveCallback) {
            this._onRemoveCallback = () => {
                if (!this._disposed) {
                    try { this.dispose(); } catch (e) { console.error('Error disposing widget from anchor removal:', e); }
                }
            };
        }

        try { RemovalWatcher.instance.watch(start, this._onRemoveCallback); } catch (err) { /* ignore */ }

        return [start, end];
    }

    protected mountAnchors(parent: Node, before?: Node | null) {
        const [start, end] = this.createAnchors();
        parent.insertBefore(start, before ?? null);
        parent.insertBefore(end, before ?? null);
    }

    protected removeAnchors() {
        if (this._anchorStart && this._anchorStart.parentNode) this._anchorStart.parentNode.removeChild(this._anchorStart);
        if (this._anchorEnd && this._anchorEnd.parentNode) this._anchorEnd.parentNode.removeChild(this._anchorEnd);
        if (this._anchorStart) RemovalWatcher.instance.unwatch(this._anchorStart, this._onRemoveCallback);
        this._anchorStart = undefined;
        this._anchorEnd = undefined;
    }

    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;

        if (this._onRemoveCallback) {
            this.elements.forEach(el => RemovalWatcher.instance.unwatch(el));
        }

        if (this._context) {
            this._context.dispose();
            this._context = undefined;
        }

        this.elements = [];
        this.removeAnchors();
    }
}

export abstract class ImmutableWidget extends Widget {
    name: string = 'ImmutableWidget';
    abstract build(context: BuildContext): Widget;

    render(context: BuildContext): Node {
        if (this._renderDepth++ > MAX_RENDER_DEPTH) throw new Error(`Maximum render depth exceeded (${MAX_RENDER_DEPTH}). Possible circular reference in widget tree.`);

        const widgetContext = new BuildContext(this, context);
        this._context = widgetContext;

        try {
            const childWidget = this.build(widgetContext);
            childWidget._renderDepth = this._renderDepth;
            const node = childWidget.render(widgetContext);

            this.elements = childWidget.elements.slice();
            return node;
        } catch (e) {
            console.error('Error rendering ImmutableWidget:', e);
            throw e;
        } finally {
            this._renderDepth--;
        }
    }
}

export abstract class MutableWidget extends Widget {
    name: string = 'MutableWidget';
    public mutable?: Mutable<this>;

    abstract createMutable(): Mutable<this>;

    render(context: BuildContext, changed: boolean = false): Node {
        if (this._renderDepth++ > MAX_RENDER_DEPTH) throw new Error(`Maximum render depth exceeded (${MAX_RENDER_DEPTH}). Possible circular reference in widget tree.`);

        const widgetContext = new BuildContext(this, context);
        this._context = widgetContext;

        if (this.mutable == null) {
            this.mutable = this.createMutable();
            this.mutable.context = widgetContext;
            try { this.mutable.init(); } catch (err) { console.error('Error in mutable.init:', err); }
        } else {
            this.mutable.context = widgetContext;
        }

        try {
            const buildResult = this.mutable.build(widgetContext);

            if (buildResult instanceof Widget) {
                const childWidget = buildResult as Widget;
                childWidget._renderDepth = this._renderDepth;
                const node = childWidget.render(widgetContext);

                if (changed && this._anchorStart && this._anchorEnd) {
                    this.atomicReplaceBetweenAnchors(node);
                    this.elements = childWidget.elements.slice();
                    return node;
                }

                if (!this._anchorStart || !this._anchorEnd) {
                    const fragment = document.createDocumentFragment();
                    const [s, e] = this.createAnchors();
                    fragment.appendChild(s);
                    fragment.appendChild(node);
                    fragment.appendChild(e);
                    this.elements = childWidget.elements.slice();
                    return fragment as unknown as Node;
                }

                this.elements = childWidget.elements.slice();
                return node;

            } else {
                const element = (this.mutable as any).render(widgetContext, buildResult) as Node;
                if (!(element instanceof Node)) throw new Error("Mutable's render method must return a DOM Node.");

                if (changed && this._anchorStart && this._anchorEnd) {
                    this.atomicReplaceBetweenAnchors(element);

                    this.unregisterElements();
                    this.elements = [element];
                    this.registerElements();
                    return element;
                }

                if (!this._anchorStart || !this._anchorEnd) {
                    this.elements = [element];
                    this.registerElements();
                    return element;
                }

                this.insertBetweenAnchors(element);
                this.elements = [element];
                this.registerElements();
                return element;
            }

        } catch (e) {
            try {
                if (this.mutable && (this.mutable as any).renderLeaf) {
                    const leaf = (this.mutable as any).renderLeaf(widgetContext);
                    this.elements = [leaf];
                    this.registerElements();
                    return leaf;
                }
            } catch (err) {
                console.error('Error rendering MutableWidget leaf fallback:', err);
            }

            console.error('Error rendering MutableWidget:', e);
            throw e;
        } finally {
            this._renderDepth--;
        }
    }

    protected unregisterElements() {
        this.elements.forEach(n => RemovalWatcher.instance.unwatch(n));
    }

    protected registerElements() {
        if (!this._onRemoveCallback) {
            this._onRemoveCallback = () => {
                if (!this._disposed) {
                    try { this.dispose(); } catch (e) { console.error('Error disposing widget on DOM removal:', e); }
                }
            };
        }
        this.elements.forEach(n => RemovalWatcher.instance.watch(n, this._onRemoveCallback!));
    }

    protected insertBetweenAnchors(node: Node) {
        if (!this._anchorStart || !this._anchorEnd) return;
        const parent = this._anchorStart.parentNode;
        if (!parent) {
            this._anchorStart.parentNode?.insertBefore(node, this._anchorEnd ?? null);
            return;
        }

        let cur = this._anchorStart.nextSibling;
        const frag = document.createDocumentFragment();
        frag.appendChild(node);

        const nodesToRemove: Node[] = [];
        while (cur && cur !== this._anchorEnd) {
            nodesToRemove.push(cur);
            cur = cur.nextSibling;
        }
        for (const n of nodesToRemove) n.parentNode?.removeChild(n);

        parent.insertBefore(frag, this._anchorEnd);
    }

    protected atomicReplaceBetweenAnchors(node: Node) {
        if (!this._anchorStart || !this._anchorEnd) return;
        const parent = this._anchorStart.parentNode;
        if (!parent) return;

        const frag = document.createDocumentFragment();
        frag.appendChild(node);

        let cur = this._anchorStart.nextSibling;
        const toRemove: Node[] = [];
        while (cur && cur !== this._anchorEnd) {
            toRemove.push(cur);
            cur = cur.nextSibling;
        }
        for (const n of toRemove) parent.removeChild(n);

        parent.insertBefore(frag, this._anchorEnd);
    }

    dispose(): void {
        if (this.mutable) {
            try { this.mutable.dispose(); } catch (err) { console.error('Error disposing mutable:', err); }
            this.mutable = undefined;
        }
        this.unregisterElements();
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

interface SignalInternal<T> extends Signal<T> {
    _subscriptions: Set<() => void>;
    _cleanup: () => void;
}

export abstract class ReactiveWidget<T extends MutableWidget> extends Mutable<T> {
    private _signals = new Set<SignalInternal<any>>();
    private _cleanupFns = new Set<() => void>();

    signal<V>(value: V): Signal<V> {
        const subscriptions = new Set<() => void>();

        const sig: SignalInternal<V> = {
            _subscriptions: subscriptions,
            _cleanup: () => { subscriptions.clear(); },
            get value() {
                if (subscriber !== null) subscriptions.add(subscriber);
                return value;
            },
            set value(updated: V) {
                value = updated;
                subscriptions.forEach(fn => { try { fn(); } catch (err) { console.error('Error in signal subscription:', err); } });
            }
        };

        this._signals.add(sig);
        return sig;
    }

    effect(fn: () => void): () => void {
        let isActive = true;
        const wrapper = () => {
            if (!isActive) return;
            subscriber = wrapper;
            try { fn(); } catch (err) { console.error('Error in effect:', err); } finally { subscriber = null; }
        };

        const cleanup = () => {
            isActive = false;
            this._cleanupFns.delete(cleanup);
            this._signals.forEach(sig => sig._subscriptions.delete(wrapper));
        };

        this._cleanupFns.add(cleanup);
        wrapper();
        return cleanup;
    }

    derived<U>(fn: () => U): Signal<U> {
        let cachedValue = fn();
        const subscriptions = new Set<() => void>();

        this.effect(() => {
            const newValue = fn();
            if (newValue !== cachedValue) {
                cachedValue = newValue;
                subscriptions.forEach(sub => { try { sub(); } catch (err) { console.error('Error in derived subscription:', err); } });
            }
        });

        const derivedSignal: SignalInternal<U> = {
            _subscriptions: subscriptions,
            _cleanup: () => { subscriptions.clear(); },
            get value() { if (subscriber !== null) subscriptions.add(subscriber); return cachedValue; },
            set value(_: U) { console.warn('Cannot set value on derived signal'); }
        };

        this._signals.add(derivedSignal);
        return derivedSignal;
    }

    dispose(): void {
        this._cleanupFns.forEach(cleanup => { try { cleanup(); } catch (err) { console.error('Error during effect cleanup:', err); } });
        this._cleanupFns.clear();

        this._signals.forEach(sig => { try { sig._cleanup(); } catch (err) { console.error('Error during signal cleanup:', err); } });
        this._signals.clear();

        super.dispose();
    }
}

export abstract class DataMutable<T extends MutableWidget> extends ReactiveWidget<T> {
    abstract build(context: BuildContext): Widget;
}

export interface StateMutableParams<S extends string> { init?: S }
export type EventArgs<P = void> = { payload: P; context: BuildContext }
export type Transition<S extends string> = S | Promise<S>
export type TransitionFn<S extends string> = () => Transition<S>
export type EventHandler<S extends string, P = void> = (args: EventArgs<P>) => Transition<S>
export type Middleware<S extends string, P = void> = (args: EventArgs<P>, next: (args: EventArgs<P>) => Transition<S>) => Transition<S>
export type StateHandler<S extends string, Events extends Record<string, unknown>> =
    | TransitionFn<S>
    | Middleware<S, void>[]
    | { [E in keyof Events]?: S | EventHandler<S, Events[E]> | Middleware<S, Events[E]>[] };
export type States<S extends string, Events extends Record<string, unknown>> = { [K in S]: StateHandler<S, Events> };
export type Widgets<S extends string> = Partial<Record<string, (args: { state: S, context: BuildContext }) => Widget>>;

type IsVoidLike<T> = T extends void | undefined | never ? true : false;

export abstract class StateMutable<
    T extends MutableWidget,
    S extends string,
    Events extends Record<string, unknown> = Record<string, never>
> extends ReactiveWidget<T> {
    state: S;
    private _rendering = false;
    private _pendingTransitions: S[] = [];

    private _scheduledRender = false;

    constructor(widget: T, params?: StateMutableParams<S>) {
        super(widget);

        const stateKeys = Object.keys((() => {
            try { return (this as any).states(); } catch { return {}; }
        })());

        this.state = (params?.init ?? stateKeys[0]) as S;
    }

    abstract states(): States<S, Events>;
    abstract build(context: BuildContext): Widgets<S>;

    public setState(state: S) {
        this.state = state;
        this.scheduleRender();
    }

    private scheduleRender() {
        if (this._scheduledRender) return;
        this._scheduledRender = true;
        Promise.resolve().then(() => {
            this._scheduledRender = false;
            try { this.widget.render(this.context, true); } catch (err) { console.error('Error in scheduled render:', err); }
        });
    }

    public send<E extends keyof Events & string>(
        event: E,
        ...args: IsVoidLike<Events[E]> extends true ? [] | [payload?: Events[E]] : [payload: Events[E]]
    ): void {
        const payload = args[0] as Events[E];
        const handler = this.states()[this.state];

        if (!handler) return;

        try {
            if (typeof handler === 'function') {
                const result = (handler as TransitionFn<S>)();
                this.handleTransition(result);
            } else if (Array.isArray(handler)) {
                this.runMiddlewareChain(handler, payload);
            } else if (typeof handler === 'object' && handler !== null) {
                const eventHandler = (handler as any)[event];
                if (eventHandler !== undefined) {
                    this.handleEventTransition(eventHandler, payload);
                }
            }
        } catch (error) {
            console.error(`Error handling event "${event}" in state "${this.state}":`, error);
        }
    }

    private handleTransition(result: Transition<S>): void {
        if (result instanceof Promise) {
            result.then(next => this.applyTransition(next)).catch(error => console.error('Async transition failed:', error));
        } else {
            this.applyTransition(result);
        }
    }

    private handleEventTransition(
        handler: S | EventHandler<S, any> | Middleware<S, any>[],
        payload: any
    ): void {
        if (typeof handler === 'string') {
            this.applyTransition(handler);
        } else if (typeof handler === 'function') {
            const result = handler({ payload, context: this.context });
            this.handleTransition(result);
        } else if (Array.isArray(handler)) {
            this.runMiddlewareChain(handler, payload);
        }
    }

    private runMiddlewareChain(middleware: Middleware<S, any>[], payload: any): void {
        let index = 0;
        const next = (args: EventArgs<any>): Transition<S> => {
            if (index >= middleware.length) return this.state;
            const fn = middleware[index++];
            return fn(args, next);
        };

        const result = next({ payload, context: this.context });
        this.handleTransition(result);
    }

    private applyTransition(next: S): void {
        if (!next || this.state === next) return;

        if (this._rendering) {
            this._pendingTransitions.push(next);
            return;
        }

        this.state = next;
        this._rendering = true;

        try {
            this.scheduleRender();
        } finally {
            this._rendering = false;

            if (this._pendingTransitions.length > 0) {
                const pending = this._pendingTransitions.shift()!;
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
                    const result = (handler as TransitionFn<S>)();
                    const next = result instanceof Promise ? await result : result;
                    if (next && next !== this.state) {
                        this.applyTransition(next);
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
        if (steps >= maxSteps) console.warn(`Auto-step reached max steps (${maxSteps}) - possible infinite loop`);
    }

    private findWidget(widgets: Widgets<S>, state: S, context: BuildContext): Widget | null {
        if (widgets[state]) return widgets[state]!({ state, context });
        for (const pattern in widgets) {
            if (pattern.includes('|')) {
                const states = pattern.split('|').map(s => s.trim());
                if (states.includes(state)) return widgets[pattern]!({ state, context });
            }
        }
        for (const pattern in widgets) {
            if (pattern.endsWith('.*')) {
                const prefix = pattern.slice(0, -2);
                if (state.startsWith(prefix)) return widgets[pattern]!({ state, context });
            }
        }
        for (const pattern in widgets) {
            if (pattern.startsWith('/') && pattern.endsWith('/')) {
                try {
                    const regex = new RegExp(pattern.slice(1, -1));
                    if (regex.test(state)) return widgets[pattern]!({ state, context });
                } catch (err) { console.warn(`Invalid widget regex pattern "${pattern}":`, err); }
            }
        }
        if (widgets['*']) return widgets['*']({ state, context });
        return null;
    }

    render(context: BuildContext, widgets: Widgets<S>): Node {
        try {
            const widget = this.findWidget(widgets, this.state, context);
            if (!widget) throw new Error(`No widget defined for state "${this.state}"`);
            const node = widget.render(context);
            this.autoStep();
            return node;
        } catch (e) {
            console.error('Error rendering StateMutable:', e);
            throw e;
        }
    }
}


export abstract class InheritedWidget extends Widget {
    name: string = 'InheritedWidget';
    constructor(public child: Widget, params: WidgetParams = {}) { super(params); }

    abstract updateShouldNotify(old_widget: InheritedWidget): boolean;

    render(context: BuildContext): Node {
        const widgetContext = new BuildContext(this, context);
        this._context = widgetContext;
        const node = this.child.render(widgetContext);
        this.elements = this.child.elements.slice();
        return node;
    }
}

