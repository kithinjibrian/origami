export function Store<T extends { new(...args: any[]): {} }>(constructor: T) {
    let instance: any;

    const newConstructor: any = function (...args: any[]) {
        if (!instance) {
            instance = new constructor(...args);
        }
        return instance;
    };

    newConstructor.prototype = constructor.prototype;

    return newConstructor;
}
