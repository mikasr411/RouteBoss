"use client";

import { useState } from "react";
import { parseCSV } from "@/lib/csv-parser";
import { useCustomerStore } from "@/store/customer-store";
import { Customer } from "@/types/customer";
import { formatDate } from "@/lib/utils";

export default function ImportPage() {
  const [previewCustomers, setPreviewCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setCustomers } = useCustomerStore();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const customers = await parseCSV(file);
      setPreviewCustomers(customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplace = () => {
    setCustomers(previewCustomers);
    setPreviewCustomers([]);
    alert(`Imported ${previewCustomers.length} customers successfully!`);
  };

  const handleClear = () => {
    setPreviewCustomers([]);
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h1 className="text-3xl font-bold mb-2 text-slate-100">
          Import Housecall Pro CSV
        </h1>
        <p className="text-slate-400 mb-6">
          Upload your customer export CSV file from Housecall Pro.
        </p>

        <div className="mb-6">
          <label className="block mb-2 text-slate-300">
            Select CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={isLoading}
            className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600 cursor-pointer"
          />
        </div>

        {isLoading && (
          <div className="text-slate-400 mb-4">Parsing CSV...</div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded p-4 mb-4 text-red-200">
            Error: {error}
          </div>
        )}

        {previewCustomers.length > 0 && (
          <>
            <div className="mb-4">
              <p className="text-slate-300">
                Preview: {previewCustomers.length} customers found
              </p>
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-700">
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Display Name
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      City
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      State
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Last Service
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Next Service
                    </th>
                    <th className="border border-slate-600 px-4 py-2 text-left text-slate-200">
                      Address
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewCustomers.slice(0, 20).map((customer) => (
                    <tr key={customer.id} className="bg-slate-800 hover:bg-slate-750">
                      <td className="border border-slate-600 px-4 py-2 text-slate-300">
                        {customer.displayName}
                      </td>
                      <td className="border border-slate-600 px-4 py-2 text-slate-300">
                        {customer.city}
                      </td>
                      <td className="border border-slate-600 px-4 py-2 text-slate-300">
                        {customer.state}
                      </td>
                      <td className="border border-slate-600 px-4 py-2 text-slate-300">
                        {formatDate(customer.lastServiceDate)}
                      </td>
                      <td className="border border-slate-600 px-4 py-2 text-slate-300">
                        {formatDate(customer.nextServiceDate)}
                      </td>
                      <td className="border border-slate-600 px-4 py-2 text-slate-300 text-sm">
                        {customer.fullAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewCustomers.length > 20 && (
                <p className="text-slate-400 mt-2 text-sm">
                  Showing first 20 of {previewCustomers.length} customers
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleReplace}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors"
              >
                Replace Existing Customers with This Import
              </button>
              <button
                onClick={handleClear}
                className="bg-slate-700 hover:bg-slate-600 text-slate-100 px-6 py-2 rounded transition-colors"
              >
                Cancel / Clear Preview
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

