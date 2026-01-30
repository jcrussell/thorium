import React, { useState } from 'react';
import { Alert, Col, Form, Row } from 'react-bootstrap';
import { FaDownload } from 'react-icons/fa';

import { downloadRepo } from '@thorpi';

interface RepoDownloadProps {
  repoPath: string;
}

const downloadRepoFile = async (
  repoPath: string,
  setDownloadError: (error: string) => void,
  commitish?: string,
) => {
  const res = await downloadRepo(repoPath, setDownloadError, undefined, commitish);
  if (res) {
    // Turn response data to blob object
    const blob = new Blob([res]);
    // Map url to blob in memory
    const url = window.URL.createObjectURL(blob);
    // Create anchor tag for blob link
    const link = document.createElement('a');
    // Assign href
    link.href = url;
    // Build filename from repo path
    const filename = repoPath.replace(/\//g, '_') + '.tar.cart';
    // Set link as download
    link.setAttribute('download', filename);
    // Append to html link element page
    document.body.appendChild(link);
    // Start download
    link.click();
    // Clean up and remove the link
    link.parentNode?.removeChild(link);
  }
};

const RepoDownload: React.FC<RepoDownloadProps> = ({ repoPath }) => {
  const [downloadError, setDownloadError] = useState('');
  const [commitish, setCommitish] = useState('');

  return (
    <div className="mt-4" id="download-tab">
      {downloadError && (
        <Row>
          <Col>
            <Alert variant="warning" className="d-flex justify-content-center">
              {downloadError}
            </Alert>
          </Col>
        </Row>
      )}
      <Form>
        <Row className="d-flex justify-content-center">
          <Col className="d-flex justify-content-end mt-3">Format</Col>
          <Col className="d-flex justify-content-start">
            <Form.Group controlId="downloadForm.FormatDisplay">
              <Form.Control type="text" value="CaRT (tar.cart)" disabled />
            </Form.Group>
          </Col>
        </Row>
        <Row className="d-flex justify-content-center mt-3">
          <Col className="d-flex justify-content-end mt-3">
            <span>Commitish (optional)</span>
          </Col>
          <Col className="d-flex justify-content-start">
            <Form.Group controlId="downloadForm.CommitishInput">
              <Form.Control
                type="text"
                value={commitish}
                placeholder="branch, tag, or commit hash"
                onChange={(e) => setCommitish(String(e.target.value))}
              />
            </Form.Group>
          </Col>
        </Row>
        <Row className="d-flex justify-content-center mt-2">
          <Col className="d-flex justify-content-center">
            <small className="text-muted">
              Leave empty to download the default checkout (usually HEAD of main branch)
            </small>
          </Col>
        </Row>
      </Form>
      <Row>
        <Col className="d-flex justify-content-center mt-5">
          <a
            className="d-flex justify-content-center download-btn"
            href="#download"
            onClick={() => void downloadRepoFile(repoPath, setDownloadError, commitish || undefined)}
          >
            <FaDownload size="120" />
          </a>
        </Col>
      </Row>
    </div>
  );
};

export default RepoDownload;
