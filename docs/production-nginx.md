# Production Nginx

The `winlab.cloud` server block in `nginx.conf` includes the production WebSocket proxy for `/ws` and must proxy to `127.0.0.1:3001`.

Deploy sequence after updating the server config:

```bash
nginx -t
systemctl reload nginx
```

The `/ws` location must stay inside the `winlab.cloud` server block and must not be duplicated elsewhere in that same server block.
