import { CommandContext, Command, UserRole } from '../types';
export declare function registerCommand(command: Command): void;
export declare function getCommand(name: string): Command | undefined;
export declare function getAllCommands(): Command[];
export declare function parseCommand(text: string): {
    name: string;
    args: string[];
} | null;
export declare function checkPermission(context: CommandContext, requiredRole?: UserRole[]): Promise<{
    allowed: boolean;
    message?: string;
}>;
declare const _default: {
    registerCommand: typeof registerCommand;
    getCommand: typeof getCommand;
    getAllCommands: typeof getAllCommands;
    parseCommand: typeof parseCommand;
    checkPermission: typeof checkPermission;
};
export default _default;
//# sourceMappingURL=commands.d.ts.map