# Homelab Network Planner

Et lille C# / ASP.NET Core værktøj til at holde styr på:

- VLANs
- Fysiske servere og management IP'er
- VM'er, LXC og containere
- Proxmox VM ID struktur

## Stack

- ASP.NET Core 10
- SQLite
- Enkel frontend i `wwwroot`
- Docker klar

## Funktioner

- Initial seed hvis databasen er tom
- CRUD for VLANs
- CRUD for fysiske servere
- CRUD for workloads
- Unikke checks for VLAN ID, subnet, IP og VM ID
- Mørkt UI med fokus på hurtig administration

## Kør lokalt

```bash
dotnet restore
dotnet run
```

Åbn:

```text
http://localhost:5000
```

eller den port ASP.NET vælger lokalt.

## Kør med Docker

```bash
docker compose up -d --build
```

Åbn:

```text
http://localhost:8080
```

## Data

SQLite databasen gemmes her:

```text
./data/network-planner.db
```

## Standard seed

Ved første opstart oprettes:

- VLAN plan for Management, Private, Servers, Guest og IoT
- Et par fysiske servere / netværksenheder
- Eksempler på VM'er og LXC'er med anbefalede VM IDs

## VM ID struktur

- 100-199 Infrastructure
- 200-299 Netværksservices
- 300-399 Applikationer
- 400-499 Databaser
- 500-599 AI Services
- 700-799 LXC / Utility
- 900-999 Test / Lab
