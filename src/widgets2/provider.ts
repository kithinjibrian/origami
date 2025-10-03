import { BuildContext, ImmutableWidget, Type, Widget } from "./framework";

interface ProviderParams<T> {
    type: Type<T>,
    instance: T,
    key?: string,
}

export class Provider<T> extends ImmutableWidget {
    type: Type<T>;
    instance: T;

    constructor(private child: Widget, { type, instance, key }: ProviderParams<T>) {
        super({ key });

        this.type = type;
        this.instance = instance;
    }

    build(context: BuildContext): Widget {
        context.provide(this.type, this.instance);
        return this.child;
    }
}