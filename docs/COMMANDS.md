# Chat Commands (Spec Draft)

- `/status [account]`
- `/open <symbol> <side> <size> [sl] [tp]`
- `/close <positionId|symbol>`
- `/set-risk <account|global> <key> <value>`
- `/pause <account|global>`
- `/resume <account|global>`
- `/panic`

All commands must produce audit records:
- actor
- channel
- command payload
- timestamp
- decision (allowed/blocked)
