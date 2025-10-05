import { InputDecoration } from "../painting/__init__";
import { Reactive } from "../types/__init__";
import { resolveReactive } from "../utils/__init__";

import {
    BuildContext,
    DataMutable,
    MutableWidget,
    Signal,
    Widget,
} from "./framework";

interface TextFieldParams {
    value?: Reactive<string>
    onInput?: (data: string) => void
    signal?: Signal<string>,
    obscureText?: Reactive<boolean>,
    readOnly?: Reactive<boolean>,
    decoration?: InputDecoration
}

export class TextField extends MutableWidget {
    value?: Reactive<string>;
    onInput?: (data: string) => void;
    signal?: Signal<string>;
    obscureText?: Reactive<boolean>;
    readOnly?: Reactive<boolean>;
    decoration?: InputDecoration;

    constructor({
        value,
        onInput,
        signal,
        obscureText,
        readOnly,
        decoration
    }: TextFieldParams = {}) {
        super();

        this.value = value;
        this.onInput = onInput;
        this.signal = signal;
        this.obscureText = obscureText;
        this.readOnly = readOnly;
        this.decoration = decoration;
    }

    createMutable(): DataMutable<this> {
        return new TextFieldMutable(this);
    }
}

class TextFieldMutable<T extends TextField> extends DataMutable<T> {
    constructor(widget: T) {
        super(widget);
    }

    build(context: BuildContext): Widget {
        throw new Error("Can't build leaf widget");
    }

    renderLeaf(context: BuildContext): HTMLElement {
        const container = document.createElement('div');

        const wrapper = document.createElement('div');

        const input = document.createElement('input');
        input.type = resolveReactive(this.widget.obscureText) ? 'password' : 'text';
        input.readOnly = !!resolveReactive(this.widget.readOnly);

        if (this.widget.signal) {
            input.value = this.widget.signal.value;
            input.addEventListener('input', e => {
                this.widget.signal!.value = (e.target as HTMLInputElement).value;
            });
        } else {
            const initial = resolveReactive(this.widget.value);
            if (initial !== undefined) input.value = initial;
            if (this.widget.onInput) {
                input.addEventListener('input', e => {
                    this.widget.onInput!((e.target as HTMLInputElement).value);
                });
            }
        }

        wrapper.appendChild(input);
        container.appendChild(wrapper);

        return container;
    }

}