FROM node:18-bullseye-slim

# tools untuk build native module genieacs
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 build-essential ca-certificates netcat-openbsd \
    && npm install -g genieacs@1.2.13 \
    && apt-get purge -y build-essential \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# direktori ekstensi (wajib ada)
RUN mkdir -p /opt/genieacs/ext && useradd -r -m genieacs || true

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7547 7557 7567 3000
ENTRYPOINT ["/entrypoint.sh"]
