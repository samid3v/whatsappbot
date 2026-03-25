"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setWhitelist = setWhitelist;
exports.addToWhitelist = addToWhitelist;
exports.removeFromWhitelist = removeFromWhitelist;
exports.getWhitelist = getWhitelist;
exports.containsLink = containsLink;
exports.extractUrls = extractUrls;
exports.isWhitelisted = isWhitelisted;
exports.containsNonWhitelistedLink = containsNonWhitelistedLink;
exports.shouldWarnForLink = shouldWarnForLink;
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
let whitelistedDomains = [
    'konami.com',
    'efootball.com',
    'pesmyclub.com',
];
function setWhitelist(domains) {
    whitelistedDomains = domains;
}
function addToWhitelist(domain) {
    if (!whitelistedDomains.includes(domain)) {
        whitelistedDomains.push(domain);
    }
}
function removeFromWhitelist(domain) {
    whitelistedDomains = whitelistedDomains.filter(d => d !== domain);
}
function getWhitelist() {
    return [...whitelistedDomains];
}
/**
 * Check if text contains any links
 */
function containsLink(text) {
    if (!text)
        return false;
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
function extractUrls(text) {
    if (!text)
        return [];
    const urls = [];
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
function isWhitelisted(url) {
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
function containsNonWhitelistedLink(text) {
    if (!text)
        return { hasLink: false, urls: [] };
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
function shouldWarnForLink(text, userRole) {
    // Admin and above don't get warned
    if (userRole === 'owner' || userRole === 'admin' || userRole === 'moderator') {
        return false;
    }
    return containsNonWhitelistedLink(text).hasLink;
}
//# sourceMappingURL=link-detector.js.map