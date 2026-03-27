import { CommandContext } from '../types';
export declare const statsCommands: {
    leaderboard: {
        name: string;
        aliases: string[];
        description: string;
        usage: string;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
    profile: {
        name: string;
        aliases: string[];
        description: string;
        usage: string;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
    mystats: {
        name: string;
        description: string;
        usage: string;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
};
export declare const tournamentCommands: {
    tourneyCreate: {
        name: string;
        description: string;
        usage: string;
        minArgs: number;
        requiredRole: string[];
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
    tourneyJoin: {
        name: string;
        description: string;
        usage: string;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
    tourneyLeave: {
        name: string;
        description: string;
        usage: string;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
    tourneyStatus: {
        name: string;
        description: string;
        usage: string;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
    tourneyBracket: {
        name: string;
        description: string;
        usage: string;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
    tourneyResult: {
        name: string;
        description: string;
        usage: string;
        minArgs: number;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
};
export declare const pvpCommands: {
    pvpscores: {
        name: string;
        aliases: string[];
        description: string;
        usage: string;
        minArgs: number;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
    pvplb: {
        name: string;
        aliases: string[];
        description: string;
        usage: string;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
    pvpstats: {
        name: string;
        aliases: string[];
        description: string;
        usage: string;
        execute: (args: string[], context: CommandContext) => Promise<void>;
    };
};
declare const _default: {
    statsCommands: {
        leaderboard: {
            name: string;
            aliases: string[];
            description: string;
            usage: string;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
        profile: {
            name: string;
            aliases: string[];
            description: string;
            usage: string;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
        mystats: {
            name: string;
            description: string;
            usage: string;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
    };
    tournamentCommands: {
        tourneyCreate: {
            name: string;
            description: string;
            usage: string;
            minArgs: number;
            requiredRole: string[];
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
        tourneyJoin: {
            name: string;
            description: string;
            usage: string;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
        tourneyLeave: {
            name: string;
            description: string;
            usage: string;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
        tourneyStatus: {
            name: string;
            description: string;
            usage: string;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
        tourneyBracket: {
            name: string;
            description: string;
            usage: string;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
        tourneyResult: {
            name: string;
            description: string;
            usage: string;
            minArgs: number;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
    };
    pvpCommands: {
        pvpscores: {
            name: string;
            aliases: string[];
            description: string;
            usage: string;
            minArgs: number;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
        pvplb: {
            name: string;
            aliases: string[];
            description: string;
            usage: string;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
        pvpstats: {
            name: string;
            aliases: string[];
            description: string;
            usage: string;
            execute: (args: string[], context: CommandContext) => Promise<void>;
        };
    };
};
export default _default;
//# sourceMappingURL=efootball.d.ts.map