/**
 * scraper.js
 * Core scraping engine — handles search result pages, pagination,
 * job detail page visits, and proxy/stealth configuration.
 */

import { PlaywrightCrawler } from '@crawlee/playwright';
import { RequestQueue, log } from 'crawlee';
import { Actor } from 'apify';
import { buildSearchUrl, sleep, randomBetween, isLinkedInJobUrl } from './utils.js';
import {
    extractJobCardsFromPage,
    extractJobDetails,
    getTotalResultsCount,
    isAuthWall,
} from './extractor.js';

// Label constants for request routing
const LABELS = {
    SEARCH: 'SEARCH',
    JOB_DETAIL: 'JOB_DETAIL',
};

/**
 * Main scraper class.
 */
export class LinkedInJobsScraper {
    constructor(input) {
        this.input = input;
        this.scrapedCount = 0;
        this.enqueuedJobUrls = new Set();
        this.maxResults = input.maxResults || 100;
        this.requestDelay = input.requestDelay || 2000;
        this.scrapeJobDetails = input.scrapeJobDetails !== false;
        this.companyFilter = (input.companyFilter || []).map(c => c.toLowerCase().trim());
    }

    /**
     * Build and return the Playwright crawler instance.
     */
    buildCrawler(requestQueue, proxyConfiguration) {
        const self = this;

        return new PlaywrightCrawler({
            requestQueue,
            proxyConfiguration,
            maxConcurrency: this.input.maxConcurrency || 3,
            maxRequestRetries: 3,
            requestHandlerTimeoutSecs: 90,
            navigationTimeoutSecs: 60,

            // ── Playwright launch options ──────────────────────────
            launchContext: {
                launcher: { chromium: true },
                launchOptions: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-infobars',
                        '--window-size=1920,1080',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                    ],
                },
            },

            // ── Pre-navigation hook — inject stealth headers ───────
            preNavigationHooks: [
                async ({ page, request }) => {
                    // Set a realistic user agent
                    await page.setExtraHTTPHeaders({
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'sec-fetch-dest': 'document',
                        'sec-fetch-mode': 'navigate',
                        'sec-fetch-site': 'none',
                        'sec-fetch-user': '?1',
                    });

                    // Override navigator properties to avoid bot detection
                    await page.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                        window.chrome = { runtime: {} };
                    });
                },
            ],

            // ── Main request handler ───────────────────────────────
            requestHandler: async ({ page, request, enqueueLinks, log: crawleeLog }) => {
                const { label } = request.userData;

                // Check for auth wall
                if (await isAuthWall(page)) {
                    crawleeLog.warning(`Auth wall detected at ${request.url} — LinkedIn may require login. Retrying with different proxy.`);
                    await Actor.pushData({
                        _error: 'auth_wall',
                        _url: request.url,
                        _message: 'LinkedIn redirected to login page. Consider using cookies or a different proxy.',
                    });
                    return;
                }

                if (label === LABELS.SEARCH) {
                    await self.handleSearchPage(page, request, requestQueue, crawleeLog);
                } else if (label === LABELS.JOB_DETAIL) {
                    await self.handleJobDetailPage(page, request, crawleeLog);
                }
            },

            // ── Error handler ─────────────────────────────────────
            failedRequestHandler: async ({ request, error }) => {
                log.error(`Request failed: ${request.url} — ${error.message}`);
            },
        });
    }

    /**
     * Handles a LinkedIn job search results page.
     * Extracts job cards, enqueues detail pages, handles pagination.
     */
    async handleSearchPage(page, request, requestQueue, crawleeLog) {
        crawleeLog.info(`Processing search page: ${page.url()}`);

        // Wait for job results to load
        try {
            await page.waitForSelector(
                'ul.jobs-search__results-list, .scaffold-layout__list-container, .jobs-search-results-list',
                { timeout: 15000 }
            );
        } catch {
            crawleeLog.warning('Job list not found on page — may be empty results or changed layout.');
            return;
        }

        // Get total results count (for logging)
        const totalCount = await getTotalResultsCount(page);
        if (totalCount !== null) {
            crawleeLog.info(`Total results available: ${totalCount.toLocaleString()}`);
        }

        // Scroll to load all visible cards (LinkedIn uses infinite scroll)
        await this.scrollToLoadAll(page, crawleeLog);

        // Extract job cards
        const jobCards = await extractJobCardsFromPage(page);
        crawleeLog.info(`Found ${jobCards.length} job cards on this page.`);

        for (const card of jobCards) {
            // Check max results
            if (this.scrapedCount >= this.maxResults) break;

            // Apply company filter if set
            if (this.companyFilter.length > 0 && card.company) {
                const companyLower = card.company.toLowerCase();
                const matches = this.companyFilter.some(cf => companyLower.includes(cf));
                if (!matches) continue;
            }

            if (!card.jobPostingLink || this.enqueuedJobUrls.has(card.jobPostingLink)) continue;
            this.enqueuedJobUrls.add(card.jobPostingLink);

            if (this.scrapeJobDetails) {
                // Enqueue for detail scraping
                await requestQueue.addRequest({
                    url: card.jobPostingLink,
                    userData: {
                        label: LABELS.JOB_DETAIL,
                        cardData: card,
                    },
                });
            } else {
                // Save card data directly (without visiting detail page)
                const { extractJobId, parsePostedDate, cleanText } = await import('./utils.js');
                await Actor.pushData({
                    jobId: extractJobId(card.jobPostingLink),
                    title: card.title,
                    company: card.company,
                    location: card.location,
                    salary: card.salary,
                    easyApply: card.easyApply,
                    jobPostingLink: card.jobPostingLink,
                    postedAt: parsePostedDate(card.postedRaw),
                    postedAtRaw: card.postedRaw,
                    scrapedAt: new Date().toISOString(),
                });
                this.scrapedCount++;
                crawleeLog.info(`Saved job ${this.scrapedCount}/${this.maxResults}: ${card.title} @ ${card.company}`);
            }
        }

        // ── Pagination ─────────────────────────────────────────────
        if (this.scrapedCount < this.maxResults && jobCards.length > 0) {
            const currentUrl = new URL(page.url());
            const currentStart = parseInt(currentUrl.searchParams.get('start') || '0');
            const nextStart = currentStart + 25;

            // LinkedIn shows 25 results per page
            if (jobCards.length >= 23) {
                currentUrl.searchParams.set('start', nextStart.toString());
                const nextPageUrl = currentUrl.toString();

                await requestQueue.addRequest({
                    url: nextPageUrl,
                    userData: { label: LABELS.SEARCH },
                });
                crawleeLog.info(`Enqueued next page (start=${nextStart}): ${nextPageUrl}`);
            }
        }

        // Polite delay before next request
        await sleep(randomBetween(this.requestDelay, this.requestDelay * 1.5));
    }

    /**
     * Handles a single LinkedIn job detail page.
     * Extracts all available fields and saves to dataset.
     */
    async handleJobDetailPage(page, request, crawleeLog) {
        const { cardData } = request.userData;
        crawleeLog.info(`Scraping job detail: ${page.url()}`);

        // Wait for job description to load
        try {
            await page.waitForSelector(
                '.show-more-less-html__markup, #job-details, .jobs-description__content, .jobs-box__html-content',
                { timeout: 15000 }
            );
        } catch {
            crawleeLog.warning(`Job description not found at ${page.url()} — saving card data only.`);
        }

        // Expand "Show more" if present
        try {
            const showMoreBtn = await page.$(
                'button.show-more-less-html__button--more, button[aria-label="Show more, visually expands previously read content above"], .jobs-description__footer-button'
            );
            if (showMoreBtn) {
                await showMoreBtn.click();
                await sleep(800);
            }
        } catch {
            // Not critical if this fails
        }

        // Extract full details
        const details = await extractJobDetails(page, page.url());

        // Merge card data as fallback for missing fields
        const merged = {
            ...details,
            title: details.title || cardData?.title || null,
            company: details.company || cardData?.company || null,
            location: details.location || cardData?.location || null,
            salary: details.salary || cardData?.salary || null,
            easyApply: details.easyApply || cardData?.easyApply || false,
            jobPostingLink: details.jobPostingLink || request.url,
        };

        await Actor.pushData(merged);
        this.scrapedCount++;
        crawleeLog.info(`Saved job ${this.scrapedCount}/${this.maxResults}: ${merged.title} @ ${merged.company}`);

        // Polite delay
        await sleep(randomBetween(this.requestDelay, this.requestDelay * 2));
    }

    /**
     * Scrolls the page to load all lazy-loaded job cards.
     */
    async scrollToLoadAll(page, crawleeLog) {
        let previousHeight = 0;
        let attempts = 0;
        const maxScrollAttempts = 15;

        while (attempts < maxScrollAttempts) {
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            if (currentHeight === previousHeight) break;

            previousHeight = currentHeight;
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await sleep(randomBetween(800, 1500));
            attempts++;
        }

        // Scroll back to top
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(500);
    }

    /**
     * Run the full scraper.
     */
    async run() {
        const { input } = this;

        // ── Build request queue ────────────────────────────────────
        const requestQueue = await RequestQueue.open();

        // Build start URLs
        const startUrls = [];

        if (input.startUrls && input.startUrls.length > 0) {
            // User-provided direct URLs
            for (const urlObj of input.startUrls) {
                const url = typeof urlObj === 'string' ? urlObj : urlObj.url;
                if (url) {
                    startUrls.push({ url, userData: { label: LABELS.SEARCH } });
                }
            }
        } else {
            // Build from search parameters
            const searchUrl = buildSearchUrl(input);
            log.info(`Built search URL: ${searchUrl}`);
            startUrls.push({ url: searchUrl, userData: { label: LABELS.SEARCH } });
        }

        for (const req of startUrls) {
            await requestQueue.addRequest(req);
        }

        // ── Configure proxy ────────────────────────────────────────
        let proxyConfiguration;
        try {
            proxyConfiguration = await Actor.createProxyConfiguration(input.proxy || {
                useApifyProxy: true,
                apifyProxyGroups: ['RESIDENTIAL'],
            });
        } catch {
            log.warning('Could not create proxy configuration — running without proxy. LinkedIn may block requests.');
        }

        // ── Build and run crawler ──────────────────────────────────
        const crawler = this.buildCrawler(requestQueue, proxyConfiguration);
        log.info(`Starting scraper. Max results: ${this.maxResults}`);
        await crawler.run();

        log.info(`Scraping complete. Total jobs saved: ${this.scrapedCount}`);
    }
}
