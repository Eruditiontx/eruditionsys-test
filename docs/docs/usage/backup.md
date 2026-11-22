---
sidebar_position: 2
---

# Backup

## Database backup

EruditionSys TCMS uses SQLite for data persistence. Therefore, backing up the database is simply backing up the SQLite DB file.

Please back up the file `backend/database/database.sqlite`.

:::note[In Docker environment]

In a docker environment, DB file is stored in a Docker named volume (`db-data`).

:::

## Backup of uploaded files

Uploaded files are managed separately from the database. If you have uploaded files, you need to back them up too.

Please back up the files under these directories:

- `backend/storage/attachments`: files attached to test cases (or the directory set by `ATTACHMENTS_DIR`).
- `backend/public/uploads`: user avatars.

Attachments used to be stored in `backend/public/uploads`. The database migration that runs on upgrade moves them to `backend/storage/attachments`. With Docker, mount that directory as a volume **before** upgrading (see `docker-compose.yaml`), otherwise the moved files are lost when the container is recreated.
