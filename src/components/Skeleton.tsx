import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ className = '', width, height, style }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
    />
  );
}

export function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="block">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton height="1rem" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex}>
                  <Skeleton height="1rem" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div className="block">
      <div className="form-section">
        <Skeleton height="2rem" width="40%" style={{ marginBottom: '1.5rem' }} />

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <Skeleton height="0.875rem" width="100px" style={{ marginBottom: '0.5rem' }} />
          <Skeleton height="2.5rem" />
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <Skeleton height="0.875rem" width="120px" style={{ marginBottom: '0.5rem' }} />
          <Skeleton height="2.5rem" />
        </div>

        <div className="form-group">
          <Skeleton height="0.875rem" width="80px" style={{ marginBottom: '0.5rem' }} />
          <Skeleton height="6rem" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="block" style={{ padding: '1.5rem' }}>
      <Skeleton height="1.5rem" width="60%" style={{ marginBottom: '1rem' }} />
      <Skeleton height="1rem" width="100%" style={{ marginBottom: '0.5rem' }} />
      <Skeleton height="1rem" width="100%" style={{ marginBottom: '0.5rem' }} />
      <Skeleton height="1rem" width="80%" />
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
