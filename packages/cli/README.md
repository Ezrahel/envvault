# envvault

Your development environment, available on any machine. EnvVault finds your `.env` files, ties them to the Git repository (not the folder), encrypts them **on your machine** with AES-256-GCM, and restores them after any clone.

```bash
npm install -g envvault

# first machine
envvault signup          # account password + vault passphrase
envvault push            # encrypt + back up this repo's .env files

# any other machine
envvault login           # same vault passphrase
git clone git@github.com:you/project.git && cd project
envvault pull            # decrypted, written atomically with 0600
```

- **Two secrets, on purpose.** Your account password signs you in. Your vault passphrase encrypts your files and never leaves your machine. If you lose it, your backups can't be recovered (not even by us).
- **CI / scripts:** set `ENVVAULT_PASSWORD` and `ENVVAULT_MASTER_KEY` instead of prompting.
- **Self-hosting:** point the CLI at your API with `ENVVAULT_API_URL=https://your-api`.

Run `envvault --help` for all commands.
