// Link patterns to detect
const URL_PATTERNS = [
    // HTTP/HTTPS URLs
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    // www URLs
    /www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    // Shortened URLs
    /(bit\.ly|t\.co|goo\.gl|shorturl\.at|is\.gd|buff\.ly|ow\.ly|tinyurl\.com|tr\.im)\/[\w\-]+/gi,
    // YouTube
    /(youtube\.com|youtu\.be)\/[\w\-]+/gi,
    // Discord
    /discord\.gg\/[\w\-]+/gi,
    // Twitch
    /twitch\.tv\/[\w\-]+/gi,
];

// Whitelisted domains (can be configured)
let whitelistedDomains: string[] = [
    'konami.com',
    'efootball.com',
    'pesmyclub.com',
];

export function setWhitelist(domains: string[]): void {
    whitelistedDomains = domains;
}

export function addToWhitelist(domain: string): void {
    if (!whitelistedDomains.includes(domain)) {
        whitelistedDomains.push(domain);
    }
}

export function removeFromWhitelist(domain: string): void {
    whitelistedDomains = whitelistedDomains.filter(d => d !== domain);
}

export function getWhitelist(): string[] {
    return [...whitelistedDomains];
}

/**
 * Check if text contains any links
 */
export function containsLink(text: string): boolean {
    if (!text) return false;

    for (const pattern of URL_PATTERNS) {
        if (pattern.test(text)) {
            return true;
        }
    }
    return false;
}

/**
 * Extract all URLs from text
 */
export function extractUrls(text: string): string[] {
    if (!text) return [];

    const urls: string[] = [];

    for (const pattern of URL_PATTERNS) {
        const matches = text.match(pattern);
        if (matches) {
            urls.push(...matches);
        }
    }

    // Remove duplicates
    return [...new Set(urls)];
}

/**
 * Check if a URL is whitelisted
 */
export function isWhitelisted(url: string): boolean {
    const urlLower = url.toLowerCase();

    for (const domain of whitelistedDomains) {
        if (urlLower.includes(domain)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if text contains non-whitelisted links
 */
export function containsNonWhitelistedLink(text: string): { hasLink: boolean; urls: string[] } {
    if (!text) return { hasLink: false, urls: [] };

    const urls = extractUrls(text);
    const nonWhitelistedUrls = urls.filter(url => !isWhitelisted(url));

    return {
        hasLink: nonWhitelistedUrls.length > 0,
        urls: nonWhitelistedUrls,
    };
}

/**
 * Check if text contains links (excluding admins and moderators)
 */
export function shouldWarnForLink(text: string, userRole: string): boolean {
    // Admin and above don't get warned
    if (userRole === 'owner' || userRole === 'admin' || userRole === 'moderator') {
        return false;
    }

    return containsNonWhitelistedLink(text).hasLink;
}
