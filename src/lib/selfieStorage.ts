const DATABASE_NAME = 'travelling-local-media';
const STORE_NAME = 'selfies';

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Browser image storage is unavailable.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open image storage.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error || new Error('Could not access image storage.'));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Image storage transaction failed.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Image storage transaction was aborted.'));
    };
  });
}

export function saveLocalSelfie(id: string, image: Blob) {
  return withStore('readwrite', (store) => store.put(image, id)).then(() => undefined);
}

export function loadLocalSelfie(id: string) {
  return withStore('readonly', (store) => store.get(id)) as Promise<Blob | undefined>;
}

export function removeLocalSelfie(id: string) {
  return withStore('readwrite', (store) => store.delete(id)).then(() => undefined);
}
