// import the base client function that loads from the config
// and injects the token via axios intercepts
import client, { parseRequestError } from './client';
import { Filters, CommitishListParams, CommitishCursor, Repo, CreateTags } from '@models';

/**
 * Get a list of repos by date range.
 * @async
 * @function
 * @param {object} [data] - optional request parameters which includes:
 *   - groups: to which the repos are viewable
 *   - start: start date for search range
 *   - end: end date for search range
 *   - limit:  the max number of submissions to return
 * @param {(error: string) => void} errorHandler - error handler function
 * @param {boolean} [details] - whether to return details for listed submissions
 * @param {string} cursor - the cursor value to continue listing from
 * @returns {Promise<{entityList: any: entityCursor} | null>} - Promise object representing a list of file details.
 */
export async function listRepos(
  data: Filters,
  errorHandler: (error: string) => void,
  details?: boolean | null,
  cursor?: string | null,
): Promise<{ entityList: any[]; entityCursor: string | null }> {
  // build url parameters including optional args if specified
  let url = '/repos';
  if (details) {
    url += '/details/';
  }
  // pass in cursor value
  if (cursor) {
    data['cursor'] = cursor;
  }
  return client
    .get(url, { params: data })
    .then((res) => {
      if (res?.status == 200 && res.data) {
        const cursor = res.data.cursor ? (res.data.cursor as string) : null;
        return { entityList: res.data.data as any[], entityCursor: cursor };
      }
      return { entityList: [], entityCursor: null };
    })
    .catch((error) => {
      parseRequestError(error, errorHandler, 'List Repos');
      return { entityList: [], entityCursor: null };
    });
}

/**
 * Get full details for a repository.
 * @async
 * @function
 * @param {string} repoPath - The full repo path (e.g., github.com/user/repo)
 * @param {(error: string) => void} errorHandler - error handler function
 * @returns {Promise<Repo | null>} - Promise object representing repo details
 */
export async function getRepoDetails(repoPath: string, errorHandler: (error: string) => void): Promise<Repo | null> {
  const url = `/repos/data/${repoPath}`;
  return client
    .get(url)
    .then((res) => {
      if (res?.status == 200 && res.data) {
        return res.data as Repo;
      }
      return null;
    })
    .catch((error) => {
      parseRequestError(error, errorHandler, 'Get Repo Details');
      return null;
    });
}

/**
 * Get commitish details (commits, branches, tags) for a repository.
 * @async
 * @function
 * @param {string} repoPath - The full repo path
 * @param {CommitishListParams} params - Query parameters for filtering
 * @param {(error: string) => void} errorHandler - error handler function
 * @returns {Promise<CommitishCursor | null>} - Paginated list of commitish details
 */
export async function getCommitishDetails(
  repoPath: string,
  params: CommitishListParams,
  errorHandler: (error: string) => void,
): Promise<CommitishCursor | null> {
  const url = `/repos/commitish-details/${repoPath}`;
  return client
    .get(url, { params })
    .then((res) => {
      if (res?.status == 200 && res.data) {
        return res.data as CommitishCursor;
      }
      return null;
    })
    .catch((error) => {
      parseRequestError(error, errorHandler, 'Get Commitish Details');
      return null;
    });
}

/**
 * Get analysis results for a repository.
 * @async
 * @function
 * @param {string} repoPath - The full repo path
 * @param {(error: string) => void} errorHandler - error handler function
 * @param {object} data - optional search parameters
 * @returns {Promise<any | null>} - Results dict
 */
export async function getRepoResults(
  repoPath: string,
  errorHandler: (error: string) => void,
  data = {},
): Promise<any | null> {
  const url = `/repos/results/${repoPath}`;
  return client
    .get(url, data)
    .then((res) => {
      if (res?.status == 200 && res.data) {
        return res.data;
      }
      return null;
    })
    .catch((error) => {
      parseRequestError(error, errorHandler, 'Get Repo Results');
      return null;
    });
}

/**
 * Download a repository as a CaRT file.
 * @async
 * @function
 * @param {string} repoPath - The full repo path
 * @param {(error: string) => void} errorHandler - error handler function
 * @param {string[]} [kinds] - Optional commitish kinds to include
 * @param {string} [commitish] - Optional specific commitish to checkout
 * @returns {Promise<ArrayBuffer | null>} - The downloaded repo archive
 */
export async function downloadRepo(
  repoPath: string,
  errorHandler: (error: string) => void,
  kinds?: string[],
  commitish?: string,
): Promise<ArrayBuffer | null> {
  const url = `/repos/download/${repoPath}`;
  const params: { kinds?: string[]; commitish?: string } = {};
  if (kinds && kinds.length > 0) {
    params.kinds = kinds;
  }
  if (commitish) {
    params.commitish = commitish;
  }
  return client
    .get(url, { params, responseType: 'arraybuffer' })
    .then((res) => {
      if (res?.status == 200 && res.data) {
        return res.data as ArrayBuffer;
      }
      return null;
    })
    .catch((error) => {
      parseRequestError(error, errorHandler, 'Download Repo');
      return null;
    });
}

/**
 * Add tags to a repository.
 * @async
 * @function
 * @param {string} repoPath - The full repo path
 * @param {{ tags: CreateTags }} data - Tags to add wrapped in { tags: ... }
 * @param {(error: string) => void} errorHandler - error handler function
 * @returns {Promise<boolean>} - Success status
 */
export async function uploadRepoTags(
  repoPath: string,
  data: { tags: CreateTags },
  errorHandler: (error: string) => void,
): Promise<boolean> {
  const url = `/repos/tags/${repoPath}`;
  return client
    .post(url, data)
    .then((res) => {
      if (res?.status == 204) {
        return true;
      }
      return false;
    })
    .catch((error) => {
      parseRequestError(error, errorHandler, 'Create Repo Tags');
      return false;
    });
}

/**
 * Delete tags from a repository.
 * @async
 * @function
 * @param {string} repoPath - The full repo path
 * @param {{ tags: CreateTags }} data - Tags to delete wrapped in { tags: ... }
 * @param {(error: string) => void} errorHandler - error handler function
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteRepoTags(
  repoPath: string,
  data: { tags: CreateTags },
  errorHandler: (error: string) => void,
): Promise<boolean> {
  const url = `/repos/tags/${repoPath}`;
  return client
    .delete(url, { data })
    .then((res) => {
      if (res?.status == 204) {
        return true;
      }
      return false;
    })
    .catch((error) => {
      parseRequestError(error, errorHandler, 'Delete Repo Tags');
      return false;
    });
}

/**
 * Get a result file for a repository.
 * @async
 * @function
 * @param {string} repoPath - The full repo path
 * @param {string} tool - Name of image that created the result
 * @param {string} resultId - ID of the result
 * @param {string} fileName - Name of result file to retrieve
 * @param {(error: string) => void} errorHandler - error handler function
 * @returns {Promise<any | null>} - The result file response
 */
export async function getRepoResultsFile(
  repoPath: string,
  tool: string,
  resultId: string,
  fileName: string,
  errorHandler: (error: string) => void,
): Promise<any | null> {
  const url = `/repos/result-files/${repoPath}/${tool}/${resultId}`;
  const data = {
    result_file: fileName,
  };
  return client
    .get(url, { params: data, responseType: 'arraybuffer' })
    .then((res) => {
      if (res?.status == 200) {
        return res;
      }
      return null;
    })
    .catch((error) => {
      parseRequestError(error, errorHandler, 'Get Repo Results File');
      return null;
    });
}
