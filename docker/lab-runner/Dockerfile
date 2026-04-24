FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \
  apache2 \
  bash \
  ca-certificates \
  coreutils \
  curl \
  iproute2 \
  lsof \
  net-tools \
  nginx \
  procps \
  psmisc \
  python3 \
  sudo \
  util-linux \
  && rm -rf /var/lib/apt/lists/*

COPY labs /labs
COPY docker/lab-runner/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
  && find /labs -type f -name "*.sh" -exec chmod +x {} + \
  && mkdir -p /opt/winlab /var/run/winlab

WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
