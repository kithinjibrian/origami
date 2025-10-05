import { BuildContext, InheritedWidget, StateMutable, Widget } from "../../../widgets/__init__";
import { Router } from "../../__init__";

export class Navigate extends InheritedWidget {
    constructor(
        child: Widget
    ) {
        super(child);
    }

    static to<
        Events extends string,
        Payloads extends Partial<Record<Events, unknown>>,
        E extends Events
    >(
        context: BuildContext,
        page: E,
        ...args:
            E extends keyof Payloads
            ? Payloads[E] extends never
            ? []
            : [payload: Payloads[E]]
            : []
    ) {
        let result = context.dependOnInheritedWidgetOfExactTypeRequired(Navigate);

        if (!(result.child instanceof Router)) {
            throw new Error("Child of navigate is not Router")
        }

        let router = result.child as Router<any, any>

        (router.mutable as StateMutable<any, any, any, Payloads>).send(page, ...args);

        return result;
    }

    updateShouldNotify(old_widget: InheritedWidget): boolean {
        return true;
    }
}