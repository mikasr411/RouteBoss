# Route Boss

A local web app for managing solar panel client routes and service schedules.

## Features

- Import Housecall Pro CSV files
- Manage customer service frequencies (Quarterly, Biannual, OneTime)
- Track due dates and service schedules
- Filter and search customers
- Build route lists
- Export routes to CSV for Google My Maps

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Import**: Go to the Import page and upload your Housecall Pro CSV file
2. **Customers**: View, filter, and manage your customers. Select customers for routes.
3. **Routes**: Build and export your route as a CSV for Google My Maps

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (Dark Mode)
- Zustand (State Management)
- localStorage (Data Persistence)
- PapaParse (CSV Parsing)
- date-fns (Date Utilities)

