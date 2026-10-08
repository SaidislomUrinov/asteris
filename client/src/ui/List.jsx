import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import Loading from "./Loading";

/**
 * Umumiy ro'yxat (table) komponenti — barcha paginatsiyali listlar shu orqali chiqadi.
 *
 * @param {Object} props
 * @param {Array<{key: string, header: React.ReactNode, className?: string, render: (row: any, index: number) => React.ReactNode}>} props.columns
 * @param {Array<any>} props.rows
 * @param {(row: any, index: number) => string} [props.rowKey]
 * @param {(row: any, index: number) => string} [props.rowClassName] - qatorga qo'shimcha class (masalan realtime highlight uchun)
 * @param {boolean} [props.loading]
 * @param {React.ReactNode} [props.empty] - bo'sh holat matni
 * @param {number} [props.page]
 * @param {number} [props.totalPages]
 * @param {number} [props.total]
 * @param {(page: number) => void} [props.onPageChange]
 * @param {boolean} [props.showPagination]
 * @param {string} [props.className]
 * @param {"table"|"grid"} [props.view] - "grid" bo'lsa table o'rniga `renderItem` orqali karta grid chiqadi
 * @param {(row: any, index: number) => React.ReactNode} [props.renderItem] - view="grid" uchun
 * @param {string} [props.gridClassName]
 */
function List({
  columns,
  rows = [],
  rowKey = (row, index) => row?._id ?? index,
  rowClassName = () => "",
  loading = false,
  empty,
  page = 1,
  totalPages = 1,
  onPageChange = () => {},
  showPagination = false,
  className = "",
  view = "table",
  renderItem,
  gridClassName = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-3",
  toolbar,
}) {
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div
      className={`flex flex-col w-full flex-1 min-h-0 bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 rounded-xl overflow-hidden ${className}`}
    >
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <Loading height="40vh" />
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center w-full h-40 text-slate-400 dark:text-slate-500 text-sm">
            {empty}
          </div>
        ) : view === "grid" ? (
          <div className={gridClassName}>
            {rows.map((row, index) => (
              <div key={rowKey(row, index)}>{renderItem(row, index)}</div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm min-w-max">
            {/* z-1 — Navbar (z-3), mobil tab-bar (z-2) va modal (z-30)dan
                PAST bo'lishi shart, aks holda sticky sarlavha ular ustiga
                chiqib ketadi. Jadval qatorlarida z-index yo'q, shuning uchun
                sarlavhani ular ustida ushlab turishga z-1 yetarli. */}
            <thead className="sticky top-0 z-1">
              <tr className="bg-slate-50 dark:bg-night-800 text-left text-slate-500 dark:text-slate-400 text-[12px] uppercase">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 font-semibold whitespace-nowrap ${col.className || ""}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  className={`relative border-t border-slate-100 dark:border-night-700 bg-white dark:bg-night-900 hover:bg-slate-50 dark:hover:bg-night-800 transition-colors ${rowClassName(row, index)}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 whitespace-nowrap ${col.className || ""}`}
                    >
                      {col.render ? col.render(row, index) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(toolbar || (showPagination && totalPages > 1)) && (
        <div className="flex items-center justify-between gap-1.5 w-full px-3 py-2.5 border-t border-slate-100 dark:border-night-700 shrink-0">
          <div className="flex items-center gap-1.5">{toolbar}</div>

          {showPagination && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent duration-200"
              >
                <HiChevronLeft />
              </button>

              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span
                    key={`dots-${i}`}
                    className="inline-flex items-center justify-center w-8 h-8 text-slate-400 dark:text-slate-500 text-sm"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    type="button"
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium duration-200 ${
                      p === page
                        ? "bg-slate-800 dark:bg-night-600 text-white"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-night-700"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent duration-200"
              >
                <HiChevronRight />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getPageNumbers(page, totalPages) {
  const delta = 1;
  const range = [];
  const rangeWithDots = [];
  let last;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      range.push(i);
    }
  }

  for (const i of range) {
    if (last) {
      if (i - last === 2) rangeWithDots.push(last + 1);
      else if (i - last > 2) rangeWithDots.push("...");
    }
    rangeWithDots.push(i);
    last = i;
  }

  return rangeWithDots;
}

export default List;
