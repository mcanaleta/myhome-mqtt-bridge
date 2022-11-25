ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache \
    nodejs \
    npm 

RUN npm install -g pnpm

# Copy data for add-on
RUN mkdir /app
WORKDIR /app
COPY package.json /app
COPY pnpm-lock.yaml /app
COPY tsconfig.json /app
RUN pnpm install
COPY src /app/src
RUN pnpm run tsc

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
