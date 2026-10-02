import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

/**
 * Umumiy donut komponent — tariflar taqsimoti va obuna holati uchun
 * qayta ishlatiladi.
 *
 * @param {string} title
 * @param {string} [subtitle]
 * @param {Array<{label: string, value: number, color?: string}>} items
 * @param {string} [emptyText]
 */
export default function DistributionDonut({ title, subtitle, items = [], emptyText }) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const data = items.filter((i) => i.value > 0);

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 bg-white h-full">
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold text-slate-800">{title}</p>
        {subtitle && <p className="text-[12px] text-slate-400">{subtitle}</p>}
      </div>

      {total === 0 ? (
        <div className="flex-1 min-h-40 flex items-center justify-center text-[13px] text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="flex-1 min-h-40 flex items-center gap-4">
          <div className="w-28 h-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="65%"
                  outerRadius="100%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.label} fill={entry.color || PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, name]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            {data.map((entry, i) => (
              <div key={entry.label} className="flex items-center gap-2 text-[12px] min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || PALETTE[i % PALETTE.length] }}
                />
                <span className="text-slate-600 truncate flex-1">{entry.label}</span>
                <span className="font-semibold text-slate-800 shrink-0">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
