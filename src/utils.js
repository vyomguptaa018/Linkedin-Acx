/**
 * utils.js
 * Shared utility functions for the LinkedIn Jobs Scraper.
 */

/**
 * Builds a LinkedIn job search URL from input parameters.
 */
export function buildSearchUrl(input) {
    const {
        searchKeywords = '',
        location = '',
        datePosted = 'anyTime',
        jobType = [],
        experienceLevel = [],
        remoteFilter = [],
    } = input;

    const baseUrl = 'https://www.linkedin.com/jobs/search/';
    const params = new URLSearchParams();

    if (searchKeywords) params.set('keywords', searchKeywords);
    if (location) params.set('location', location);

    // Sort by most recent
    params.set('sortBy', 'DD');

    // Date posted filter
    const dateMap = {
        past24Hours: 'r86400',
        pastWeek: 'r604800',
        pastMonth: 'r2592000',
    };
    if (datePosted && dateMap[datePosted]) {
        params.set('f_TPR', dateMap[datePosted]);
    }

    // Job type filter
    const jobTypeMap = {
        fullTime: 'F',
        partTime: 'P',
        contract: 'C',
        temporary: 'T',
        volunteer: 'V',
        internship: 'I',
        other: 'O',
    };
    const jobTypeCodes = jobType.map(t => jobTypeMap[t]).filter(Boolean);
    if (jobTypeCodes.length > 0) {
        params.set('f_JT', jobTypeCodes.join(','));
    }

    // Experience level filter
    const expMap = {
        internship: '1',
        entryLevel: '2',
        associate: '3',
        midSeniorLevel: '4',
        director: '5',
        executive: '6',
    };
    const expCodes = experienceLevel.map(e => expMap[e]).filter(Boolean);
    if (expCodes.length > 0) {
        params.set('f_E', expCodes.join(','));
    }

    // Remote filter
    const remoteMap = {
        onSite: '1',
        remote: '2',
        hybrid: '3',
    };
    const remoteCodes = remoteFilter.map(r => remoteMap[r]).filter(Boolean);
    if (remoteCodes.length > 0) {
        params.set('f_WT', remoteCodes.join(','));
    }

    params.set('start', '0');

    return `${baseUrl}?${params.toString()}`;
}

/**
 * Extracts all email addresses found in a block of text.
 */
export function extractEmails(text) {
    if (!text) return [];
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    // Deduplicate and filter out common false positives
    const filtered = [...new Set(matches)].filter(email => {
        const lower = email.toLowerCase();
        return !lower.includes('example.com') &&
               !lower.includes('domain.com') &&
               !lower.includes('@png') &&
               !lower.includes('@jpg') &&
               !lower.includes('@gif');
    });
    return filtered;
}

/**
 * Extracts phone numbers found in a block of text.
 */
export function extractPhones(text) {
    if (!text) return [];
    const phoneRegex = /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g;
    const matches = text.match(phoneRegex) || [];
    return [...new Set(matches)];
}

/**
 * Cleans whitespace from scraped text.
 */
export function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts the LinkedIn job ID from a job URL.
 */
export function extractJobId(url) {
    if (!url) return null;
    // Handles URLs like /jobs/view/1234567890/ or ?currentJobId=1234567890
    const viewMatch = url.match(/\/jobs\/view\/(\d+)/);
    if (viewMatch) return viewMatch[1];
    const paramMatch = url.match(/currentJobId=(\d+)/);
    if (paramMatch) return paramMatch[1];
    const queryMatch = url.match(/[?&](?:jobId|job_id)=(\d+)/);
    if (queryMatch) return queryMatch[1];
    return null;
}

/**
 * Converts a LinkedIn "posted X ago" string to an approximate ISO date.
 */
export function parsePostedDate(postedText) {
    if (!postedText) return null;
    const now = new Date();
    const text = postedText.toLowerCase().trim();

    if (text.includes('just now') || text.includes('seconds')) {
        return now.toISOString();
    }
    const minuteMatch = text.match(/(\d+)\s*minute/);
    if (minuteMatch) {
        now.setMinutes(now.getMinutes() - parseInt(minuteMatch[1]));
        return now.toISOString();
    }
    const hourMatch = text.match(/(\d+)\s*hour/);
    if (hourMatch) {
        now.setHours(now.getHours() - parseInt(hourMatch[1]));
        return now.toISOString();
    }
    const dayMatch = text.match(/(\d+)\s*day/);
    if (dayMatch) {
        now.setDate(now.getDate() - parseInt(dayMatch[1]));
        return now.toISOString();
    }
    const weekMatch = text.match(/(\d+)\s*week/);
    if (weekMatch) {
        now.setDate(now.getDate() - parseInt(weekMatch[1]) * 7);
        return now.toISOString();
    }
    const monthMatch = text.match(/(\d+)\s*month/);
    if (monthMatch) {
        now.setMonth(now.getMonth() - parseInt(monthMatch[1]));
        return now.toISOString();
    }
    // Return the raw text if we can't parse it
    return postedText;
}

/**
 * Sleep helper for adding delays between requests.
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Random int between min and max (inclusive).
 */
export function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Checks if a URL is a valid LinkedIn job URL.
 */
export function isLinkedInJobUrl(url) {
    if (!url) return false;
    return url.includes('linkedin.com/jobs/');
}
