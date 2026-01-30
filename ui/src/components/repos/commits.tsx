import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { FaCodeBranch, FaTag, FaHistory } from 'react-icons/fa';

import { LoadingSpinner, Subtitle, Time } from '@components';
import { getCommitishDetails } from '@thorpi';
import { CommitishDetails, CommitishKinds } from '@models';

interface CommitsProps {
  repoPath: string;
}

// Helper to extract the type of a commitish
const getCommitishType = (commitish: CommitishDetails): CommitishKinds => {
  if ('Commit' in commitish) return 'Commit';
  if ('Branch' in commitish) return 'Branch';
  return 'Tag';
};

// Get icon for commitish type
const getCommitishIcon = (kind: CommitishKinds) => {
  switch (kind) {
    case 'Branch':
      return <FaCodeBranch className="me-2" />;
    case 'Tag':
      return <FaTag className="me-2" />;
    default:
      return <FaHistory className="me-2" />;
  }
};

// Get badge variant for commitish type
const getCommitishBadgeVariant = (kind: CommitishKinds) => {
  switch (kind) {
    case 'Branch':
      return 'success';
    case 'Tag':
      return 'warning';
    default:
      return 'primary';
  }
};

// Single commitish item component
const CommitishItem = ({ commitish }: { commitish: CommitishDetails }) => {
  const [expanded, setExpanded] = useState(false);
  const kind = getCommitishType(commitish);

  // Extract data based on type for proper type narrowing
  const commitData = 'Commit' in commitish ? commitish.Commit : null;
  const branchData = 'Branch' in commitish ? commitish.Branch : null;
  const tagData = 'Tag' in commitish ? commitish.Tag : null;

  // Get common data
  const data = commitData || branchData || tagData;
  if (!data) return null;

  const identifier = commitData ? commitData.hash : (branchData?.name || tagData?.name || '');
  const shortId = identifier.length > 12 ? identifier.substring(0, 12) + '...' : identifier;

  return (
    <Card className="mb-2">
      <Card.Body className="py-2">
        <Row className="align-items-center">
          <Col xs="auto">
            {getCommitishIcon(kind)}
          </Col>
          <Col xs={2}>
            <Badge bg={getCommitishBadgeVariant(kind)}>{kind}</Badge>
          </Col>
          <Col xs={3}>
            <code title={identifier}>{shortId}</code>
          </Col>
          <Col xs={2}>
            {data.groups.map((group, idx) => (
              <Badge key={idx} bg="secondary" className="me-1">
                {group}
              </Badge>
            ))}
          </Col>
          <Col xs={3}>
            <Time>{data.timestamp}</Time>
          </Col>
          <Col xs="auto">
            {(commitData || tagData) && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Less' : 'More'}
              </Button>
            )}
          </Col>
        </Row>
        {expanded && commitData && (
          <Row className="mt-2 ps-4">
            <Col>
              <div><Subtitle>Author:</Subtitle> {commitData.author}</div>
              {commitData.topic && (
                <div><Subtitle>Topic:</Subtitle> {commitData.topic}</div>
              )}
              {commitData.description && (
                <div>
                  <Subtitle>Description:</Subtitle>
                  <pre className="mt-1 p-2 bg-light" style={{ whiteSpace: 'pre-wrap' }}>
                    {commitData.description}
                    {commitData.truncated && <i>... (truncated)</i>}
                  </pre>
                </div>
              )}
            </Col>
          </Row>
        )}
        {expanded && branchData && (
          <Row className="mt-2 ps-4">
            <Col>
              <div><Subtitle>Latest Commit:</Subtitle> <code>{branchData.commit}</code></div>
            </Col>
          </Row>
        )}
        {expanded && tagData && (
          <Row className="mt-2 ps-4">
            <Col>
              <div><Subtitle>Author:</Subtitle> {tagData.author}</div>
              <div><Subtitle>Commit:</Subtitle> <code>{tagData.commit}</code></div>
            </Col>
          </Row>
        )}
      </Card.Body>
    </Card>
  );
};

const Commits: React.FC<CommitsProps> = ({ repoPath }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [commitishList, setCommitishList] = useState<CommitishDetails[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  // Filter state
  const [showCommits, setShowCommits] = useState(true);
  const [showBranches, setShowBranches] = useState(true);
  const [showTags, setShowTags] = useState(true);

  const buildKindsFilter = (): CommitishKinds[] => {
    const kinds: CommitishKinds[] = [];
    if (showCommits) kinds.push('Commit');
    if (showBranches) kinds.push('Branch');
    if (showTags) kinds.push('Tag');
    return kinds;
  };

  const fetchCommitish = async (loadMore = false) => {
    setLoading(true);
    setError('');

    const kinds = buildKindsFilter();
    if (kinds.length === 0) {
      setCommitishList([]);
      setLoading(false);
      return;
    }

    const params = {
      kinds,
      limit: 50,
      cursor: loadMore ? cursor : undefined,
    };

    const result = await getCommitishDetails(repoPath, params, setError);
    if (result) {
      if (loadMore) {
        setCommitishList((prev) => [...prev, ...result.data]);
      } else {
        setCommitishList(result.data);
      }
      setCursor(result.cursor);
      setHasMore(!!result.cursor);
    }
    setLoading(false);
  };

  // Fetch on mount and when filters change
  useEffect(() => {
    void fetchCommitish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, showCommits, showBranches, showTags]);

  return (
    <div id="commits-tab">
      <Card className="mb-3">
        <Card.Body>
          <Row className="align-items-center">
            <Col xs="auto">
              <Subtitle>Filter by type:</Subtitle>
            </Col>
            <Col>
              <Form.Check
                inline
                type="checkbox"
                id="filter-commits"
                label="Commits"
                checked={showCommits}
                onChange={(e) => setShowCommits(e.target.checked)}
              />
              <Form.Check
                inline
                type="checkbox"
                id="filter-branches"
                label="Branches"
                checked={showBranches}
                onChange={(e) => setShowBranches(e.target.checked)}
              />
              <Form.Check
                inline
                type="checkbox"
                id="filter-tags"
                label="Tags"
                checked={showTags}
                onChange={(e) => setShowTags(e.target.checked)}
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}

      <LoadingSpinner loading={loading && commitishList.length === 0} />

      {!loading && commitishList.length === 0 && !error && (
        <Alert variant="info">
          <Alert.Heading>
            <center>No Commits/Branches/Tags Found</center>
          </Alert.Heading>
          <center>
            <p>This repository has no commitish entries matching the selected filters.</p>
          </center>
        </Alert>
      )}

      {commitishList.map((commitish, idx) => (
        <CommitishItem key={idx} commitish={commitish} />
      ))}

      {hasMore && (
        <Row className="d-flex justify-content-center mt-3">
          <Col xs="auto">
            <Button
              variant="primary"
              onClick={() => fetchCommitish(true)}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </Button>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Commits;
