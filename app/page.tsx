import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8">
        <h1 className="text-4xl font-bold mb-4 text-slate-100">Route Boss</h1>
        <p className="text-slate-300 mb-8">
          Manage your solar panel client routes and service schedules.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Link
            href="/import"
            className="bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg p-6 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2">Import</h2>
            <p className="text-slate-400 text-sm">
              Import your Housecall Pro CSV file
            </p>
          </Link>
          
          <Link
            href="/customers"
            className="bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg p-6 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2">Customers</h2>
            <p className="text-slate-400 text-sm">
              View and manage your customers
            </p>
          </Link>
          
          <Link
            href="/routes"
            className="bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg p-6 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2">Routes</h2>
            <p className="text-slate-400 text-sm">
              Build and export routes for Google My Maps
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

