# Route Boss

A local web app for managing solar panel client routes and service schedules.

## Features

- Import Housecall Pro CSV files
- Manage customer service frequencies (Quarterly, Biannual, OneTime)
- Track due dates and service schedules
- Filter and search customers
- Build route lists
- **Interactive Google Maps** with route visualization and optimization
- **Message Template Builder** for generating personalized customer messages
- Export routes to CSV for Google My Maps
- Equipment tracking and maintenance (Gear Garage)

## Getting Started

### Install Dependencies

```bash
npm install
```

### Configure Google Maps API Key

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

Make sure your API key has these APIs enabled in Google Cloud Console:
- Maps JavaScript API
- Geocoding API
- Directions API

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Import**: Go to the Import page and upload your Housecall Pro CSV file
2. **Customers**: View, filter, and manage your customers. Select customers for routes.
3. **Map**: Visualize customers on an interactive map, geocode addresses, and optimize routes with Google Directions
4. **Routes**: Build routes, generate personalized messages with the Message Template Builder, and export CSV for Google My Maps
5. **Gear Garage**: Track equipment and maintenance schedules

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (Dark Mode)
- Zustand (State Management)
- localStorage (Data Persistence)
- PapaParse (CSV Parsing)
- date-fns (Date Utilities)

