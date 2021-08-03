## Docker compose
See the compose file in [docker-compose.yml](./docker-compose.yml).

## Images used
The following repos are used with docker:

- [graph-node](https://github.com/graphprotocol/graph-node): for the indexing
- nginx: for providing an HTTPS connection over the HTTP GraphQL endpoint
  - [nginx-proxy](https://github.com/nginx-proxy/nginx-proxy)
  - [acme-companion](https://github.com/nginx-proxy/acme-companion) - generates letsencrypt certificates automatically with nginx