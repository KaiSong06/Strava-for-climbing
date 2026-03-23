FROM python:3.11-slim

WORKDIR /app

# System deps required by opencv-python-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 curl git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cached layer — only rebuilds when requirements.txt changes)
COPY requirements.txt .
# Use CPU-only PyTorch to cut ~1 GB from the image (no GPU on typical cloud instances)
RUN pip install --no-cache-dir \
    torch==2.3.0 torchvision==0.18.0 \
    --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Download SAM ViT-B weights at build time (~375 MB) so the image is self-contained
RUN mkdir -p models && \
    curl -L -o models/sam_vit_b_01ec64.pth \
    https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth

# Pre-cache MiDaS small weights via torch.hub (~100 MB → /root/.cache/torch/hub/)
RUN python -c "import torch; torch.hub.load('intel-isl/MiDaS', 'MiDaS_small', trust_repo=True)"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
