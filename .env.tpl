# GFFL — PropertiesService Key Reference
#
# These keys must be set in Google Apps Script's PropertiesService before the app works.
# This file documents what needs to exist — actual values are NEVER stored here or in any file.
# Safe to commit: no real credentials, only key names and instructions.
#
# ─── How to set each key ─────────────────────────────────────────────────────
#
# SHEET_ID
#   Set automatically by running setupSheet() in Setup.gs from the Apps Script editor.
#   Points to the GFFL Google Spreadsheet.
#
# ADMIN_PASSWORD_HASH
#   Set by running setAdminPassword('yourPassword') in Admin.gs from the Apps Script editor.
#   Stored as a SHA-256 hash — the plaintext is never saved anywhere.
#
# ADMIN_TOKEN
#   Set automatically when the commissioner logs in via the Admin panel.
#   Do not set manually.
#
# ADMIN_EXPIRY
#   Set automatically when the commissioner logs in. Token expires after 1 hour.
#   Do not set manually.
#
# ─── Apps Script editor ──────────────────────────────────────────────────────
# https://script.google.com/home/projects/1ZPx2xknKYtcI43FLn2aHq--O6nRvFH4c55XaIDqYhWYWuVlCsULYXewX/edit
#
# ─── To inspect current values ───────────────────────────────────────────────
# In the editor: run PropertiesService.getScriptProperties().getProperties()
# and check the Execution Log — do not paste output anywhere.

SHEET_ID=
ADMIN_PASSWORD_HASH=
ADMIN_TOKEN=
ADMIN_EXPIRY=
