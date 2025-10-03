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

export class BuildContext {
    private _providers = new Map<symbol, Provider<any>>();

    constructor(
        private widget: Widget,
        private parent?: BuildContext
    ) {
    }

    provide<T>(type: Type<T>, provider: Provider<T>): void {
        if (!type) throw new Error('Service type cannot be null or undefined');
        if (provider === null || provider === undefined) {
            throw new Error(`Provider for ${type.name} cannot be null or undefined`);
        }

        const token = getServiceToken(type);
        this._providers.set(token, provider);
    }

    read<T>(type: Type<T>): T {
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
}

export interface WidgetParams {
    key?: string;
}

export abstract class Widget {
    key: string;

    constructor({ key }: WidgetParams = {}) {
        this.key =
            key ??
            `${this.constructor.name}_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2, 5)}`;
    }

    abstract render(context?: BuildContext): HTMLElement;

    dispose() {
        // Override in subclasses
    }
}

export abstract class ImmutableWidget extends Widget {
    abstract build(context: BuildContext): Widget;

    render(context: BuildContext): HTMLElement {
        const widgetContext = new BuildContext(this, context);
        return this.build(widgetContext).render(widgetContext);
    }
}

export abstract class MutableWidget<T extends ReactiveWidget> {
    context!: BuildContext;

    abstract build(context: BuildContext): Widget;
}

let subscriber: (() => void) | null = null;

export abstract class ReactiveWidget extends Widget {
    private effectCleanups: Array<() => void> = [];

    signal<T>(value: T) {
        const subscriptions = new Set<() => void>();

        return {
            get value() {
                if (subscriber !== null) {
                    subscriptions.add(subscriber);
                }
                return value;
            },
            set value(updated) {
                value = updated;
                subscriptions.forEach(fn => fn());
            }
        };
    }

    effect(fn: () => void) {
        const cleanup = () => {
            subscriber = null;
        };

        subscriber = fn;
        fn();
        subscriber = null;

        this.effectCleanups.push(cleanup);
    }

    dispose() {
        this.effectCleanups.forEach(cleanup => cleanup());
        this.effectCleanups = [];
        super.dispose();
    }
}

/**
 * A base class for widgets that mutate data but don't change state
 * 
 * Using control flow structures like if, switch and others is heavily discouraged
 */
export abstract class DataWidget extends ReactiveWidget {
    private _mut?: MutableWidget<this>;

    abstract createMutable(): MutableWidget<this>;

    render(context?: BuildContext): HTMLElement {
        const widgetContext = new BuildContext(this, context);

        console.log(this._mut);

        throw new Error("hola");
    }
}

export type SendFunction<E extends string> = (event: E) => void;

export interface StateWidgetParams<S extends string, E extends string> {
    key?: string;
    init?: S;
}

export type TransitionFunction<S extends string> =
    () => S | Promise<S>;

export type TransitionStates<S extends string, E extends string> =
    | Partial<Record<E, S | ((args: { payload: any }) => string)>>
    | TransitionFunction<S>;

export type States<S extends string, E extends string> =
    { [K in S]: TransitionStates<S, E> };

export type Widgets<S extends string> = Partial<
    Record<
        string,
        (args: { state: S; }) => Widget | null
    >
>;

export function types<const States extends readonly string[], const Events extends readonly string[]>(states: States, events: Events) {
    return function <T extends { new(...args: any[]): {} }>(constructor: T) {
        (constructor as any).__states = states;
        (constructor as any).__events = events;
    };
}

/**
 * A base class for widgets that can mutate data and change state
 */
export abstract class StateWidget<S extends string, E extends string> extends ReactiveWidget {
    state: S;
    private container: HTMLElement | null = null;
    public listeners: Record<E, Array<any>> = {} as Record<E, Array<any>>;

    constructor({ key, init }: StateWidgetParams<S, E> = {}) {
        super({ key });
        const stateKeys = Object.keys((() => {
            try {
                return (this as any).states();
            } catch {
                return {};
            }
        })());
        this.state = init ?? (stateKeys[0] as S);
    }

    public subscribe(states: Partial<Record<E, any>>) {
        for (let key in states) {
            if (this.listeners[key as E]) {
                this.listeners[key as E].push(states[key as E]);
            } else {
                this.listeners[key as E] = [states[key as E]];
            }
        }

        return this;
    }

    public send(event: E, payload?: any) {
        const states = this.states();
        const handler = states[this.state];

        if (!handler) return;

        try {
            if (typeof handler === "function") {
                const result = (handler as TransitionFunction<S>)();
                this.resolveTransition(result, payload);
            } else if (typeof handler === "object") {
                const stateMap = handler as Partial<Record<E, S | ((args: { payload: string }) => S)>>;
                if (stateMap[event] !== undefined) {
                    this.resolveTransition(stateMap[event]!, payload);
                }
            }

            if (this.listeners[event]) {
                this.listeners[event].map(cb => cb());
            }
        } catch (error) {
            console.error(`Error handling event "${String(event)}" in state "${String(this.state)}":`, error);
        }
    }

    private resolveTransition(
        result: S | Promise<S> | ((args: { payload: string }) => S),
        payload: any
    ) {
        if (result instanceof Promise) {
            result
                .then((next) => this.applyTransition(next))
                .catch((error) => console.error(`Async transition failed:`, error));
            return;
        }

        if (typeof result === "function") {
            try {
                const fnResult = (result as (args: { payload: string }) => S)({ payload });
                this.applyTransition(fnResult);
            } catch (error) {
                console.error("Transition function threw an error:", error);
            }
            return;
        }

        this.applyTransition(result as S);
    }


    private applyTransition(next: S) {
        if (!next) return;

        if (this.state == next) {
            // don't re render if state doesn't change
            return;
        }

        this.state = next;
        this.reRender();
    }

    private async autoStep(maxSteps = 10) {
        let steps = 0;
        while (steps < maxSteps) {
            const handler = this.states()[this.state];
            if (typeof handler === "function") {
                try {
                    const maybeResult = (handler as TransitionFunction<S>)();
                    const next = maybeResult instanceof Promise ? await maybeResult : maybeResult;

                    if (typeof next === "function") {
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

    private findWidget(state: S): [((args: { state: S; }) => Widget | null) | undefined, S | undefined] {
        const widgets = this.build();

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
                    // If regex is invalid, skip it
                    console.warn(`Invalid widget regex pattern "${pattern}":`, err);
                }
            }
        }

        if (widgets["*"]) {
            return [widgets["*"], state]
        }

        return [undefined, undefined];
    }

    private reRender() {
        if (!this.container) return;

        try {
            this.container.innerHTML = "";

            const [widgetFactory, state] = this.findWidget(this.state);

            if (state)
                this.state = state;

            if (!widgetFactory) {
                throw new Error(`No widget defined for state "${this.state}"`);
            }

            const widget = widgetFactory({ state: this.state });

            if (widget) {
                const childElement = widget.render();
                this.container.appendChild(childElement);
            }

            this.autoStep();
        } catch (error) {
            console.error(`Render failed in state "${this.state}":`, error);
            if (this.container) {
                this.container.innerHTML = `<div style="background-color: red; color: white; padding: 8px;">Render error: ${(error as Error).message ?? String(error)}</div>`;
            }
        }
    }

    abstract states(): States<S, E>;
    abstract build(): Widgets<S>;

    render(): HTMLElement {
        if (!this.container) {
            this.container = document.createElement("div");
        }
        this.reRender();
        return this.container;
    }

    dispose() {
        this.container = null;
    }
}
