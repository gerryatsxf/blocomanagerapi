<p align="center">
  <a href="http://nestjs.com/" ta$ docker run -d --name blocomanager_mongodb \
  --network blocomanager_network \
  -p 27020:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin_root \
  -e MONGO_INITDB_ROOT_PASSWORD=admin_root \
  -e MONGO_INITDB_DATABASE=blocomanager \
  -v blocomanager_mongodb_data:/data/db \
  mongo:latestlank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

BlocoManager API - A NestJS application for managing meetings and appointments.

## Environment Configuration

This application uses different environment variable loading strategies depending on the deployment environment:

- **Local Development**: Loads environment variables from `env/dev.env` file
- **Docker/Production**: Uses environment variables passed directly to the container

## Installation

```bash
$ npm install
```

## Local Development Setup

1. Copy the example environment file:
```bash
$ cp env/dev.env.example env/dev.env
```

2. Edit `env/dev.env` with your local configuration values

3. **[Optional] Set up Gmail API for email notifications**:
   - See [GMAIL_SETUP.md](./GMAIL_SETUP.md) for complete instructions
   - Run `node scripts/generate-gmail-token.js` to generate OAuth tokens
   - Enables: Welcome emails on registration, password reset emails
   - Without Gmail setup, emails will be logged to console

4. Start the local MongoDB database:
```bash
$ docker run -d --name aprendecoding_mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin_root \
  -e MONGO_INITDB_ROOT_PASSWORD=admin_root \
  -e MONGO_INITDB_DATABASE=aprendecoding \
  -v mongodb_data:/data/db \
  mongo:7.0
```

## Running the app

```bash
# development (loads from env/dev.env with local MongoDB)
$ npm run start

# watch mode (loads from env/dev.env with local MongoDB)
$ npm run start:dev

# production mode (uses system environment variables)
$ npm run start:prod

# production mode with local env file
$ npm run start:prod:local
```

## Docker Compose Development

For a complete local development environment with hot reload:

```bash
# Start MongoDB + API in development mode
$ docker-compose --profile dev up -d

# View logs
$ docker-compose logs -f

# Stop services
$ docker-compose down
```

## Docker Compose Production

For a complete production environment locally:

```bash
# Start MongoDB + API in production mode
$ docker-compose --profile production up -d

# View logs
$ docker-compose logs -f

# Stop services
$ docker-compose down
```

## Docker Deployment

Build and run with Docker:

```bash
# Build the image
$ docker build -t blocomanager:latest .

# Run with environment variables
$ docker run -d --name blocomanager_api -p 3002:3002 \
  -e DOCKER_ENV="true" \
  -e MONGO_DB_ATLAS_CONNECTION_STRING="your_mongo_connection_string" \
  -e JWT_SECRET="your_jwt_secret" \
  -e STRIPE_SECRET_KEY="your_stripe_key" \
  -e STRIPE_WEBHOOK_SECRET="your_webhook_secret" \
  -e NYLAS_CLIENT_ID="your_nylas_client_id" \
  -e NYLAS_CLIENT_SECRET="your_nylas_client_secret" \
  -e NYLAS_API_KEY="your_nylas_api_key" \
  blocomanager:latest
```

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
