# MiniLedger

MiniLedger is a small mobile app for keeping track of money lent to friends. It includes an Expo and React Native client and a Node.js API backed by PostgreSQL. For a quick demo, the API can run in memory without a database.

## Features

- Sign in with a phone number and a mock one-time code. The API prints the code in its terminal; the demo code is `123456`.
- Add loans with a friend's name, amount, due date, and an optional receipt photo.
- See total lent, total repaid, and overdue amounts.
- Mark loans as repaid, view attached receipts, and remove individual or all entries.
- Sort by due date, repayment date, amount, or friend name, in either direction.
- Group entries by friend and see the amount still owed by each person.
- Use haptic feedback for selected screen transitions and completed actions.

## Screenshots

| Sign in | Loan list |
| --- | --- |
| ![Sign in screen](docs/screenshots/login.png) | ![Loan list](docs/screenshots/home.png) |

| Add a loan | Receipt preview |
| --- | --- |
| ![Add a loan](docs/screenshots/add-loan.png) | ![Receipt preview](docs/screenshots/receipt.png) |

## Stack

- Mobile: Expo SDK 58, React Native, TypeScript, React Native Paper
- API: Node.js, Express, TypeScript, Zod
- Storage: PostgreSQL, with in-memory demo data as an alternative
- Local database: Docker Compose

## Requirements

- Node.js 22 or newer and npm
- Expo Go on an Android or iOS phone, or an Android emulator
- Docker Desktop only if you want PostgreSQL persistence

For a physical phone, keep the phone and computer on the same Wi-Fi network. You do not need Android Studio to run the app in Expo Go.

## Run the demo

The quick-start setup uses in-memory data. Entries reset to the sample loans whenever the API restarts.

### 1. Get the project and configure the app

```sh
git clone https://github.com/Arsh1255/MiniLedger.git
cd MiniLedger
npm install
```

Copy `.env.example` to `.env`. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```sh
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `.env` to the computer's Wi-Fi IPv4 address, for example:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:4000
```

On Windows, find the address with `ipconfig` and use the Wi-Fi adapter's IPv4 address. On an Android emulator, use `http://10.0.2.2:4000` instead.

### 2. Start the API

Open a second terminal in the project folder:

```sh
cd server
npm install
npm run dev
```

The API listens on port `4000`. With `DATABASE_URL` left blank, it uses sample in-memory data. When you request a sign-in code, the API terminal prints it. Enter `123456` in the app.

### 3. Start the mobile app

In the first terminal, from the project root:

```sh
npx expo start
```

Scan the QR code with Expo Go. If Windows Firewall asks whether Node.js can accept connections on a private network, allow it so your phone can reach the API.

## Use PostgreSQL

Create the local environment files if you have not already. Set a local-only `POSTGRES_PASSWORD` in the root `.env`; use letters and numbers to avoid URL-encoding issues. Then start PostgreSQL from the project root:

```sh
docker compose up -d
```

In `server/.env`, set `DATABASE_URL` using the same password:

```env
DATABASE_URL=postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/miniledger
```

If `server/.env` does not exist yet, copy `server/.env.example` to `server/.env` first.

Restart the API. It creates or updates the `loans` table on startup. Stop PostgreSQL with `docker compose down`. To also delete its stored data, use `docker compose down -v`.

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/request-otp` | Validate a phone number and log the mock code |
| `POST` | `/api/auth/verify-otp` | Verify the demo code `123456` |
| `GET` | `/api/loans` | List loans |
| `POST` | `/api/loans` | Add a loan, optionally with a base64 JPEG receipt (maximum 5 MB) |
| `PATCH` | `/api/loans/:id/repaid` | Mark a loan as repaid |
| `DELETE` | `/api/loans/:id` | Delete one loan and its receipt |
| `DELETE` | `/api/loans` | Clear the ledger and its receipts |
| `GET` | `/api/loans/:id/receipt` | Return a loan's receipt image |
| `GET` | `/api/summary` | Return lent, repaid, and overdue totals |
| `GET` | `/health` | Check API status and storage mode |

## Project structure

```text
MiniLedger/
├── assets/                   App icons and image assets
├── src/
│   ├── app/
│   │   ├── _layout.tsx       Expo Router layout and app theme
│   │   └── index.tsx         Login, ledger, sorting, forms, and API calls
│   ├── components/           Shared interface components
│   ├── constants/            Theme constants
│   └── hooks/                Theme and color-scheme hooks
├── server/
│   ├── src/index.ts          Express routes, validation, storage, and mock OTP
│   ├── .env.example          API configuration template
│   └── package.json          API scripts and dependencies
├── .env.example              Mobile API URL and local PostgreSQL password template
├── docker-compose.yml        Local PostgreSQL service
└── README.md
```

## Checks

From the project root:

```sh
npx tsc --noEmit
npx eslint src/app/index.tsx
```

For the API:

```sh
cd server
npm run typecheck
```

## Notes

Phone verification is intentionally mocked for this assignment. The demo code is fixed and is not sent by SMS. The in-memory mode is for demonstrations only and loses entries when the API stops; use PostgreSQL to keep them between restarts. The `.env` files are local configuration and should not be committed. Do not use real credentials in this project.
