// Reusable skeleton loading components — shimmer animation via Tailwind

function Shimmer({ className }: { className: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <Shimmer className="h-5 w-40" />
            <Shimmer className="h-5 w-20 rounded-full" />
          </div>
          <Shimmer className="h-4 w-56" />
          <div className="flex gap-4">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-24" />
          </div>
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-8 w-12" />
          <Shimmer className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
}

export function TenantRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3"><Shimmer className="h-4 w-36" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-28" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-40" /></td>
      <td className="px-4 py-3"><Shimmer className="h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-12" /></td>
      <td className="px-4 py-3 flex gap-2">
        <Shimmer className="h-7 w-10" />
        <Shimmer className="h-7 w-14" />
      </td>
    </tr>
  );
}

export function PaymentRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3"><Shimmer className="h-4 w-28" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-36" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-24" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-20" /></td>
      <td className="px-4 py-3"><Shimmer className="h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-24" /></td>
      <td className="px-4 py-3"><Shimmer className="h-7 w-14" /></td>
    </tr>
  );
}

export function LeaseRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3"><Shimmer className="h-4 w-32" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-28" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-20" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-20" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-24" /></td>
      <td className="px-4 py-3"><Shimmer className="h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3 flex gap-2">
        <Shimmer className="h-7 w-10" />
        <Shimmer className="h-7 w-14" />
      </td>
    </tr>
  );
}

export function MaintenanceRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3"><Shimmer className="h-4 w-28" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-32" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-48" /></td>
      <td className="px-4 py-3"><Shimmer className="h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3"><Shimmer className="h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3"><Shimmer className="h-4 w-20" /></td>
      <td className="px-4 py-3"><Shimmer className="h-7 w-14" /></td>
    </tr>
  );
}

export function DashboardStatSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-2">
      <Shimmer className="h-4 w-28" />
      <Shimmer className="h-8 w-20" />
      <Shimmer className="h-3 w-36" />
    </div>
  );
}
