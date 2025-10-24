FROM python:3.9-slim

# Install build dependencies and R dependencies for Prophet
RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    ca-certificates \
    git \
    make \
    && rm -rf /var/lib/apt/lists/*

# install python deps first
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# install cmdstanpy and download CmdStan (this can be lengthy)
RUN pip install --no-cache-dir cmdstanpy && \
    python -c "from cmdstanpy import install_cmdstan; install_cmdstan(cores=1)"

WORKDIR /app

# Copy rest of the application
COPY . .

# Run FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
