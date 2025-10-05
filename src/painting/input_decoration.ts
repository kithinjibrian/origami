import { Reactive } from "../types/__init__"
import { Widget } from "../widgets/__init__"
import { Color } from "./color"
import { TextStyle } from "./text_style"

interface InputDecorationParams {
    icon?: Widget
    iconColor?: Reactive<Color>
    label?: Widget
    labelText?: Reactive<string>
    labelStyle?: TextStyle
    helper?: Widget
    helperText?: Reactive<string>
    helperStyle?: TextStyle
    hint?: Widget
    hintText?: Reactive<string>
    hintStyle?: TextStyle
}

export class InputDecoration {
    icon?: Widget
    iconColor?: Reactive<Color>
    label?: Widget
    labelText?: Reactive<string>
    labelStyle?: TextStyle
    helper?: Widget
    helperText?: Reactive<string>
    helperStyle?: TextStyle
    hint?: Widget
    hintText?: Reactive<string>
    hintStyle?: TextStyle

    constructor({
        icon,
        iconColor,
        label,
        labelText,
        labelStyle,
        helper,
        helperText,
        helperStyle,
        hint,
        hintText,
        hintStyle
    }: InputDecorationParams = {}) {
        this.icon = icon;
        this.iconColor = iconColor;
        this.label = label;
        this.labelText = labelText;
        this.labelStyle = labelStyle;
        this.helper = helper;
        this.helperText = helperText;
        this.helperStyle = helperStyle;
        this.hint = hint;
        this.hintText = hintText;
        this.hintStyle = hintStyle;
    }
}