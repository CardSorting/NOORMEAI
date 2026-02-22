"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSimilarity = calculateSimilarity;
exports.levenshteinDistance = levenshteinDistance;
/**
 * Calculate similarity between two strings using bigram overlap.
 *
 * This provides much better semantic comparison than simple token splitting
 * for cognitive rule conditions and knowledge facts.
 */
function calculateSimilarity(s1, s2) {
    const v1 = normalize(s1);
    const v2 = normalize(s2);
    if (v1 === v2)
        return 1.0;
    if (v1.length < 2 || v2.length < 2)
        return 0.0;
    const bigrams1 = getBigrams(v1);
    const bigrams2 = getBigrams(v2);
    let intersection = 0;
    for (const bigram of bigrams1) {
        if (bigrams2.has(bigram)) {
            intersection++;
        }
    }
    return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}
/**
 * Calculate Levenshtein distance between two strings.
 * Used as a fallback or refinement for very short strings.
 */
function levenshteinDistance(s1, s2) {
    const a = s1.toLowerCase();
    const b = s2.toLowerCase();
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1.0 - distance / maxLength;
}
function normalize(s) {
    return s.toLowerCase().replace(/\W+/g, ' ').trim();
}
function getBigrams(s) {
    const bigrams = new Set();
    for (let i = 0; i < s.length - 1; i++) {
        bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
}
