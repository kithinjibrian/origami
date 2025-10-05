type Return<
    S extends string,
    D extends Record<string, any>,
    K extends keyof D
> =
    | S
    | { state: S; data: D[K] }

type TransitionFunction<
    S extends string,
    D extends Record<string, any>,
    K extends keyof D
> = () => Return<S, D, K> | Promise<Return<S, D, K>>;

type PayloadTransitionFn<
    S extends string,
    D extends Record<string, any>,
    P,
    K extends keyof D
> = (args: P) => Return<S, D, K> | Promise<Return<S, D, K>>;

type EventBasedTransitions<
    S extends string,
    E extends string,
    D extends Record<S, any>,
    P extends Partial<Record<E, any>>,
    K extends keyof D
> = {
        [X in E]?: X extends keyof P
        ? P[X] extends undefined
        ? PayloadTransitionFn<S, D, undefined, K> | S
        : PayloadTransitionFn<S, D, P[X], K> | S
        : PayloadTransitionFn<S, D, undefined, K> | S;
    };

type TransitionStates<
    S extends string,
    E extends string,
    D extends Record<S, any>,
    P extends Partial<Record<E, any>>,
    K extends keyof D,
    IsEntry extends boolean = false
> = IsEntry extends true
    ? EventBasedTransitions<S, E, D, P, K>
    : TransitionFunction<S, D, K>;

type HasAllEvents<E extends string, Entry> = [E] extends [keyof Entry]
    ? [keyof Entry] extends [E]
    ? true
    : false
    : false;

type ValuesAreUnique<T extends Record<string, any>> = {
    [K in keyof T]: Exclude<
        { [P in keyof T]: P extends K ? never : T[P] }[keyof T],
        T[K]
    > extends never
    ? true
    : false;
}[keyof T] extends false
    ? false
    : true;

type ValidEntryState<
    E extends string,
    S extends string
> = {
    [K in E]: S;
} & {
    __check__?: HasAllEvents<E, { [K in E]: S }> extends true
    ? ValuesAreUnique<{ [K in E]: S }> extends true
    ? true
    : never
    : never;
};

export type BlocStates<
    StateConfig extends Record<string, any>,
    EventConfig extends Record<string, any>
> = {
    entry: TransitionStates<
        keyof StateConfig & string,
        keyof EventConfig & string,
        StateConfig,
        EventConfig,
        "entry",
        true
    >;
} & {
        [K in Exclude<keyof StateConfig & string, "entry">]?: TransitionStates<
            keyof StateConfig & string,
            keyof EventConfig & string,
            StateConfig,
            EventConfig,
            K,
            false
        >;
    };


export abstract class OrigamiBloc<
    StateConfig extends Record<string, any>,
    EventConfig extends Record<string, any>
> {
    listeners: Partial<Record<keyof StateConfig, Array<(data?: any) => void>>> = {};

    abstract states(): BlocStates<StateConfig, EventConfig>;

    public subscribe<K extends keyof StateConfig & string>(
        callbacks: {
            [P in K]?: StateConfig[P] extends never
            ? () => void
            : (...args: [data: StateConfig[P]]) => void
        }
    ) {
        for (const key in callbacks) {
            const event = key as keyof StateConfig;
            const callback = callbacks[key as K];
            if (callback) {
                if (!this.listeners[event]) {
                    this.listeners[event] = [];
                }
                this.listeners[event]!.push(callback as (data?: any) => void);
            }
        }
        return this;
    }

    public send<K extends keyof EventConfig & string>(
        event: K,
        ...args: EventConfig[K] extends never
            ? []
            : [payload: EventConfig[K]]
    ): void {
        const payload = args[0];
        const states = this.states();

        const handler = states["entry"];

        if (!handler) return;

        try {
            if (typeof handler === 'object') {
                const eventHandler = (handler)[event];
                if (eventHandler !== undefined) {
                    this.resolveTransition(eventHandler, payload);
                }
            }
        } catch (error) {
            console.error(
                error
            );
        }
    }

    private resolveTransition(
        result: keyof StateConfig & string | PayloadTransitionFn<keyof StateConfig & string, any, any, any>,
        payload: any
    ): void {
        if (typeof result === 'function') {
            try {
                const fnResult = (result)(payload);
            } catch (error) {
                console.error('Transition function threw an error:', error);
            }
            return;
        }

        this.applyTransition(result as keyof StateConfig & string);
    }

    private applyTransition(next: keyof StateConfig & string | Return<keyof StateConfig & string, any, any>): void {
        if (!next) {
            return;
        }

        let nextState: keyof StateConfig & string;
        let transitionData: any = undefined;

        if (typeof next === 'object' && 'state' in next) {
            nextState = next.state;
            transitionData = next.data;
        } else {
            nextState = next as keyof StateConfig & string;
        }

        const eventListeners = this.listeners[nextState];

        if (eventListeners) {
            eventListeners.forEach(cb => {
                try {
                    cb(transitionData);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            });
        }

        this.autoStep(nextState);
    }

    private async autoStep(state: string): Promise<void> {
        const handler = this.states()[state];

        if (typeof handler === 'function') {
            try {
                const maybeResult = (handler)();
                const next = maybeResult instanceof Promise ? await maybeResult : maybeResult;

                if (next && this.shouldTransition(next)) {
                    this.applyTransition(next);
                }
            } catch (e) {

            }
        }
    }

    private shouldTransition(result: keyof StateConfig & string | Return<keyof StateConfig & string, any, any>): boolean {
        return true;
    }
}
