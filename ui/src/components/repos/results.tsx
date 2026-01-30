import React, { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

import { LoadingSpinner, Tool } from '@components';
import { getRepoResults } from '@thorpi';
import { updateURLSection, scrollToSection } from '@utilities';

interface RepoResultsProps {
  repoPath: string;
}

interface RepoResultsResponse {
  results: Record<string, any[]>;
}

const RepoResults: React.FC<RepoResultsProps> = ({ repoPath }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any[]>>({});
  const [numResults, setNumResults] = useState(0);
  const [error, setError] = useState('');
  const [inViewElements, setInViewElements] = useState<string[]>([]);

  useEffect(() => {
    let isSubscribed = true;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      const resultsRes = await getRepoResults(repoPath, setError, {}) as RepoResultsResponse | null;
      if (resultsRes && resultsRes.results && isSubscribed) {
        setNumResults(Object.keys(resultsRes.results).length);
        setResults(resultsRes.results);
      }
      setLoading(false);
    };
    void fetchData();
    return () => {
      isSubscribed = false;
    };
  }, [repoPath]);

  // Update whether an element is in the view port
  const updateInView = (inView: boolean, entry: string) => {
    if (inView) {
      setInViewElements((previousInViewElements) => [...previousInViewElements, entry].sort());
    } else {
      setInViewElements((previousInViewElements) => {
        return previousInViewElements.filter((element) => element != entry).sort();
      });
    }
  };

  // Remove hidden display typed results from results object
  const filteredResults = { ...results };
  Object.keys(filteredResults)
    .sort()
    .forEach((image) => {
      if (filteredResults[image][0]?.display_type === 'Hidden') {
        delete filteredResults[image];
      }
    });

  // Floating table of contents object
  const ResultsTableOfContents = ({ results }: { results: Record<string, any> }) => {
    return (
      <nav className="results-toc">
        <ul className="ul no-bullets">
          {Object.keys(results)
            .sort()
            .map((image) => (
              <li key={`results-${image}-toc`} className="results-toc-item">
                <a
                  href={`#results-${image}`}
                  onClick={() => scrollToSection(`results-tab-${image}`)}
                  className={`${inViewElements.includes(image) ? 'selected' : 'unselected'}`}
                >
                  {image}
                </a>
                <hr className="m-1" />
              </li>
            ))}
        </ul>
      </nav>
    );
  };

  return (
    <div id="results-tab" className="navbar-scroll-offset results-container">
      <LoadingSpinner loading={loading} />
      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}
      {filteredResults && typeof filteredResults === 'object' && !loading && (
        <>
          <div>
            {numResults === 0 && !loading && (
              <>
                <br />
                <Alert variant="" className="info">
                  <Alert.Heading>
                    <center>
                      <h3>No Tool Results Available</h3>
                    </center>
                  </Alert.Heading>
                  <center>
                    <p>Check back later for updated results</p>
                  </center>
                </Alert>
              </>
            )}
            {Object.keys(filteredResults)
              .sort()
              .map((image) => (
                <Tool
                  key={image}
                  header={image}
                  type={filteredResults[image][0]?.display_type ?? 'Json'}
                  tool={image}
                  sha256={repoPath}
                  updateInView={updateInView}
                  updateURLSection={updateURLSection}
                  result={filteredResults[image][0]}
                />
              ))}
          </div>
          {Object.keys(filteredResults).length > 0 && (
            <div className="results-toc-col">
              <ResultsTableOfContents results={filteredResults} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RepoResults;
