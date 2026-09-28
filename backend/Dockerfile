FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed for some python packages (Playwright's
# own OS deps are installed separately below via `install-deps`, not this
# hand-maintained list — that list drifted out of date and was confirmed
# missing packages (libpango-1.0-0, libcairo2) in production, breaking the
# Dota2ProTracker scrape at runtime with no build-time failure to catch it)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright's browser + all OS-level dependencies it needs (for
# Dota2ProTracker scraping) — install-deps installs exactly what the
# pinned Playwright version in requirements.txt actually requires, so
# this doesn't rot the way a manually-copied apt package list does.
RUN playwright install --with-deps chromium

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
