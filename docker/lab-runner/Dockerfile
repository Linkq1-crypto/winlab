FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8

# Prevent nginx/apache2 from auto-starting during apt-get install.
# Without this, invoke-rc.d tries to start the services inside the build
# layer, which is non-deterministic and pollutes the image state.
RUN printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d \
 && chmod +x /usr/sbin/policy-rc.d

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      apache2 \
      bash \
      ca-certificates \
      coreutils \
      curl \
      iproute2 \
      lsof \
      net-tools \
      nginx \
      openssh-server \
      procps \
      psmisc \
      python3 \
      sudo \
      util-linux \
 && rm -rf /var/lib/apt/lists/* \
 && rm -f /usr/sbin/policy-rc.d

COPY labs/ /labs/
COPY docker/lab-runner/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
 && find /labs -type f -name "*.sh" -exec chmod +x {} + \
 && mkdir -p /opt/winlab /var/run/winlab

WORKDIR /workspace

# No EXPOSE — container is network-isolated via --network none at runtime.
ENTRYPOINT ["/entrypoint.sh"]
