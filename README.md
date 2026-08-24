# Secretshare

Secretshare encrypts text and files in the browser and stores only ciphertext on the server. A generated URL has the form `/s/{id}#key`; URL fragments are not sent in HTTP requests, so the server never receives the encryption key.

## Run locally

Requires Node.js 20 or newer. There are no third-party runtime dependencies.

```sh
npm start
```

Open `http://localhost:3000`. Do not serve `index.html` directly: link creation and one-time retrieval require `server.mjs`.

## Storage and limits

- Active encrypted records are stored as mode-`0600` files in `.data/secrets`.
- Text and files use AES-256-GCM; optional passphrases use PBKDF2-SHA-256 with 250,000 iterations.
- Files are limited to 5 MB and records expire after at most seven days.
- Availability checks never consume data. A confirmation token and explicit POST atomically claim a record; the claimed file is deleted after its single response.
- The email-notification prototype option was removed because this implementation intentionally has no email provider or plaintext recipient data.

## Deployment notes

Use HTTPS in production; Web Crypto is restricted to secure contexts outside localhost. Mount `.data` on persistent, encrypted storage and run exactly one application instance when using the bundled file store. A multi-instance deployment should replace the store with a database operation equivalent to `DELETE ... RETURNING` in one transaction. Put audited edge rate limiting and request-size limits in front of the Node process, monitor storage, back up configuration rather than ciphertext, and run an independent cryptographic/security review before handling high-value secrets.

### CI/CD

Pushes to `main` are tested and deployed by `.github/workflows/deploy.yml`. Configure the GitHub `production` environment with one repository secret, `DEPLOY_SSH_KEY`, containing the private key for the dedicated `secretshare-deploy` account. The public server address, user, and deployment path are declared in the workflow.

The workflow preserves the named Docker volume containing encrypted secrets, deploys one application container, and verifies `/healthz` after every release. `ops/nginx-secretshare.conf` is the Nginx reverse-proxy configuration used for the production domain.
