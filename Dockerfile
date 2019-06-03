FROM keymetrics/pm2:latest-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json /usr/src/app/package.json
COPY package-lock.json /usr/src/app/package-lock.json
RUN npm install --silent
COPY . /usr/src/app

CMD [ "pm2-runtime", "start", "index.js" ]
