// ==================== MODERN MESSAGE FORMATTING ====================

const SEPARATOR = '━━━━━━━━━━━━━━━━━━━━━━━━';
const DIVIDER = '─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─';

// Convert text to 𝚖𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎 𝚋𝚘𝚕𝚍 (Unicode math sans-serif)
function monoBold(text: string): string {
    const map: Record<string, string> = {
        'A': '𝙰', 'B': '𝙱', 'C': '𝙲', 'D': '𝙳', 'E': '𝙴', 'F': '𝙵', 'G': '𝙶',
        'H': '𝙷', 'I': '𝙸', 'J': '𝙹', 'K': '𝙺', 'L': '𝙻', 'M': '𝙼', 'N': '𝙽',
        'O': '𝙾', 'P': '𝙿', 'Q': '𝚀', 'R': '𝚁', 'S': '𝚂', 'T': '𝚃', 'U': '𝚄',
        'V': '𝚅', 'W': '𝚆', 'X': '𝚇', 'Y': '𝚈', 'Z': '𝚉',
        'a': '𝚊', 'b': '𝚋', 'c': '𝚌', 'd': '𝚍', 'e': '𝚎', 'f': '𝚏', 'g': '𝚐',
        'h': '𝚑', 'i': '𝚒', 'j': '𝚓', 'k': '𝚔', 'l': '𝚕', 'm': '𝚖', 'n': '𝚗',
        'o': '𝚘', 'p': '𝚙', 'q': '𝚚', 'r': '𝚛', 's': '𝚜', 't': '𝚝', 'u': '𝚞',
        'v': '𝚟', 'w': '𝚠', 'x': '𝚡', 'y': '𝚢', 'z': '𝚣',
        '0': '𝟶', '1': '𝟷', '2': '𝟸', '3': '𝟹', '4': '𝟺',
        '5': '𝟻', '6': '𝟼', '7': '𝟽', '8': '𝟾', '9': '𝟿',
    };
    return text.split('').map(c => map[c] || c).join('');
}

// Build a formatted message
function build(emoji: string, title: string, fields: string[], footer?: string): string {
    let msg = `${emoji} ${monoBold(title)} ${emoji}\n`;
    msg += SEPARATOR + '\n';
    msg += fields.join('\n');
    if (footer) {
        msg += '\n' + DIVIDER + '\n';
        msg += footer;
    }
    return msg;
}

// Build a field line: "𝙻𝙰𝙱𝙴𝙻: value"
function field(label: string, value: string | number): string {
    return `${monoBold(label)}: ${value}`;
}

// ==================== MESSAGE TEMPLATES ====================

export const msg = {
    // ── Moderation ──
    muted(userName: string, reason: string, duration: string, expiresAt: string, mention: string): string {
        return `🔇 ${monoBold('USER MUTED')} 🔇\n` +
            SEPARATOR + '\n' +
            `${field('𝚄𝚂𝙴𝚁', `@~~ ${userName}`)}\n` +
            `${field('𝚁𝙴𝙰𝚂𝙾𝙽', reason)}\n` +
            `${field('𝙳𝚄𝚁𝙰𝚃𝙸𝙾𝙽', duration)}\n` +
            `${field('𝙴𝚇𝙿𝙸𝚁𝙴𝚂', expiresAt)}\n` +
            SEPARATOR + '\n' +
            `⚠️ Messages will be deleted while muted!\n` +
            `🚫 Repeated messages = group removal`;
    },

    unmuted(userName: string): string {
        return `🔊 ${monoBold('USER UNMUTED')} 🔊\n` +
            SEPARATOR + '\n' +
            `${field('𝚄𝚂𝙴𝚁', `@~~ ${userName}`)}\n` +
            `${field('𝚂𝚃𝙰𝚃𝚄𝚂', 'Unmuted ✅')}\n` +
            `${field('𝚁𝙴𝚂𝚄𝙻𝚃', 'Can send messages again')}`;
    },

    muteInfo(userName: string, remaining?: string, expiresAt?: string): string {
        const fields = [`${field('𝚄𝚂𝙴𝚁', `@~~ ${userName}`)}`];
        if (remaining) fields.push(`${field('𝚁𝙴𝙼𝙰𝙸𝙽𝙸𝙽𝙶', remaining)}`);
        if (expiresAt) fields.push(`${field('𝙴𝚇𝙿𝙸𝚁𝙴𝚂', expiresAt)}`);
        if (!remaining && !expiresAt) fields.push(`${field('𝙳𝚄𝚁𝙰𝚃𝙸𝙾𝙽', 'Indefinite 🔒')}`);
        return build('🔇', 'MUTE INFO', fields);
    },

    muteTimeAdjusted(userName: string, previous: string, newDuration: string, expiresAt: string): string {
        return build('⏱️', 'MUTE ADJUSTED', [
            `${field('𝚄𝚂𝙴𝚁', `@~~ ${userName}`)}`,
            `${field('𝙿𝚁𝙴𝚅𝙸𝙾𝚄𝚂', previous + ' min')}`,
            `${field('𝙽𝙴𝚆', newDuration + ' min')}`,
            `${field('𝙴𝚇𝙿𝙸𝚁𝙴𝚂', expiresAt)}`,
        ]);
    },

    warningIssued(userName: string, reason: string, warnings: number, threshold: number, autoMuted: boolean): string {
        const fields = [
            `${field('𝚄𝚂𝙴𝚁', `@~~ ${userName}`)}`,
            `${field('𝚁𝙴𝙰𝚂𝙾𝙽', reason)}`,
            `${field('𝚆𝙰𝚁𝙽𝙸𝙽𝙶𝚂', `${warnings}/${threshold}`)}`,
        ];
        const footer = autoMuted ? '🚫 Auto-muting triggered!' : undefined;
        return build('⚠️', 'WARNING ISSUED', fields, footer);
    },

    warningsCheck(userName: string, warnings: number, threshold: number): string {
        return build('📊', 'WARNING CHECK', [
            `${field('𝚄𝚂𝙴𝚁', `@~~ ${userName}`)}`,
            `${field('𝚆𝙰𝚁𝙽𝙸𝙽𝙶𝚂', `${warnings}/${threshold}`)}`,
        ]);
    },

    userKicked(userName: string, reason: string): string {
        return build('🚫', 'USER REMOVED', [
            `${field('𝚄𝚂𝙴𝚁', `@~~ ${userName}`)}`,
            `${field('𝚁𝙴𝙰𝚂𝙾𝙽', reason)}`,
        ]);
    },

    userRemoved(): string {
        return `👋 ${monoBold('REMOVED')}\n` +
            `${field('𝚂𝚃𝙰𝚃𝚄𝚂', 'User has been removed from the group')}`;
    },

    promoted(userName: string, role: string): string {
        return build('⬆️', 'PROMOTED', [
            `${field('𝚄𝚂𝙴𝚁', `@~~ ${userName}`)}`,
            `${field('𝙽𝙴𝚆 𝚁𝙾𝙻𝙴', role)}`,
        ]);
    },

    demoted(userName: string, role: string): string {
        return build('⬇️', 'DEMOTED', [
            `${field('𝚄𝚂𝙴𝚁', `@~~ ${userName}`)}`,
            `${field('𝙽𝙴𝚆 𝚁𝙾𝙻𝙴', role)}`,
        ]);
    },

    // ── Link / Mute Spam ──
    muteWarning(remaining: number): string {
        return `⚠️ ${monoBold('MUTE WARNING')} ⚠️\n` +
            SEPARATOR + '\n' +
            `You have violated the mute!\n` +
            `${field('𝚁𝙴𝙼𝙰𝙸𝙽𝙸𝙽𝙶', `${remaining} more = group removal`)}`;
    },

    linkWarning(linkCount: number): string {
        return `🔗 ${monoBold('LINK DETECTED')} 🔗\n` +
            SEPARATOR + '\n' +
            `Links are not allowed!\n` +
            `${field('𝙻𝙸𝙽𝙺𝚂', `${linkCount}/5`)}\n` +
            `${field('𝚆𝙰𝚁𝙽𝙸𝙽𝙶𝚂', '1-2 = warn')}\n` +
            `${field('𝙼𝚄𝚃𝙴', '3-4 = mute')}\n` +
            `${field('𝙺𝙸𝙲𝙺', '5+ = removed')}`;
    },

    linkSpamKicked(linkCount: number): string {
        return build('🚫', 'LINK SPAM', [
            `${field('𝙻𝙸𝙽𝙺𝚂', `${linkCount} links posted`)}`,
            `${field('𝙰𝙲𝚃𝙸𝙾𝙽', 'Removed from group')}`,
        ]);
    },

    // ── PVP ──
    matchSubmitted(matchId: number, p1: string, s1: number, s2: number, p2: string, hasProof: boolean = false): string {
        return `⚽ ${monoBold('MATCH SUBMITTED')} ⚽\n` +
            SEPARATOR + '\n' +
            `${field('𝙼𝙰𝚃𝙲𝙷', `#${matchId}`)}\n` +
            `${field('𝙿𝙻𝙰𝚈𝙴𝚁𝚂', `${p1} vs ${p2}`)}\n` +
            `${field('𝚂𝙲𝙾𝚁𝙴', `${s1} - ${s2}`)}\n` +
            SEPARATOR + '\n' +
            `⏳ Awaiting Admin Approval\n` +
            `${field('𝙸𝙳', `#${matchId}`)}\n` +
            `${field('𝙿𝚁𝙾𝙾𝙵', hasProof ? '📸 Attached' : '❌ No screenshot')}\n` +
            `\n💡 Admins: .pvpapprove ${matchId} or .pvpreject ${matchId} <reason>`;
    },

    matchApproved(matchId: number, p1: string, s1: number, s2: number, p2: string, result: string, p1Points: string, p2Points: string, adminName: string): string {
        return `✅ ${monoBold('MATCH APPROVED')} ⚽\n` +
            SEPARATOR + '\n' +
            `${field('𝙼𝙰𝚃𝙲𝙷', `#${matchId}`)}\n` +
            `${field('𝚂𝙲𝙾𝚁𝙴', `${p1} ${s1} - ${s2} ${p2}`)}\n` +
            `${field('𝚁𝙴𝚂𝚄𝙻𝚃', result)}\n` +
            DIVIDER + '\n' +
            `📊 Points: ${p1} (${p1Points}) | ${p2} (${p2Points})\n` +
            `${field('𝙰𝙿𝙿𝚁𝙾𝚅𝙴𝙳 𝙱𝚈', adminName)}`;
    },

    tourneyMatchSubmitted(matchId: number, p1: string, s1: number, s2: number, p2: string, tourneyName: string, round: number, hasProof: boolean): string {
        return `⚽ ${monoBold('TOURNEY MATCH SUBMITTED')} ⚽\n` +
            SEPARATOR + '\n' +
            `${field('𝙼𝙰𝚃𝙲𝙷', `#${matchId}`)}\n` +
            `${field('𝚃𝙾𝚄𝚁𝙽𝙰𝙼𝙴𝙽𝚃', tourneyName)}\n` +
            `${field('𝚁𝙾𝚄𝙽𝙳', round)}\n` +
            `${field('𝙿𝙻𝙰𝚈𝙴𝚁𝚂', `${p1} vs ${p2}`)}\n` +
            `${field('𝚂𝙲𝙾𝚁𝙴', `${s1} - ${s2}`)}\n` +
            SEPARATOR + '\n' +
            `⏳ Awaiting Admin Approval\n` +
            `${field('𝙿𝚁𝙾𝙾𝙵', hasProof ? '📸 Attached' : '❌ No screenshot — may be rejected!')}\n` +
            `\n💡 Admins: .tapprove ${matchId} or .treject ${matchId} <reason>`;
    },

    tourneyMatchApproved(matchId: number, p1: string, s1: number, s2: number, p2: string, result: string, tourneyName: string, adminName: string): string {
        return `✅ ${monoBold('TOURNEY MATCH APPROVED')} ⚽\n` +
            SEPARATOR + '\n' +
            `${field('𝙼𝙰𝚃𝙲𝙷', `#${matchId}`)}\n` +
            `${field('𝚃𝙾𝚄𝚁𝙽𝙰𝙼𝙴𝙽𝚃', tourneyName)}\n` +
            `${field('𝚂𝙲𝙾𝚁𝙴', `${p1} ${s1} - ${s2} ${p2}`)}\n` +
            `${field('𝚁𝙴𝚂𝚄𝙻𝚃', result)}\n` +
            SEPARATOR + '\n' +
            `${field('𝙰𝙿𝙿𝚁𝙾𝚅𝙴𝙳 𝙱𝚈', adminName)}\n` +
            `📊 Standings updated`;
    },

    tourneyMatchRejected(matchId: number, p1: string, s1: number, s2: number, p2: string, reason: string, tourneyName: string, adminName: string): string {
        return `❌ ${monoBold('TOURNEY MATCH REJECTED')} ❌\n` +
            SEPARATOR + '\n' +
            `${field('𝙼𝙰𝚃𝙲𝙷', `#${matchId}`)}\n` +
            `${field('𝚃𝙾𝚄𝚁𝙽𝙰𝙼𝙴𝙽𝚃', tourneyName)}\n` +
            `${field('𝚂𝙲𝙾𝚁𝙴', `${p1} ${s1} - ${s2} ${p2}`)}\n` +
            `${field('𝚁𝙴𝙰𝚂𝙾𝙽', reason)}\n` +
            `${field('𝚁𝙴𝙹𝙴𝙲𝚃𝙴𝙳 𝙱𝚈', adminName)}\n` +
            SEPARATOR + '\n' +
            `🔄 Players must replay this match`;
    },

    matchRejected(matchId: number, p1: string, s1: number, s2: number, p2: string, reason: string, adminName: string): string {
        return `❌ ${monoBold('MATCH REJECTED')} ❌\n` +
            SEPARATOR + '\n' +
            `${field('𝙼𝙰𝚃𝙲𝙷', `#${matchId}`)}\n` +
            `${field('𝚂𝙲𝙾𝚁𝙴', `${p1} ${s1} - ${s2} ${p2}`)}\n` +
            `${field('𝚁𝙴𝙰𝚂𝙾𝙽', reason)}\n` +
            `${field('𝚁𝙴𝙹𝙴𝙲𝚃𝙴𝙳 𝙱𝚈', adminName)}\n` +
            `${field('𝚂𝚃𝙰𝚃𝚂', 'No stats updated')}`;
    },

    matchNotFound(matchId: number): string {
        return `❌ ${monoBold('NOT FOUND')}\n` +
            `Match #${matchId} does not exist.`;
    },

    matchAlreadyProcessed(matchId: number, status: string): string {
        return `❌ ${monoBold('ALREADY PROCESSED')}\n` +
            `Match #${matchId} is already ${status}.`;
    },

    pendingMatches(matches: string): string {
        return build('📋', 'PVP QUEUE', [
            matches,
        ], '✅ .pvpapprove <id> — Approve\n❌ .pvpreject <id> <reason> — Reject');
    },

    pendingMatchesEmpty(): string {
        return build('📋', 'PVP QUEUE', [
            'No matches waiting for approval.',
        ]);
    },

    pvpLeaderboard(table: string, count: number): string {
        return `🏆 ${monoBold('PVP LEADERBOARD')} 🏆\n` +
            SEPARATOR + '\n' +
            `${field('𝚃𝙾𝙿', `${count} Players`)}\n` +
            DIVIDER + '\n' +
            table + '\n' +
            DIVIDER + '\n' +
            `📈 Win=3 | Draw=1 | Loss=0`;
    },

    pvpLeaderboardEmpty(): string {
        return build('📊', 'PVP LEADERBOARD', [
            'No matches recorded yet!',
        ], 'Use .pvpscores to record a match');
    },

    pvpProfile(name: string, stats: string, recentMatches: string): string {
        return `👤 ${monoBold(`${name.toUpperCase()}'S PROFILE`)} 👤\n` +
            SEPARATOR + '\n' +
            stats + '\n' +
            SEPARATOR + '\n' +
            `📋 ${monoBold('RECENT MATCHES')}\n` +
            DIVIDER + '\n' +
            recentMatches;
    },

    pvpProfileStats(pts: number, wins: number, draws: number, losses: number, gf: number, ga: number, played: number): string {
        return `${field('𝙿𝙾𝙸𝙽𝚃𝚂', pts)}\n` +
            `${field('𝚆𝙸𝙽𝚂', wins)}\n` +
            `${field('𝙳𝚁𝙰𝚆𝚂', draws)}\n` +
            `${field('𝙻𝙾𝚂𝚂𝙴𝚂', losses)}\n` +
            `${field('𝙶𝙾𝙰𝙻𝚂 𝙵𝙾𝚁', gf)}\n` +
            `${field('𝙶𝙾𝙰𝙻𝚂 𝙰𝙶𝙰𝙸𝙽𝚂𝚃', ga)}\n` +
            `${field('𝙼𝙰𝚃𝙲𝙷𝙴𝚂', played)}`;
    },

    // ── Tournament ──
    tournamentCreated(name: string, type: string, maxPlayers: number | null): string {
        return build('🏆', 'TOURNAMENT CREATED', [
            `${field('𝙽𝙰𝙼𝙴', name)}`,
            `${field('𝚃𝚈𝙿𝙴', type)}`,
            `${field('𝙼𝙰𝚇 𝙿𝙻𝙰𝚈𝙴𝚁𝚂', maxPlayers || 'Unlimited')}`,
        ], 'Use .tj to join!');
    },

    tournamentJoined(name: string, count: number): string {
        return `✅ ${monoBold('JOINED TOURNAMENT')}\n` +
            SEPARATOR + '\n' +
            `${field('𝙽𝙰𝙼𝙴', name)}\n` +
            `${field('𝙿𝙻𝙰𝚈𝙴𝚁𝚂', `${count} registered`)}`;
    },

    tournamentLeft(name: string): string {
        return `🚪 ${monoBold('LEFT TOURNAMENT')}\n` +
            SEPARATOR + '\n' +
            `${field('𝙽𝙰𝙼𝙴', name)}`;
    },

    tournamentStatus(name: string, status: string, playerCount: number): string {
        return build('🏆', 'TOURNAMENT STATUS', [
            `${field('𝙽𝙰𝙼𝙴', name)}`,
            `${field('𝚂𝚃𝙰𝚃𝚄𝚂', status)}`,
            `${field('𝙿𝙻𝙰𝚈𝙴𝚁𝚂', `${playerCount}`)}`,
        ]);
    },

    tournamentBracket(name: string, rounds: string): string {
        return `📊 ${monoBold(`BRACKET — ${name.toUpperCase()}`)} 📊\n` +
            SEPARATOR + '\n' +
            rounds;
    },

    tournamentResult(myScore: number, oppScore: number, winner: string): string {
        const result = myScore > oppScore ? '🏆 You win!' : myScore < oppScore ? '😔 You lose' : '🤝 Draw';
        return build('⚽', 'MATCH RESULT', [
            `${field('𝚂𝙲𝙾𝚁𝙴', `${myScore} - ${oppScore}`)}`,
            `${field('𝚁𝙴𝚂𝚄𝙻𝚃', result)}`,
            `${field('𝚆𝙸𝙽𝙽𝙴𝚁', winner)}`,
        ]);
    },

    // ── Stats ──
    statsProfile(name: string, wins: number, losses: number, draws: number, winRate: number,
        goalsScored: number, goalsConceded: number, avgGoals: number,
        tournamentsWon: number, tournamentsPlayed: number, challengesCompleted: number): string {
        return `👤 ${monoBold(`${name.toUpperCase()}'S PROFILE`)} 👤\n` +
            SEPARATOR + '\n' +
            `📊 ${monoBold('MATCH STATS')}\n` +
            `${field('𝚆𝚒𝚗𝚜', wins)}\n` +
            `${field('𝙻𝚘𝚜𝚜𝚎𝚜', losses)}\n` +
            `${field('𝙳𝚛𝚊𝚠𝚜', draws)}\n` +
            `${field('𝚠𝚒𝚗 𝚛𝚊𝚝𝚎', `${winRate}%`)}\n` +
            DIVIDER + '\n' +
            `⚽ ${monoBold('GOALS')}\n` +
            `${field('𝚂𝚌𝚘𝚛𝚎𝚍', goalsScored)}\n` +
            `${field('𝙲𝚘𝚗𝚌𝚎𝚍𝚎𝚍', goalsConceded)}\n` +
            `${field('𝙰𝚟𝚐', `${avgGoals}/match`)}\n` +
            DIVIDER + '\n' +
            `🏆 ${monoBold('TOURNAMENTS')}\n` +
            `${field('𝚆𝚘𝚗', tournamentsWon)}\n` +
            `${field('𝙿𝚕𝚊𝚢𝚎𝚍', tournamentsPlayed)}\n` +
            DIVIDER + '\n' +
            `🎯 ${monoBold('CHALLENGES')}\n` +
            `${field('𝙲𝚘𝚖𝚙𝚕𝚎𝚝𝚎𝚍', challengesCompleted)}`;
    },

    leaderboard(entries: string): string {
        return `🏆 ${monoBold('LEADERBOARD')} 🏆\n` +
            SEPARATOR + '\n' +
            entries;
    },

    leaderboardEmpty(): string {
        return build('📊', 'LEADERBOARD', [
            'No players yet!',
        ], 'Start playing to appear here');
    },

    // ── General / System ──
    permissionDenied(requiredRole: string): string {
        return `🔒 ${monoBold('ACCESS DENIED')}\n` +
            SEPARATOR + '\n' +
            `${field('𝚁𝙴𝚀𝚄𝙸𝚁𝙴𝙳', `At least ${requiredRole}`)}`;
    },

    unknownCommand(commandName: string): string {
        return `❓ ${monoBold('UNKNOWN COMMAND')}\n` +
            SEPARATOR + '\n' +
            `${field('𝙲𝙾𝙼𝙼𝙰𝙽𝙳', commandName)}\n` +
            `Use .help for available commands`;
    },

    usage(cmdUsage: string): string {
        return `📋 ${monoBold('USAGE')}\n` +
            SEPARATOR + '\n' +
            cmdUsage;
    },

    error(): string {
        return `⚠️ ${monoBold('ERROR')}\n` +
            SEPARATOR + '\n' +
            'Something went wrong. Try again.';
    },

    settings(prefix: string, warnThreshold: number, muteDuration: number): string {
        return build('⚙️', 'BOT SETTINGS', [
            `${field('𝙿𝚁𝙴𝙵𝙸𝚇', prefix)}`,
            `${field('𝚆𝙰𝚁𝙽 𝙻𝙸𝙼𝙸𝚃', warnThreshold)}`,
            `${field('𝙼𝚄𝚃𝙴 𝙳𝚄𝚁𝙰𝚃𝙸𝙾𝙽', `${muteDuration}h`)}`,
        ]);
    },

    groupInfo(name: string, members: number, created: string): string {
        return build('📋', 'GROUP INFO', [
            `${field('𝙽𝙰𝙼𝙴', name)}`,
            `${field('𝙼𝙴𝙼𝙱𝙴𝚁𝚂', members)}`,
            `${field('𝙲𝚁𝙴𝙰𝚃𝙴𝙳', created)}`,
        ]);
    },

    helpCommand(name: string, description: string, usage: string): string {
        return `📖 ${monoBold(name.toUpperCase())}\n` +
            SEPARATOR + '\n' +
            `${field('𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽', description)}\n` +
            `${field('𝚄𝚂𝙰𝙶𝙴', usage)}`;
    },

    helpGeneral(categories: string): string {
        return `📖 ${monoBold('COMMANDS')} 📖\n` +
            SEPARATOR + '\n' +
            categories + '\n' +
            SEPARATOR + '\n' +
            `💡 Use .help [command] for details`;
    },

    sessionInit(): string {
        return `🔄 ${monoBold('INITIALIZING')}\n` +
            'Setting up bot session...';
    },

    tagAll(message: string): string {
        return `📢 ${monoBold('ATTENTION')}\n` +
            SEPARATOR + '\n' +
            message;
    },

    // ── Error Helpers ──
    missingMention(usage: string): string {
        return `❌ ${monoBold('MISSING TARGET')}\n` +
            SEPARATOR + '\n' +
            `Mention a user or reply to their message\n` +
            `${field('𝚄𝚂𝙰𝙶𝙴', usage)}`;
    },

    invalidScore(): string {
        return `❌ ${monoBold('INVALID SCORE')}\n` +
            `Use format: 3:1 or 3-1`;
    },

    invalidFormat(examples: string): string {
        return `❌ ${monoBold('INVALID FORMAT')}\n` +
            SEPARATOR + '\n' +
            examples;
    },

    proofRequired(): string {
        return `📸 ${monoBold('PROOF REQUIRED')} 📸\n` +
            SEPARATOR + '\n' +
            'Attach a screenshot of the match result!\n\n' +
            '1. Take a screenshot of your eFootball result\n' +
            '2. Attach the image with caption:\n\n' +
            '   .pvpscores @user1 vs @user2 3:1\n' +
            '   .vs @opponent 3:1\n' +
            '   .25412345678 vs 25487654321 2:0\n\n' +
            '⚠️ No screenshot = No record!';
    },

    selfMatch(): string {
        return `❌ ${monoBold('INVALID MATCH')}\n` +
            `You can't play against yourself!`;
    },

    unresolvedPlayers(): string {
        return `❌ ${monoBold('PLAYERS NOT FOUND')}\n` +
            SEPARATOR + '\n' +
            `Options:\n` +
            `• @mention players: @user1 vs @user2\n` +
            `• Use "me" or skip: .vs @opponent\n` +
            `• Use phone numbers: 25412345678 vs 25487654321\n\n` +
            `💡 If tagging doesn't work, use phone number`;
    },

    tournamentInvalidType(): string {
        return `❌ ${monoBold('INVALID TYPE')}\n` +
            `Options: se (knockout) | de (double elim) | rr (league 1 leg) | rr2 (league 2 legs)`;
    },

    noActiveTournament(): string {
        return `❌ ${monoBold('NO TOURNAMENTS')}\n` +
            `No active tournaments. Use .tcr to create!`;
    },

    registrationClosed(): string {
        return `❌ ${monoBold('REGISTRATION CLOSED')}\n` +
            `This tournament is no longer accepting players.`;
    },

    tournamentFull(): string {
        return `❌ ${monoBold('TOURNAMENT FULL')}\n` +
            `Maximum players reached.`;
    },

    cannotLeaveInProgress(): string {
        return `❌ ${monoBold('IN PROGRESS')}\n` +
            `Cannot leave — tournament has already started.`;
    },

    noMatchesYet(): string {
        return `📊 ${monoBold('NO MATCHES')}\n` +
            `No matches recorded yet.`;
    },
};

export default msg;
