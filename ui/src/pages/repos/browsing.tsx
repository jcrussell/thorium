import React, { useState } from 'react';
import { Link } from 'react-router';
import { Col, Row } from 'react-bootstrap';
import styled from 'styled-components';

// project imports
import { BrowsingCard, BrowsingContents, BrowsingFilters, CondensedEntityTags, EntityList, LinkFields, Page } from '@components';
import { getUniqueSubmissionGroups, useAuth } from '@utilities';
import { listRepos } from '@thorpi';
import { Entities, Filters } from '@models';
import { scaling } from '@styles';

// get repos using filters and and an optional cursor
const getRepos = async (filters: Filters, cursor: string | null) => {
  // get files list from API
  const { entityList, entityCursor } = await listRepos(
    filters,
    console.log,
    true, // details bool
    cursor,
  );
  return {
    entitiesList: entityList,
    entitiesCursor: entityCursor,
  };
};

const Name = styled(Col)`
  white-space: pre-wrap;
  word-break: break-all;
  min-width: 600px;
  color: var(--thorium-text);
  @media (max-width: ${scaling.md}) {
    min-width: 70%;
  }
  @media (max-width: ${scaling.sm}) {
    min-width: 300px;
  }
`;

const Submissions = styled(Col)`
  min-width: 100px;
  text-align: center;
  color: var(--thorium-text);
  @media (max-width: ${scaling.xxl}) {
    display: none !important;
  }
`;

const Groups = styled(Col)`
  flex-wrap: wrap;
  text-align: center;
  min-width: 150px;
  color: var(--thorium-text);
  @media (max-width: ${scaling.lg}) {
    display: none !important;
  }
`;

const Submitters = styled(Col)`
  flex-wrap: wrap;
  text-align: center;
  min-width: 150px;
  color: var(--thorium-text);
  @media (max-width: ${scaling.xl}) {
    display: none !important;
  }
`;

const Url = styled.div`
  font-size: 0.8rem;
  font-style: italic;
`;

const RepoListHeaders = () => {
  return (
    <BrowsingCard>
      <BrowsingContents>
        <Row>
          <Name>Repo</Name>
          <Submissions>Submissions</Submissions>
          <Groups>Group(s)</Groups>
          <Submitters>Submitter(s)</Submitters>
        </Row>
      </BrowsingContents>
    </BrowsingCard>
  );
};

interface RepoItemProps {
  repo: any; // repo details
}

// Get unique creators/submitters from repo submissions
const getUniqueSubmitters = (submissions: any[]): string[] => {
  return [...new Set(submissions.map((s) => s.creator))];
};

const RepoItem: React.FC<RepoItemProps> = ({ repo }) => {
  const groups = getUniqueSubmissionGroups(repo.submissions);
  const submitters = getUniqueSubmitters(repo.submissions);

  return (
    <BrowsingCard>
      <BrowsingContents>
        <Link to={`/repo/${repo.url}`} state={{ repo: repo }} className="no-decoration">
          <LinkFields>
            <Name>{repo.name}</Name>
            <Submissions>{repo.submissions.length}</Submissions>
            <Groups>
              <small>
                <i>
                  {groups.toString().length > 75
                    ? groups.toString().replaceAll(',', ', ').substring(0, 75) + '...'
                    : groups.toString().replaceAll(',', ', ')}
                </i>
              </small>
            </Groups>
            <Submitters>
              <small>
                <i>
                  {submitters.toString().length > 75
                    ? submitters.toString().replaceAll(',', ', ').substring(0, 75) + '...'
                    : submitters.toString().replaceAll(',', ', ')}
                </i>
              </small>
            </Submitters>
          </LinkFields>
        </Link>
        <Url className="mt-3 mb-2">{repo.url}</Url>
        <Row>
          {repo.tags && Object.keys(repo.tags).length > 0 ? (
            <CondensedEntityTags tags={repo.tags} resource={Entities.Repos} />
          ) : null}
        </Row>
      </BrowsingContents>
    </BrowsingCard>
  );
};

const RepoBrowsingContainer = () => {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const { userInfo } = useAuth();
  return (
    <Page title="Repositories · Thorium">
      <BrowsingFilters title="Repos" onChange={setFilters} groups={userInfo ? userInfo.groups : []} disabled={loading} />
      <EntityList
        type="repos"
        entityHeaders={<RepoListHeaders />}
        displayEntity={(repo) => <RepoItem repo={repo} />}
        filters={filters}
        fetchEntities={getRepos}
        setLoading={setLoading}
        loading={loading}
      />
    </Page>
  );
};

export default RepoBrowsingContainer;
