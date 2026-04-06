# 🔍 LinkedIn Jobs Scraper — Apify Actor

An advanced LinkedIn job listings scraper built for the [Apify](https://apify.com) platform. Powered by **Playwright** and **Crawlee**, it extracts rich job data at scale with proxy rotation and stealth techniques to avoid bot detection.

---

## 📦 What It Scrapes

For every job listing found, this actor extracts:

| Field | Description |
|---|---|
| `jobId` | LinkedIn's unique job ID |
| `title` | Job title |
| `company` | Company name |
| `companyLinkedInUrl` | Company's LinkedIn page URL |
| `companySize` | Company size (e.g. "1,001–5,000 employees") |
| `location` | Job location |
| `workplaceType` | Remote / Hybrid / On-site |
| `salary` | Salary range (when available) |
| `postedAt` | ISO date of when the job was posted |
| `applicantsCount` | Number of applicants |
| `jobType` | Full-time / Part-time / Contract etc. |
| `experienceLevel` | Entry Level / Mid-Senior / Director etc. |
| `industry` | Industry category |
| `jobFunction` | Job function |
| `employmentType` | Employment type |
| `descriptionText` | Full plain-text job description |
| `descriptionHtml` | Full HTML job description |
| `skills` | Listed skills/requirements |
| `applyUrl` | Direct external apply URL |
| `easyApply` | Whether LinkedIn Easy Apply is enabled |
| `jobPostingLink` | Full LinkedIn job posting URL |
| `emails` | Email addresses found in the description |
| `phones` | Phone numbers found in the description |
| `contactDetails` | Object with `emails` and `phones` arrays |
| `scrapedAt` | ISO timestamp of when it was scraped |

---

## 🚀 Getting Started

### 1. Deploy to Apify

```bash
# Install Apify CLI
npm install -g apify-cli

# Login to Apify
apify login

# Push to Apify platform
apify push
```

### 2. Run Locally (for testing)

```bash
npm install
apify run
```

Or with custom input:

```bash
APIFY_IS_AT_HOME=1 node src/main.js
```

---

## ⚙️ Input Parameters

Configure via the Apify Console UI or pass a JSON input:

```json
{
    "searchKeywords": "Software Engineer",
    "location": "San Francisco, CA",
    "maxResults": 200,
    "datePosted": "pastWeek",
    "jobType": ["fullTime", "contract"],
    "experienceLevel": ["midSeniorLevel", "entryLevel"],
    "remoteFilter": ["remote", "hybrid"],
    "scrapeJobDetails": true,
    "extractEmails": true,
    "maxConcurrency": 3,
    "requestDelay": 2000,
    "proxy": {
        "useApifyProxy": true,
        "apifyProxyGroups": ["RESIDENTIAL"]
    }
}
```

### All Input Options

| Parameter | Type | Default | Description |
|---|---|---|---|
| `searchKeywords` | string | `"Software Engineer"` | Job title / keywords |
| `location` | string | `""` | City, state, country, or "Remote" |
| `maxResults` | integer | `100` | Maximum jobs to scrape (1–5000) |
| `datePosted` | string | `"anyTime"` | `anyTime`, `pastMonth`, `pastWeek`, `past24Hours` |
| `jobType` | array | `[]` | `fullTime`, `partTime`, `contract`, `temporary`, `internship`, `volunteer` |
| `experienceLevel` | array | `[]` | `internship`, `entryLevel`, `associate`, `midSeniorLevel`, `director`, `executive` |
| `remoteFilter` | array | `[]` | `onSite`, `remote`, `hybrid` |
| `companyFilter` | array | `[]` | Only return jobs from these companies |
| `scrapeJobDetails` | boolean | `true` | Visit each job page for full data |
| `extractEmails` | boolean | `true` | Extract emails/phones from descriptions |
| `maxConcurrency` | integer | `3` | Parallel browser tabs |
| `requestDelay` | integer | `2000` | Delay between requests (ms) |
| `proxy` | object | Apify Residential | Proxy configuration |
| `startUrls` | array | `[]` | Optional: direct LinkedIn search URLs |

---

## 📤 Output Example

```json
{
    "jobId": "3987654321",
    "title": "Senior Software Engineer",
    "company": "Acme Corp",
    "companyLinkedInUrl": "https://www.linkedin.com/company/acme-corp/",
    "companySize": "1,001–5,000 employees",
    "location": "San Francisco, CA",
    "workplaceType": "Hybrid",
    "salary": "$140,000/yr - $180,000/yr",
    "postedAt": "2026-04-01T09:00:00.000Z",
    "postedAtRaw": "3 days ago",
    "applicantsCount": "142 applicants",
    "jobType": "Full-time",
    "experienceLevel": "Mid-Senior level",
    "industry": "Software Development",
    "jobFunction": "Engineering",
    "employmentType": "Full-time",
    "criteriaItems": [
        { "label": "Seniority level", "value": "Mid-Senior level" },
        { "label": "Employment type", "value": "Full-time" }
    ],
    "descriptionText": "We are looking for a Senior Software Engineer...",
    "descriptionHtml": "<p>We are looking for a <strong>Senior Software Engineer</strong>...</p>",
    "skills": ["Python", "AWS", "Kubernetes"],
    "applyUrl": "https://jobs.acmecorp.com/apply/12345",
    "easyApply": false,
    "jobPostingLink": "https://www.linkedin.com/jobs/view/3987654321/",
    "emails": ["careers@acmecorp.com"],
    "phones": [],
    "contactDetails": {
        "emails": ["careers@acmecorp.com"],
        "phones": []
    },
    "scrapedAt": "2026-04-06T12:34:56.789Z"
}
```

---

## 🔐 Proxy Recommendation

LinkedIn aggressively blocks datacenter IPs. **Apify Residential proxies are strongly recommended** to avoid being blocked. Set in input:

```json
"proxy": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
}
```

---

## 📁 Project Structure

```
linkedin-jobs-scraper/
├── .actor/
│   ├── actor.json          # Actor definition & output schema
│   └── INPUT_SCHEMA.json   # Input form definition
├── src/
│   ├── main.js             # Entry point
│   ├── scraper.js          # Playwright crawler & pagination
│   ├── extractor.js        # Data extraction from DOM
│   └── utils.js            # URL builder, email/phone extractors
├── Dockerfile              # Apify actor Docker image
├── package.json
└── README.md
```

---

## ⚠️ Disclaimer

This actor is for research and personal use only. Always comply with [LinkedIn's Terms of Service](https://www.linkedin.com/legal/user-agreement) and applicable data protection laws. Do not use this tool to collect personal data without consent or for commercial bulk data collection without authorization.

---

## 🤝 Similar Actor

Inspired by [bebity/linkedin-jobs-scraper](https://apify.com/bebity/linkedin-jobs-scraper) — rebuilt from scratch with expanded data extraction, full email/contact extraction, and advanced filtering.
