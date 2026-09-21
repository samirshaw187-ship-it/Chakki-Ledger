import { useState, useEffect } from 'react';
import { dbRepository } from './in-memory-db';

/**
 * Custom React hook that subscribes to real-time changes in dbRepository.
 * Whenever any transaction, customer, payment, inventory movement, wholesaler,
 * or user is modified, components consuming this hook automatically re-render
 * with the latest consistent data.
 */
export function useDatabaseSync(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = dbRepository.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  return version;
}
