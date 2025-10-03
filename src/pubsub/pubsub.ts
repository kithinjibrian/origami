export type Handler<Payload> = (payload: Payload, eventName?: string) => void | Promise<void>;

export class PubSub<TEvents extends Record<string, any> = Record<string, any>> {
    private static _instance: PubSub<any> | null = null;

    private subscribers: Map<string, Set<Handler<any>>> = new Map();

    private constructor() { }

    public static getInstance<T extends Record<string, any> = Record<string, any>>() {
        if (!PubSub._instance) PubSub._instance = new PubSub<T>();
        return PubSub._instance as PubSub<T>;
    }

    public subscribe<K extends keyof TEvents & string>(
        eventName: K | '*',
        handler: Handler<K extends keyof TEvents ? TEvents[K] : any>
    ) {
        const key = String(eventName);
        let set = this.subscribers.get(key);
        if (!set) {
            set = new Set();
            this.subscribers.set(key, set);
        }
        set.add(handler as Handler<any>);
        return () => this.unsubscribe(key, handler as Handler<any>);
    }

    public unsubscribe<K extends keyof TEvents & string>(eventName: K | string, handler?: Handler<any>) {
        const key = String(eventName);
        if (!this.subscribers.has(key)) return;
        if (!handler) {
            this.subscribers.delete(key);
            return;
        }
        const set = this.subscribers.get(key)!;
        set.delete(handler as Handler<any>);
        if (set.size === 0) this.subscribers.delete(key);
    }

    public once<K extends keyof TEvents & string>(
        eventName: K | '*',
        handler: Handler<K extends keyof TEvents ? TEvents[K] : any>
    ) {
        const wrapper: Handler<any> = (payload, evt) => {
            try {
                (handler as Handler<any>)(payload, evt);
            } finally {
                this.unsubscribe(String(eventName), wrapper);
            }
        };
        return this.subscribe(eventName, wrapper as Handler<any>);
    }

    public async publish<K extends keyof TEvents & string>(eventName: K | string, payload: TEvents[K] | any) {
        const key = String(eventName);
        const handlers: Handler<any>[] = [];

        const set = this.subscribers.get(key);
        if (set) handlers.push(...Array.from(set));

        const wildcard = this.subscribers.get('*');
        if (wildcard) handlers.push(...Array.from(wildcard));

        if (handlers.length === 0) return;

        await Promise.allSettled(handlers.map(h => Promise.resolve().then(() => h(payload, key))));
    }

    public clear(eventName?: keyof TEvents | string) {
        if (eventName == null) {
            this.subscribers.clear();
            return;
        }
        this.subscribers.delete(String(eventName));
    }

    public debugSnapshot() {
        const out: Record<string, number> = {};
        for (const [k, v] of this.subscribers.entries()) out[k] = v.size;
        return out;
    }
}