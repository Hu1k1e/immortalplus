FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies (curl/build-essential for python packages,
# the rest for headless Chromium — Playwright needs these itself).
#
# Tried `playwright install --with-deps chromium` instead of this list
# (reasoning: a hand-maintained list rots, confirmed true here — it was
# missing libpango-1.0-0/libcairo2, breaking the Dota2ProTracker scrape
# at runtime with no build-time failure to catch it). That broke the
# BUILD instead: install-deps' package set assumes Ubuntu and asks apt
# for ttf-ubuntu-font-family/ttf-unifont, neither of which exist on
# Debian (python:3.12-slim's base) under any name — a real
# Playwright/Debian incompatibility, not a fixable version mismatch.
# Back to an explicit list, but a complete, Debian-correct one this
# time (fonts-liberation instead of the Ubuntu font packages; every
# other line below is what actually fixed the original runtime error).
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright's browser only (not --with-deps — see above).
RUN playwright install chromium

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PORT=8000

# Expose ports (API and GSI)
EXPOSE 8000
EXPOSE 9487

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
