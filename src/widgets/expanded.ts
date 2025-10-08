import { Widget } from "./framework";
import { Flexible } from "./flexible";
import { FlexFit } from "../rendering/__init__";

export class Expanded extends Flexible {
    constructor(
        child: Widget,
        { key, flex = 1 }: { key?: string; flex?: number } = {}
    ) {
        super(child, { key, flex, fit: FlexFit.tight });
    }
}
