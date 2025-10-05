import { BuildContext, ImmutableWidget, Type, Widget } from "./framework";
import { Provider } from "./provider";

interface MultiProviderParams {
    providers: Array<{
        type: Type<any>,
        instance: any,
    }>,
    key?: string,
}

export class MultiProvider extends ImmutableWidget {
    providers: Array<{
        type: Type<any>,
        instance: any,
    }>;

    constructor(private child: Widget, { providers, key }: MultiProviderParams) {
        super({ key });

        this.providers = providers;
    }

    build(context: BuildContext): Widget {
        return this.providers.reduceRight(
            (child, provider) => new Provider(child, provider),
            this.child
        );
    }
}
