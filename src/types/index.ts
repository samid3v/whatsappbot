// User roles in the bot
export type UserRole = 'owner' | 'admin' | 'moderator' | 'member';

// Tournament types
export type TournamentType = 'single_elimination' | 'double_elimination' | 'round_robin';

// Tournament status
export type TournamentStatus = 'setup' | 'registration' | 'in_progress' | 'completed';

// Match status
export type MatchStatus = 'pending' | 'in_progress' | 'completed';

// Poll status
export type PollStatus = 'active' | 'ended';

// Challenge submission status
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

// User in the database
export interface User {
    id: number;
    jid: string;
    name: string | null;
    role: UserRole;
    warnings: number;
    is_muted: number;
    mute_expires_at: string | null;
    created_at: string;
}

// Player stats
export interface PlayerStats {
    id: number;
    user_jid: string;
    wins: number;
    losses: number;
    draws: number;
    goals_scored: number;
    goals_conceded: number;
    tournaments_won: number;
    tournaments_played: number;
    challenge_completed: number;
    updated_at: string;
}

// Tournament
export interface Tournament {
    id: number;
    name: string;
    type: TournamentType;
    status: TournamentStatus;
    max_players: number | null;
    created_by: string;
    created_at: string;
    started_at: string | null;
    ended_at: string | null;
}

// Tournament participant
export interface TournamentParticipant {
    id: number;
    tournament_id: number;
    user_jid: string;
    status: string;
    seed: number | null;
}

// Tournament match
export interface TournamentMatch {
    id: number;
    tournament_id: number;
    player1_jid: string;
    player2_jid: string | null;
    player1_score: number | null;
    player2_score: number | null;
    winner_jid: string | null;
    round_number: number;
    match_number: number;
    status: MatchStatus;
    scheduled_at: string | null;
}

// Scheduled match
export interface ScheduledMatch {
    id: number;
    challenger_jid: string;
    opponent_jid: string;
    scheduled_at: string | null;
    status: MatchStatus;
    created_at: string;
}

// Poll
export interface Poll {
    id: number;
    question: string;
    options: string; // JSON string array
    votes: string; // JSON string object {option: count}
    created_by: string;
    ends_at: string | null;
    created_at: string;
}

// Daily challenge
export interface DailyChallenge {
    id: number;
    challenge: string;
    description: string | null;
    date: string;
    created_at: string;
}

// Challenge submission
export interface ChallengeSubmission {
    id: number;
    challenge_id: number;
    user_jid: string;
    proof: string | null;
    status: SubmissionStatus;
    submitted_at: string;
}

// Bot configuration
export interface BotConfig {
    commandPrefix: string;
    warnThreshold: number;
    muteDurationHours: number;
    sessionPath: string;
    dataPath: string;
}

// Command context
export interface CommandContext {
    jid: string;
    name: string;
    isGroup: boolean;
    isAdmin: boolean;
    isOwner: boolean;
    isModerator: boolean;
    senderJid: string;
}

// Command definition
export interface Command {
    name: string;
    description: string;
    usage: string;
    aliases?: string[];
    minArgs?: number;
    requiredRole?: UserRole[];
    execute: (args: string[], context: CommandContext) => Promise<void>;
}
