import { BuildContext, InheritedWidget, StateMutable, Widget } from "../../../widgets/__init__";
import { Router } from "../../__init__";

type IsVoidLike<T> = T extends void | undefined | never ? true : false;

export class Navigate extends InheritedWidget {
    constructor(
        child: Widget
    ) {
        super(child);
    }

    static to<
        Events extends Record<string, any>,
        E extends keyof Events & string
    >(
        context: BuildContext,
        page: E,
        ...args: IsVoidLike<Events[E]> extends true ? [] | [payload?: Events[E]] : [payload: Events[E]]
    ) {
        let result = context.dependOnInheritedWidgetOfExactTypeRequired(Navigate);

        if (!(result.child instanceof Router)) {
            throw new Error("Child of navigate is not Router")
        }

        let router = result.child as Router<any, any>

        (router.mutable as StateMutable<any, any, any>).send(page, args);

        return result;
    }

    updateShouldNotify(old_widget: InheritedWidget): boolean {
        return true;
    }
}