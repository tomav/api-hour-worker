FROM node:alpine

ENV WORKDIR /usr/src/app/
WORKDIR $WORKDIR

# Install librairies
COPY package.json $WORKDIR
RUN npm install

# Install project
COPY aws-config.json worker.js $WORKDIR
CMD node worker.js
