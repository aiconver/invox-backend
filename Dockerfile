FROM node:24-alpine AS default

WORKDIR /usr/src/app

COPY package*.json ./

#############################

FROM default AS npm_prod_install

ENV NODE_ENV=production

RUN npm i -g npm@latest

RUN npm i pm2

RUN npm ci

#############################

FROM default AS npm_dev_install

ENV NODE_ENV=development

RUN npm ci

#############################

FROM npm_dev_install AS build

COPY . ./

RUN npm run build

#############################

FROM npm_dev_install AS test

ENV NODE_ENV=test

COPY . ./

#############################

FROM default AS prod

ENV NODE_ENV=production

COPY --from=npm_prod_install /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/public ./public
COPY --from=build /usr/src/app/package*.json ./

CMD [ "npm", "run", "start" ]
