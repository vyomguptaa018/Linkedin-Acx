/**
 * main.js
 * Entry point for the LinkedIn Jobs Scraper Apify actor.
 *
 * This actor scrapes LinkedIn job listings with full details:
 * title, company, location, salary, description, emails,
 * phone numbers, apply URL, job ID, posting date, and more.
 *
 * Built for Apify platform with Playwright + Crawlee.
 */

import { Actor, log } from 'apify';
import { LinkedInJobsScraper } from './scraper.js';

// Initialize the Apify actor
await Actor.init();

try {
    // Get input from Apify
    const input = await Actor.getInput() || {};

    log.info('LinkedIn Jobs Scraper started.');
    log.info(`Input received: ${JSON.stringify({
        searchKeywords: input.searchKeywords,
        location: input.location,
        maxResults: input.maxResults,
        datePosted: input.datePosted,
        jobType: input.jobType,
        experienceLevel: input.experienceLevel,
        remoteFilter: input.remoteFilter,
        scrapeJobDetails: input.scrapeJobDetails,
        extractEmails: input.extractEmails,
        maxConcurrency: input.maxConcurrency,
    }, null, 2)}`);

    // Validate required inputs
    if (!input.searchKeywords && (!input.startUrls || input.startUrls.length === 0)) {
        throw new Error('Please provide either "searchKeywords" or "startUrls" in the input.');
    }

    // Run the scraper
    const scraper = new LinkedInJobsScraper(input);
    await scraper.run();

} catch (error) {
    log.error(`Actor failed: ${error.message}`);
    log.error(error.stack);
    throw error;
} finally {
    await Actor.exit();
}
