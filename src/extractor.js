/**
 * extractor.js
 * All data extraction logic for LinkedIn job listing and detail pages.
 * Runs inside Playwright page context.
 */

import { cleanText, extractEmails, extractPhones, extractJobId, parsePostedDate } from './utils.js';

/**
 * Extracts basic job card data from the search results list.
 * Called on the search results page.
 */
export async function extractJobCardsFromPage(page) {
    return await page.evaluate(() => {
        const cards = document.querySelectorAll(
            'ul.jobs-search__results-list > li, .scaffold-layout__list-container .job-card-container, .jobs-search-results-list .job-card-list__entity-lockup'
        );

        const results = [];

        cards.forEach(card => {
            try {
                // Job title
                const titleEl = card.querySelector(
                    '.job-card-list__title, .base-search-card__title, a[data-tracking-control-name="public_jobs_jserp-result_search-card"]'
                );
                const title = titleEl ? titleEl.innerText.trim() : null;

                // Company name
                const companyEl = card.querySelector(
                    '.job-card-container__primary-description, .base-search-card__subtitle, .job-card-list__company-name'
                );
                const company = companyEl ? companyEl.innerText.trim() : null;

                // Location
                const locationEl = card.querySelector(
                    '.job-card-container__metadata-item, .job-search-card__location, .job-card-list__bullet'
                );
                const location = locationEl ? locationEl.innerText.trim() : null;

                // Job posting link
                const linkEl = card.querySelector('a.base-card__full-link, a.job-card-list__title--link, a[href*="/jobs/view/"]');
                const jobPostingLink = linkEl ? linkEl.href : null;

                // Posted time
                const postedEl = card.querySelector(
                    '.job-search-card__listdate, .job-card-container__footer-item time, time'
                );
                const postedRaw = postedEl
                    ? (postedEl.getAttribute('datetime') || postedEl.innerText.trim())
                    : null;

                // Salary (sometimes in card)
                const salaryEl = card.querySelector(
                    '.job-card-container__salary-info, .job-search-card__salary-info'
                );
                const salary = salaryEl ? salaryEl.innerText.trim() : null;

                // Benefits badge
                const benefitsEl = card.querySelector('.job-card-container__footer-item');
                const benefits = benefitsEl ? benefitsEl.innerText.trim() : null;

                // Easy Apply badge
                const easyApply = !!card.querySelector(
                    '.job-card-container__apply-method, [aria-label*="Easy Apply"]'
                );

                if (title || jobPostingLink) {
                    results.push({
                        title,
                        company,
                        location,
                        jobPostingLink,
                        postedRaw,
                        salary,
                        benefits,
                        easyApply,
                    });
                }
            } catch (e) {
                // Skip malformed cards
            }
        });

        return results;
    });
}

/**
 * Extracts comprehensive details from a single job detail page.
 * This is the main enrichment function.
 */
export async function extractJobDetails(page, jobPostingLink) {
    const rawData = await page.evaluate(() => {
        const getText = (selector, root = document) => {
            const el = root.querySelector(selector);
            return el ? el.innerText.trim() : null;
        };

        const getAttr = (selector, attr, root = document) => {
            const el = root.querySelector(selector);
            return el ? el.getAttribute(attr) : null;
        };

        const getAllText = (selector, root = document) => {
            return Array.from(root.querySelectorAll(selector))
                .map(el => el.innerText.trim())
                .filter(Boolean);
        };

        // ── Job Title ──────────────────────────────────────────────
        const title =
            getText('h1.top-card-layout__title') ||
            getText('h1.jobs-unified-top-card__job-title') ||
            getText('.job-details-jobs-unified-top-card__job-title h1') ||
            getText('h1');

        // ── Company ────────────────────────────────────────────────
        const company =
            getText('a.topcard__org-name-link') ||
            getText('.jobs-unified-top-card__company-name a') ||
            getText('.job-details-jobs-unified-top-card__company-name a') ||
            getText('.topcard__org-name-link') ||
            getText('[data-tracking-control-name="public_jobs_topcard-org-name"]');

        // ── Company LinkedIn URL ───────────────────────────────────
        const companyLinkedInUrl =
            getAttr('a.topcard__org-name-link', 'href') ||
            getAttr('.jobs-unified-top-card__company-name a', 'href') ||
            getAttr('[data-tracking-control-name="public_jobs_topcard-org-name"]', 'href');

        // ── Location ───────────────────────────────────────────────
        const location =
            getText('.topcard__flavor-row .topcard__flavor--bullet') ||
            getText('.jobs-unified-top-card__bullet') ||
            getText('.job-details-jobs-unified-top-card__primary-description-container .tvm__text') ||
            getText('[data-tracking-control-name="public_jobs_topcard_map"]');

        // ── Workplace Type (Remote/Hybrid/On-site) ─────────────────
        const workplaceType =
            getText('.jobs-unified-top-card__workplace-type') ||
            getText('.job-details-jobs-unified-top-card__workplace-type');

        // ── Salary ─────────────────────────────────────────────────
        const salary =
            getText('.compensation__salary-range') ||
            getText('.salary.compensation__salary-range') ||
            getText('[data-testid="job-insight-salary-top-card"]') ||
            getText('.job-details-jobs-unified-top-card__job-insight--highlight') ||
            getText('.jobs-unified-top-card__job-insight--highlight');

        // ── Posted Date ────────────────────────────────────────────
        const postedAt =
            getAttr('.topcard__flavor--metadata.posted-time-ago__text span', 'title') ||
            getText('.posted-time-ago__text') ||
            getAttr('time.job-search-card__listdate', 'datetime') ||
            getText('.jobs-unified-top-card__posted-date') ||
            getText('.job-details-jobs-unified-top-card__primary-description span');

        // ── Applicants Count ───────────────────────────────────────
        const applicantsCount =
            getText('.num-applicants__caption') ||
            getText('.jobs-unified-top-card__applicant-count') ||
            getText('.tvm__text tvm__text--positive');

        // ── Job Type (Full-time, Part-time, etc.) ──────────────────
        const jobType =
            getText('.jobs-unified-top-card__job-insight span') ||
            getText('.job-details-jobs-unified-top-card__job-insight span');

        // ── Seniority / Experience Level ───────────────────────────
        const experienceLevel =
            getText('.description__job-criteria-text--criteria') ||
            getText('[data-test-id="job-criteria-seniority-level"]') ||
            null;

        // ── Industry ───────────────────────────────────────────────
        const industry =
            getText('[data-test-id="job-criteria-industry"]') ||
            null;

        // ── Job Function ───────────────────────────────────────────
        const jobFunction =
            getText('[data-test-id="job-criteria-function"]') ||
            null;

        // ── Employment Type ────────────────────────────────────────
        const employmentType =
            getText('[data-test-id="job-criteria-employment-type"]') ||
            null;

        // ── Job Criteria (all criteria items) ─────────────────────
        const criteriaItems = [];
        document.querySelectorAll('.description__job-criteria-item').forEach(item => {
            const label = getText('.description__job-criteria-subheader', item);
            const value = getText('.description__job-criteria-text', item);
            if (label && value) criteriaItems.push({ label, value });
        });

        // ── Full Job Description ───────────────────────────────────
        const descriptionEl =
            document.querySelector('.show-more-less-html__markup') ||
            document.querySelector('.jobs-description__content .jobs-box__html-content') ||
            document.querySelector('#job-details') ||
            document.querySelector('.description__text');
        const descriptionHtml = descriptionEl ? descriptionEl.innerHTML : null;
        const descriptionText = descriptionEl ? descriptionEl.innerText.trim() : null;

        // ── Skills Required ────────────────────────────────────────
        const skills = getAllText('.job-details-skill-match-status-list .job-details-skill-match-status-list__text, .jobs-perk-banner__title');

        // ── Apply URL ──────────────────────────────────────────────
        const applyUrlEl =
            document.querySelector('.apply-button--link') ||
            document.querySelector('a[data-tracking-control-name="public_jobs_apply-link-offsite_sign-up-modal"]') ||
            document.querySelector('a.sign-up-modal__outlet') ||
            document.querySelector('.jobs-apply-button--top-card a') ||
            document.querySelector('button.jobs-apply-button');

        let applyUrl = applyUrlEl
            ? (applyUrlEl.href || applyUrlEl.getAttribute('data-job-url') || null)
            : null;

        // ── Easy Apply ─────────────────────────────────────────────
        const easyApply = !!document.querySelector(
            '[aria-label*="Easy Apply"], .jobs-apply-button--top-card [data-control-name*="easy"]'
        );

        // ── Company Size / Employees ───────────────────────────────
        const companySize =
            getText('.jobs-unified-top-card__job-insight--company-size') ||
            null;

        // ── Company Logo ───────────────────────────────────────────
        const companyLogoUrl =
            getAttr('.jobs-unified-top-card__company-logo img', 'src') ||
            getAttr('.artdeco-entity-image', 'src') ||
            null;

        // ── Job URL ────────────────────────────────────────────────
        const jobUrl = window.location.href;

        return {
            title,
            company,
            companyLinkedInUrl,
            companySize,
            companyLogoUrl,
            location,
            workplaceType,
            salary,
            postedAt,
            applicantsCount,
            jobType,
            experienceLevel,
            industry,
            jobFunction,
            employmentType,
            criteriaItems,
            descriptionHtml,
            descriptionText,
            skills,
            applyUrl,
            easyApply,
            jobUrl,
        };
    });

    // Post-process on Node.js side
    const jobId = extractJobId(rawData.jobUrl || jobPostingLink || '');

    const emails = rawData.descriptionText ? extractEmails(rawData.descriptionText) : [];
    const phones = rawData.descriptionText ? extractPhones(rawData.descriptionText) : [];

    const postedAtParsed = parsePostedDate(rawData.postedAt);

    return {
        jobId,
        title: rawData.title ? cleanText(rawData.title) : null,
        company: rawData.company ? cleanText(rawData.company) : null,
        companyLinkedInUrl: rawData.companyLinkedInUrl || null,
        companySize: rawData.companySize ? cleanText(rawData.companySize) : null,
        companyLogoUrl: rawData.companyLogoUrl || null,
        location: rawData.location ? cleanText(rawData.location) : null,
        workplaceType: rawData.workplaceType ? cleanText(rawData.workplaceType) : null,
        salary: rawData.salary ? cleanText(rawData.salary) : null,
        postedAt: postedAtParsed,
        postedAtRaw: rawData.postedAt || null,
        applicantsCount: rawData.applicantsCount ? cleanText(rawData.applicantsCount) : null,
        jobType: rawData.jobType ? cleanText(rawData.jobType) : null,
        experienceLevel: rawData.experienceLevel ? cleanText(rawData.experienceLevel) : null,
        industry: rawData.industry ? cleanText(rawData.industry) : null,
        jobFunction: rawData.jobFunction ? cleanText(rawData.jobFunction) : null,
        employmentType: rawData.employmentType ? cleanText(rawData.employmentType) : null,
        criteriaItems: rawData.criteriaItems || [],
        descriptionText: rawData.descriptionText ? cleanText(rawData.descriptionText) : null,
        descriptionHtml: rawData.descriptionHtml || null,
        skills: rawData.skills || [],
        applyUrl: rawData.applyUrl || null,
        easyApply: rawData.easyApply || false,
        jobPostingLink: rawData.jobUrl || jobPostingLink || null,
        // Contact info
        emails,
        phones,
        contactDetails: {
            emails,
            phones,
        },
        // Metadata
        scrapedAt: new Date().toISOString(),
    };
}

/**
 * Gets the total number of results shown on the search page.
 */
export async function getTotalResultsCount(page) {
    try {
        const text = await page.evaluate(() => {
            const el = document.querySelector(
                '.results-context-header__job-count, .jobs-search-results-list__subtitle, .jobs-search__total-results'
            );
            return el ? el.innerText.trim() : null;
        });
        if (!text) return null;
        const match = text.replace(/,/g, '').match(/[\d,]+/);
        return match ? parseInt(match[0]) : null;
    } catch {
        return null;
    }
}

/**
 * Checks if we are on a LinkedIn auth wall / login page.
 */
export async function isAuthWall(page) {
    const url = page.url();
    return (
        url.includes('/login') ||
        url.includes('/authwall') ||
        url.includes('/checkpoint') ||
        url.includes('/uas/login') ||
        (await page.evaluate(() => !!document.querySelector('.authwall-join-form, .join-form')))
    );
}
