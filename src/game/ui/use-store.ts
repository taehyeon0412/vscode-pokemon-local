import { useEffect, useState } from 'preact/hooks';
import type { Store } from './store';

/** Store 값을 읽고, 바뀌면 다시 그림 */
export function useStore<T extends object>(store: Store<T>): T {
  const [value, setValue] = useState(() => store.get());
  useEffect(() => {
    setValue(store.get()); // 구독 전에 바뀐 것
    return store.subscribe(() => setValue(store.get()));
  }, [store]);
  return value;
}
