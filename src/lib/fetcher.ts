// Shared SWR fetcher used by the client-side pollers (queue badge, results page,
// download page). A GET that throws a `DataFetchError` (carrying the response
// body + status) on a non-2xx response so SWR surfaces it as `error`.

export class DataFetchError extends Error {
  info: string | undefined = undefined;
  status: number | undefined = undefined;
}

export async function fetcher(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "GET",
  });

  if (!res.ok) {
    const error = new DataFetchError(
      "An error occured while fetching the data."
    );
    error.info = await res.json();
    error.status = res.status;
    throw error;
  }
  return res.json();
}
