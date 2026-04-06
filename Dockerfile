# Apify actor Dockerfile for LinkedIn Jobs Scraper
# Uses the official Apify Playwright base image (Chromium headless)

FROM apify/actor-node-playwright-chrome:18

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Dependencies installed"

# Copy source files
COPY . ./

# Run the actor
CMD npm start
