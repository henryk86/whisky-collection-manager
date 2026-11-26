# Security policy

## Supported versions

Security fixes are provided for the current `main` branch and the latest
released version.

## Intended deployment model

Whisky Collection Manager is designed for **private self-hosted use** in a
trusted home network or behind a VPN. Even with HTTPS and optional login, a
public internet exposure is not recommended.

Recommended baseline:

- enable HTTPS,
- restrict access by firewall or VPN,
- enable login protection in shared networks,
- keep backups encrypted,
- install updates promptly.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for undisclosed security
vulnerabilities.

Preferred reporting path:

1. Use GitHub's private vulnerability reporting / security advisory workflow if
   it is enabled for this repository.
2. If private reporting is unavailable, contact the repository owner through the
   contact information on the GitHub profile.

Please include:

- affected version or commit,
- deployment type (local, Docker, Raspberry Pi, offline release),
- reproduction steps,
- expected impact,
- whether authentication is enabled,
- whether the issue is limited to local users or reachable over the network.

## Response expectations

Reports are handled on a best-effort basis. Valid issues will be assessed,
reproduced if possible and fixed in the regular maintenance workflow.

## German summary

Sicherheitslücken bitte nicht öffentlich als normales Issue melden. Nutze nach
Möglichkeit GitHub Private Vulnerability Reporting bzw. Security Advisories oder
ansonsten die Kontaktmöglichkeit im GitHub-Profil des Repository-Inhabers.
WCM ist für den privaten Self-Hosting-Betrieb im Heimnetz oder hinter VPN
vorgesehen, nicht für eine direkte öffentliche Internetfreigabe.
