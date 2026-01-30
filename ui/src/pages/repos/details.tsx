import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Badge, Card, Col, Form, Nav, Row, Tab } from 'react-bootstrap';
import { FaGithub, FaGitlab, FaBitbucket, FaServer } from 'react-icons/fa';
import styled from 'styled-components';

import {
  AssociationGraph,
  AssociationTree,
  AlertBanner,
  Page,
  Subtitle,
  Time,
  LoadingSpinner,
  ReactionStatus,
  RunPipelines,
  Commits,
  RepoResults,
  RepoDownload,
  EditableRepoTags,
} from '@components';
import { updateURLSection, scrollToSection } from '@utilities';
import { getRepoDetails } from '@thorpi';
import { Repo, RepoScheme } from '@models';

const ValidTabs = ['commits', 'related', 'tree', 'results', 'runpipelines', 'reactionstatus', 'download'];

interface RepoDetailsContextType {
  repo: string;
  details: Repo | null;
  setDetails: (details: Repo) => void;
}

const RepoContext = createContext<RepoDetailsContextType | undefined>(undefined);

const useRepoContext = () => {
  const context = useContext(RepoContext);
  if (context === undefined) {
    throw new Error('useRepoContext must be used within a RepoContextProvider');
  }
  return context;
};

const ProviderIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
`;

// Get provider icon based on the provider name
const getProviderIcon = (provider: string) => {
  const lowerProvider = provider.toLowerCase();
  if (lowerProvider.includes('github')) {
    return <FaGithub size="60" className="icon" />;
  }
  if (lowerProvider.includes('gitlab')) {
    return <FaGitlab size="60" className="icon" />;
  }
  if (lowerProvider.includes('bitbucket')) {
    return <FaBitbucket size="60" className="icon" />;
  }
  return <FaServer size="60" className="icon" />;
};

// Get display string for scheme
const getSchemeDisplay = (scheme: RepoScheme | undefined): string => {
  if (!scheme) return 'Unknown';
  if (scheme.Https) return 'HTTPS';
  if (scheme.Http) return 'HTTP';
  if (scheme.HttpsAuthed) return 'HTTPS (Authenticated)';
  if (scheme.HttpAuthed) return 'HTTP (Authenticated)';
  if (scheme.ScrubbedAuth) return 'Authenticated (Scrubbed)';
  return 'Unknown';
};

const RepoHeader = () => {
  const { details } = useRepoContext();

  if (!details) return null;

  return (
    <Card className="panel">
      <Card.Body>
        <Row className="d-flex align-items-center">
          <Col xs="auto" className="me-3">
            <ProviderIconWrapper>
              {getProviderIcon(details.provider)}
            </ProviderIconWrapper>
          </Col>
          <Col>
            <Row>
              <Col>
                <h4 className="mb-1">{details.url}</h4>
              </Col>
            </Row>
            <Row>
              <Col>
                <Subtitle>
                  {details.provider} / {details.user} / {details.name}
                </Subtitle>
              </Col>
            </Row>
          </Col>
          <Col xs={2} className="text-center">
            <Subtitle>
              <center>Submissions</center>
            </Subtitle>
            <div className="circle">{details.submissions?.length || 0}</div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

const RepoInfo = () => {
  const { details } = useRepoContext();
  const [selectedSubIdx, setSelectedSubIdx] = useState(0);

  if (!details || !details.submissions || details.submissions.length === 0) {
    return null;
  }

  const selectedSub = details.submissions[selectedSubIdx];

  return (
    <>
      {details.submissions.length > 1 && (
        <Row className="my-3">
          <Col xs="auto" className="mt-3">
            <p>Select submission:</p>
          </Col>
          <Col className="mt-1">
            <Form.Control
              className="form-select"
              as="select"
              name="submission"
              value={selectedSubIdx}
              onChange={(e) => setSelectedSubIdx(parseInt(e.target.value))}
            >
              {details.submissions.map((sub, idx) => (
                <option key={idx} value={idx}>
                  {sub.id}
                </option>
              ))}
            </Form.Control>
          </Col>
        </Row>
      )}
      <Card className="panel">
        <Card.Body>
          <Row>
            <Col xs={1} className="me-2 info-icon">
              {getProviderIcon(details.provider)}
            </Col>
            <Col className="lg-center-col" xs={6}>
              <Row className="flex-nowrap">
                <Col xs={2} className="details-col">
                  <Subtitle>Submission</Subtitle>
                </Col>
                <Col xs={9} className="flex-wrap">
                  <p>{selectedSub.id}</p>
                </Col>
              </Row>
              <Row className="flex-nowrap">
                <Col className="details-col" xs={2}>
                  <Subtitle>Creator</Subtitle>
                </Col>
                <Col xs={9} className="flex-wrap">
                  <p>{selectedSub.creator}</p>
                </Col>
              </Row>
              <Row>
                <Col xs={2} className="details-col">
                  <Subtitle>Scheme</Subtitle>
                </Col>
                <Col xs={9} className="flex-wrap">
                  <p>{getSchemeDisplay(selectedSub.scheme)}</p>
                </Col>
              </Row>
              <Row className="lg-show-row">
                <Row>
                  <Col className="details-col" xs={2}>
                    <Subtitle>Uploaded</Subtitle>
                  </Col>
                  <Col>
                    <p>
                      <Time verbose>{selectedSub.uploaded}</Time>
                    </p>
                  </Col>
                </Row>
                <Row>
                  <Col className="details-col" xs={2}>
                    <Subtitle>Groups</Subtitle>
                  </Col>
                  <Col>
                    <p>
                      {selectedSub.groups.map((group, idx) => (
                        <Badge key={idx} pill bg="" className="bg-blue py-2 px-3 me-1">
                          {group}
                        </Badge>
                      ))}
                    </p>
                  </Col>
                </Row>
                {selectedSub.earliest && (
                  <Row>
                    <Col className="details-col" xs={2}>
                      <Subtitle>Earliest Commit</Subtitle>
                    </Col>
                    <Col>
                      <code>{selectedSub.earliest}</code>
                    </Col>
                  </Row>
                )}
              </Row>
            </Col>
            <Col className="lg-hide-col">
              <Row>
                <Col className="details-col" xs={3}>
                  <Subtitle>Uploaded</Subtitle>
                </Col>
                <Col>
                  <p>
                    <Time verbose>{selectedSub.uploaded}</Time>
                  </p>
                </Col>
              </Row>
              <Row>
                <Col className="details-col" xs={3}>
                  <Subtitle>Groups</Subtitle>
                </Col>
                <Col>
                  <p>
                    {selectedSub.groups.map((group, idx) => (
                      <Badge key={idx} pill bg="" className="bg-blue py-2 px-3 me-1">
                        {group}
                      </Badge>
                    ))}
                  </p>
                </Col>
              </Row>
              {selectedSub.earliest && (
                <Row>
                  <Col className="details-col" xs={3}>
                    <Subtitle>Earliest Commit</Subtitle>
                  </Col>
                  <Col>
                    <code>{selectedSub.earliest}</code>
                  </Col>
                </Row>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </>
  );
};

const RepoDetailsContainer = () => {
  const { '*': repoPath } = useParams<{ '*': string }>();
  const repo = repoPath || '';

  const [details, setDetails] = useState<Repo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewGraph, setViewGraph] = useState(false);
  const [reactionsTabSelected, setReactionsTabSelected] = useState(false);

  const location = useLocation();
  const section =
    location.hash && ValidTabs.includes(location.hash.replace('#', '').split('-')[0])
      ? location.hash.replace('#', '').split('-')
      : [];

  // Fetch repo details
  useEffect(() => {
    const fetchRepoDetails = async () => {
      setLoading(true);
      const reqDetails = await getRepoDetails(repo, setError);
      if (reqDetails) {
        setDetails(reqDetails);
      }
      setLoading(false);
    };
    void fetchRepoDetails();
  }, [repo]);

  // Jump to correct tab/subsection when page is loaded
  useEffect(() => {
    const triggerPageScroll = () => {
      switch (section[0]) {
        case 'related':
          setViewGraph(true);
          break;
        case 'reactionstatus':
          setReactionsTabSelected(true);
          break;
        default:
          if (section.length > 0) {
            setTimeout(() => scrollToSection(`${section[0]}-tab`), 1500);
          }
          break;
      }
    };

    if (Array.isArray(section) && section.length) {
      triggerPageScroll();
    } else {
      setTimeout(() => window.scrollTo(0, 0), 10);
    }
  }, []);

  const handleTabChange = (key: string | null) => {
    if (!key) return;

    switch (key) {
      case 'reactionstatus':
        setReactionsTabSelected(true);
        updateURLSection(key, '');
        setViewGraph(false);
        break;
      case 'related':
        updateURLSection(key, '');
        setReactionsTabSelected(false);
        setViewGraph(true);
        break;
      default:
        updateURLSection(key, '');
        setReactionsTabSelected(false);
        setViewGraph(false);
        break;
    }
  };

  return (
    <RepoContext.Provider value={{ repo, details, setDetails }}>
      <Page id="repo-info" className="full-min-width" title={`Repo - ${repo}`}>
        {loading && <LoadingSpinner loading={loading} />}
        {!loading && error && <AlertBanner variant="danger" errorStatus={error} prefix="" />}
        {!loading && details && (
          <>
            <RepoHeader />
            <Row className="mt-4">
              <Col className="tags">
                <EditableRepoTags
                  repoPath={repo}
                  tags={details.tags || {}}
                  setDetails={setDetails}
                />
              </Col>
            </Row>
            <RepoInfo />
            <hr />
            <Tab.Container
              defaultActiveKey={Array.isArray(section) && section.length ? section[0] : 'commits'}
              onSelect={handleTabChange}
            >
              <Nav variant="pills">
                <Nav.Item className="details-navitem">
                  <Nav.Link className="details-navlink" eventKey="commits">
                    Commits
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item className="details-navitem">
                  <Nav.Link className="details-navlink" eventKey="related">
                    Related
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item className="details-navitem">
                  <Nav.Link className="details-navlink" eventKey="tree">
                    Repo Tree
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item className="details-navitem">
                  <Nav.Link className="details-navlink" eventKey="results">
                    Results
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item className="details-navitem">
                  <Nav.Link className="details-navlink" eventKey="runpipelines">
                    Create Reactions
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item className="details-navitem">
                  <Nav.Link className="details-navlink" eventKey="reactionstatus">
                    Reaction Status
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item className="details-navitem">
                  <Nav.Link className="details-navlink" eventKey="download">
                    Download
                  </Nav.Link>
                </Nav.Item>
              </Nav>
              <Tab.Content>
                <Tab.Pane eventKey="commits" className="mt-4">
                  <Commits repoPath={repo} />
                </Tab.Pane>
                <Tab.Pane eventKey="related" className="mt-4">
                  <AssociationGraph inView={viewGraph} initial={{ repos: [repo] }} />
                </Tab.Pane>
                <Tab.Pane eventKey="tree" className="mt-4">
                  <AssociationTree initial={{ repos: [repo] }} />
                </Tab.Pane>
                <Tab.Pane eventKey="results" className="mt-4">
                  <RepoResults repoPath={repo} />
                </Tab.Pane>
                <Tab.Pane eventKey="runpipelines" className="mt-4">
                  <RunPipelines sha256={undefined} repoPath={repo} />
                </Tab.Pane>
                <Tab.Pane eventKey="reactionstatus" className="mt-4">
                  <ReactionStatus sha256={undefined} repoPath={repo} autoRefresh={reactionsTabSelected} />
                </Tab.Pane>
                <Tab.Pane eventKey="download" className="mt-4">
                  <RepoDownload repoPath={repo} />
                </Tab.Pane>
              </Tab.Content>
            </Tab.Container>
          </>
        )}
      </Page>
    </RepoContext.Provider>
  );
};

export default RepoDetailsContainer;
