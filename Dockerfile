# Railway builds this: a small web server that publishes only the site/ folder.
FROM caddy:2.8.4-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY site /srv
