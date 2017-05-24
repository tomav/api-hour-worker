FROM node:alpine

ENV WORKDIR /usr/src/app/
WORKDIR $WORKDIR

# Install librairies
COPY package.json $WORKDIR
RUN npm install

# Install project
COPY api-hour-worker.js $WORKDIR
CMD node api-hour-worker.js
