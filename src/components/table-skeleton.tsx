export function TableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return <>
    {Array.from({ length: rows }).map((_, row) => (
      <tr key={row} className="skeleton-row">
        {Array.from({ length: columns }).map((__, column) => (
          <td key={column}><span className="skeleton-line" /></td>
        ))}
      </tr>
    ))}
  </>;
}
