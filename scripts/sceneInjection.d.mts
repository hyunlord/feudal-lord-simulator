// Types of scripts/sceneInjection.mjs (a plain module: the browser scripts import it with node, tsx code with types).
export declare const GAME_STORE_ROUTE: string;
export declare function staleStateKeys(state: object, newGame: object, codec: object): readonly string[];
export declare function admitSceneState(input: unknown, newGame: object, codec: object): unknown;
export declare function injectSceneState(moduleText: string, stateJson: string): string;
export declare function routeSceneState(page: unknown, state: unknown): Promise<void>;
export declare function sceneStateRefusal(page: unknown): Promise<never>;
