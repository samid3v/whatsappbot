export declare function setWhitelist(domains: string[]): void;
export declare function addToWhitelist(domain: string): void;
export declare function removeFromWhitelist(domain: string): void;
export declare function getWhitelist(): string[];
/**
 * Check if text contains any links
 */
export declare function containsLink(text: string): boolean;
/**
 * Extract all URLs from text
 */
export declare function extractUrls(text: string): string[];
/**
 * Check if a URL is whitelisted
 */
export declare function isWhitelisted(url: string): boolean;
/**
 * Check if text contains non-whitelisted links
 */
export declare function containsNonWhitelistedLink(text: string): {
    hasLink: boolean;
    urls: string[];
};
/**
 * Check if text contains links (excluding admins and moderators)
 */
export declare function shouldWarnForLink(text: string, userRole: string): boolean;
//# sourceMappingURL=link-detector.d.ts.map