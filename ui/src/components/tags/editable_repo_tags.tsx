import { useState, useEffect } from 'react';
import { ButtonToolbar, Button, Card, Col, Modal, Row } from 'react-bootstrap';
import { FaBackspace, FaRegEdit, FaSave } from 'react-icons/fa';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

import { AlertBanner, OverlayTipBottom, OverlayTipRight, Subtitle } from '@components';
import { createReactSelectStyles } from '@utilities';
import { FormattedFileInfoTagKeys, TLPLevels } from './utilities';
import { TagBadge } from './tags';
import { deleteRepoTags, getRepoDetails, uploadRepoTags } from '@thorpi';
import { Repo, Tags, Entities } from '@models';

// Styles for react select badges
const tlpTagStyle = createReactSelectStyles('White', 'rgb(160, 162, 163)');
const generalTagStyle = createReactSelectStyles('White', 'rgb(160, 162, 163)');

interface EditableRepoTagsProps {
  repoPath: string;
  tags: Tags;
  setDetails: (details: Repo) => void;
  setUpdateError?: (error: string) => void;
  screenWidth?: number;
}

interface SelectOption {
  value: string;
  label: string;
  thoriumTag: { key: string; value: string | null };
}

const EditableRepoTags = ({ repoPath, tags, setDetails, setUpdateError }: EditableRepoTagsProps) => {
  const [editing, setEditing] = useState(false);
  const [pendingTags, setPendingTags] = useState<Record<string, string[]>>({});
  const [deletedTags, setDeletedTags] = useState<Record<string, string[]>>({});
  const [invalidPendingTags, setInvalidPendingTags] = useState<string[]>([]);
  const [selectedGeneralTags, setSelectedGeneralTags] = useState<SelectOption[]>([]);
  const [generalTagOptions, setGeneralTagOptions] = useState<SelectOption[]>([]);
  const [selectedTlpTags, setSelectedTlpTags] = useState<SelectOption[]>([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [deleteErrorStatus, setDeleteErrorStatus] = useState('');
  const [createErrorStatus, setCreateErrorStatus] = useState('');
  const [numberOfChanges, setNumberOfChanges] = useState(0);

  // Build a list of tags for non-general tag sections
  const excludeTags = [...FormattedFileInfoTagKeys, 'TLP', 'RESULTS'];

  // Get TLP tags and React Select formatted options
  const tlpTagOptions = TLPLevels.sort().map((tagValue) => ({
    value: tagValue,
    label: tagValue,
    thoriumTag: { key: 'TLP', value: tagValue },
  }));

  const tlpTags = !(tags && tags.TLP)
    ? []
    : Object.keys(tags['TLP'])
        .sort()
        .map((tagValue) => tagValue);

  const initialSelectedTLPTags = tlpTags.map((tagValue) => ({
    value: tagValue,
    label: tagValue,
    thoriumTag: { key: 'TLP', value: tagValue },
  }));

  // Get General tags and React Select formatted options
  const generalTags = tags ? Object.fromEntries(Object.entries(tags).filter(([k]) => !excludeTags.includes(k.toUpperCase()))) : {};

  const initialGeneralTagOptions: SelectOption[] = [];
  Object.keys(generalTags)
    .sort()
    .forEach((tagKey) => {
      if (!excludeTags.includes(tagKey)) {
        Object.keys(generalTags[tagKey])
          .sort()
          .forEach((tagValue) => {
            const tag = `${tagKey}: ${tagValue}`;
            initialGeneralTagOptions.push({
              value: tag,
              label: tag,
              thoriumTag: { key: tagKey, value: tagValue },
            });
          });
      }
    });

  // Clear out any pending tag deletions or additions
  const resetTags = () => {
    setDeleteErrorStatus('');
    setCreateErrorStatus('');
    setPendingTags({});
    setDeletedTags({});
    setInvalidPendingTags([]);
    setNumberOfChanges(0);

    setSelectedTlpTags(structuredClone(initialSelectedTLPTags));
    const resetGeneralTags = structuredClone(initialGeneralTagOptions);
    setSelectedGeneralTags(resetGeneralTags);
    setGeneralTagOptions(resetGeneralTags);
  };

  // Commit tag changes to APIs
  const commitTagUpdates = async () => {
    setDeleteErrorStatus('');
    setCreateErrorStatus('');
    let error = false;

    if (deletedTags && Object.keys(deletedTags).length > 0) {
      const deleteSuccess = await deleteRepoTags(repoPath, { tags: deletedTags }, setDeleteErrorStatus);
      if (!deleteSuccess) {
        error = true;
      }
    }

    if (Object.keys(pendingTags).length > 0) {
      const createSuccess = await uploadRepoTags(repoPath, { tags: pendingTags }, setCreateErrorStatus);
      if (!createSuccess) {
        error = true;
      }
    }

    if (!error) {
      const updatedRepoDetails = await getRepoDetails(repoPath, setUpdateError || (() => {}));
      if (updatedRepoDetails) {
        setShowUpdateModal(false);
        setDetails(updatedRepoDetails);
        setEditing(false);
      }
    }
  };

  // Get a count of uncommitted tags changes
  const updateUpdatedTagCount = (
    pending: Record<string, string[]>,
    deleted: Record<string, string[]>,
    invalid: string[],
  ) => {
    let count = 0;
    Object.keys(pending).forEach((tag) => {
      count += pending[tag].length;
    });
    Object.keys(deleted).forEach((tag) => {
      count += deleted[tag].length;
    });
    count += invalid.length;
    setNumberOfChanges(count);
  };

  // Determine pending and deleted tags from React select set selectedTags
  const updateSelectedTags = (newValue: any) => {
    const updatedPendingTags = structuredClone(pendingTags);
    const updatedDeletedTags = structuredClone(deletedTags);
    let updatedInvalidPendingTags = structuredClone(invalidPendingTags);

    if (newValue.action === 'clear') {
      const cleared = newValue['removedValues'];
      if (cleared && cleared.length > 0) {
        cleared.forEach((selectTag: SelectOption) => {
          const tag = selectTag.thoriumTag;
          if (updatedPendingTags[tag.key] && updatedPendingTags[tag.key].includes(tag.value!)) {
            if (updatedPendingTags[tag.key].length > 1) {
              updatedPendingTags[tag.key] = updatedPendingTags[tag.key].filter((value) => value !== tag.value);
            } else {
              delete updatedPendingTags[tag.key];
            }
          } else if (tag.key && !tag.value && updatedInvalidPendingTags.includes(tag.key)) {
            updatedInvalidPendingTags = updatedInvalidPendingTags.filter((invalidKey) => invalidKey !== tag.key);
          } else {
            if (tag.key in updatedDeletedTags) {
              updatedDeletedTags[tag.key].push(tag.value!);
            } else {
              updatedDeletedTags[tag.key] = [tag.value!];
            }
          }
        });
      }
    } else if (newValue.action === 'remove-value') {
      const tag = newValue.removedValue.thoriumTag;
      if (tag.key in updatedPendingTags && updatedPendingTags[tag.key].includes(tag.value!)) {
        if (updatedPendingTags[tag.key].length > 1) {
          updatedPendingTags[tag.key] = updatedPendingTags[tag.key].filter((value) => value !== tag.value);
        } else {
          delete updatedPendingTags[tag.key];
        }
      } else if (tag.key && !tag.value && updatedInvalidPendingTags.includes(tag.key)) {
        updatedInvalidPendingTags = updatedInvalidPendingTags.filter((invalidKey) => invalidKey !== tag.key);
      } else {
        if (tag.key in updatedDeletedTags) {
          updatedDeletedTags[tag.key].push(tag.value!);
        } else {
          updatedDeletedTags[tag.key] = [tag.value!];
        }
      }
    } else if (newValue.action === 'select-option') {
      const tag = newValue.option.thoriumTag;
      if (tag.key in updatedDeletedTags && updatedDeletedTags[tag.key].includes(tag.value!)) {
        if (updatedDeletedTags[tag.key].length > 1) {
          updatedDeletedTags[tag.key] = updatedDeletedTags[tag.key].filter((value) => value !== tag.value);
        } else {
          delete updatedDeletedTags[tag.key];
        }
      } else {
        if (tag.key in updatedPendingTags) {
          updatedPendingTags[tag.key].push(tag.value!);
        } else {
          updatedPendingTags[tag.key] = [tag.value!];
        }
      }
    } else if (newValue.action === 'create-option') {
      const parseRawTag = (rawTag: string) => {
        if (rawTag.includes(':')) {
          const tagKey = rawTag.split(':', 1)[0];
          return { key: tagKey, value: rawTag.substring(tagKey.length + 1) };
        } else if (rawTag.includes('=')) {
          const tagKey = rawTag.split('=', 1)[0];
          return { key: tagKey, value: rawTag.substring(tagKey.length + 1) };
        } else {
          return { key: rawTag, value: null };
        }
      };

      const tag = parseRawTag(newValue.option.value);
      if (tag.key && tag.value) {
        newValue.option['thoriumTag'] = tag;
        if (tag.key in updatedPendingTags) {
          updatedPendingTags[tag.key].push(tag.value);
        } else {
          updatedPendingTags[tag.key] = [tag.value];
        }
      } else {
        newValue.option['thoriumTag'] = tag;
        if (!updatedInvalidPendingTags.includes(tag.key)) {
          updatedInvalidPendingTags.push(tag.key);
        }
      }
    }

    updateUpdatedTagCount(updatedPendingTags, updatedDeletedTags, updatedInvalidPendingTags);
    setDeletedTags(updatedDeletedTags);
    setPendingTags(updatedPendingTags);
    setInvalidPendingTags(updatedInvalidPendingTags);
  };

  useEffect(() => {
    if (tags) {
      resetTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags]);

  return (
    <Card className="panel ps-4">
      <Card.Body>
        <Row className="align-items-center">
          <Col className="tags-col">
            <Row>
              <Col>
                <Subtitle>TLP</Subtitle>
              </Col>
              <Col className="details-tags-name">
                {editing ? (
                  <Select
                    isMulti
                    isSearchable
                    isClearable
                    value={selectedTlpTags}
                    styles={tlpTagStyle}
                    onChange={(selected, newValue) => {
                      setSelectedTlpTags(selected as SelectOption[]);
                      updateSelectedTags(newValue);
                    }}
                    options={tlpTagOptions}
                  />
                ) : (
                  tlpTags.map((level) => (
                    <TagBadge resource={Entities.Repos} key={level} tag="TLP" value={level} condensed={false} action="link" />
                  ))
                )}
              </Col>
            </Row>
            <Row>
              <hr className="tagshr" />
              <Col>
                <Subtitle>Tags</Subtitle>
              </Col>
              <Col className="details-tags-name">
                {editing ? (
                  <CreatableSelect
                    isMulti
                    isSearchable
                    isClearable
                    value={selectedGeneralTags}
                    styles={generalTagStyle}
                    noOptionsMessage={({ inputValue }) =>
                      inputValue
                        ? inputValue
                        : `Create a tag by typing in a key and value separated by = or : and then clicking enter.`
                    }
                    onChange={(selected, newValue) => {
                      setSelectedGeneralTags(selected as SelectOption[]);
                      updateSelectedTags(newValue);
                    }}
                    options={generalTagOptions}
                  />
                ) : (
                  Object.keys(generalTags)
                    .sort()
                    .map((tagKey) =>
                      Object.keys(generalTags[tagKey])
                        .sort()
                        .map((tagValue, idx) => (
                          <TagBadge resource={Entities.Repos} key={idx} tag={tagKey} value={tagValue} condensed={false} action="link" />
                        )),
                    )
                )}
              </Col>
            </Row>
          </Col>
          <Col xs={1} className="edit-icon">
            <div className="edit-icon left-edit-tag-btn d-flex justify-content-center">
              <EditTagButton
                editing={editing}
                setEditing={setEditing}
                numberOfChanges={numberOfChanges}
                setShowUpdateModal={setShowUpdateModal}
                resetTags={resetTags}
              />
            </div>
          </Col>
        </Row>
        <Modal show={showUpdateModal} onHide={() => setShowUpdateModal(false)} backdrop="static" keyboard={false}>
          <Modal.Header closeButton>
            <Modal.Title>Confirm Tags Changes?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {Object.keys(pendingTags).length > 0 && (
              <Row>
                <Col>
                  <b>Add: </b>
                  {Object.keys(pendingTags).map((tag) =>
                    pendingTags[tag].map((value) => (
                      <TagBadge
                        resource={Entities.Repos}
                        key={tag + '_' + value}
                        tag={tag}
                        value={tag.toUpperCase() === 'TLP' ? value.toUpperCase() : value}
                        action="none"
                        condensed={true}
                      />
                    )),
                  )}
                </Col>
              </Row>
            )}
            {createErrorStatus && (
              <Row className="d-flex justify-content-center p-2">
                <AlertBanner prefix="Add tags" errorStatus={createErrorStatus} variant="danger" />
              </Row>
            )}
            {Object.keys(deletedTags).length > 0 && (
              <Row>
                <Col>
                  <b>Delete: </b>
                  {Object.keys(deletedTags).map((tag) =>
                    deletedTags[tag].map((value) => (
                      <TagBadge
                        resource={Entities.Repos}
                        key={tag + '_' + value}
                        tag={tag}
                        value={tag.toUpperCase() === 'TLP' ? value.toUpperCase() : value}
                        action="none"
                        condensed={true}
                      />
                    )),
                  )}
                </Col>
              </Row>
            )}
            {deleteErrorStatus && (
              <Row className="d-flex justify-content-center p-2">
                <AlertBanner prefix="Delete tags" errorStatus={deleteErrorStatus} variant="danger" />
              </Row>
            )}
            {invalidPendingTags.length > 0 && (
              <Row>
                <Col>
                  <b>Invalid tags: </b>
                  {invalidPendingTags.map((tag) => (
                    <TagBadge resource={Entities.Repos} key={tag} tag={tag} value="" condensed={true} action="none" />
                  ))}
                  <i>
                    (Custom tags must have a key and value that are separated by a colon delimiter. Invalid tags will
                    be ignored when saving other tag changes)
                  </i>
                </Col>
              </Row>
            )}
          </Modal.Body>
          <Modal.Footer className="d-flex justify-content-center">
            <ButtonToolbar>
              <OverlayTipBottom tip="Cancel pending tag deletions and additions and return to the details page">
                <Button
                  className="primary-btn xsmall-button"
                  onClick={() => {
                    resetTags();
                    setShowUpdateModal(false);
                  }}
                >
                  Clear
                </Button>
              </OverlayTipBottom>
              <OverlayTipBottom tip="Submit pending tag deletions and additions">
                <Button
                  className="warning-btn xsmall-button"
                  disabled={numberOfChanges - invalidPendingTags.length === 0}
                  onClick={() => commitTagUpdates()}
                >
                  Confirm
                </Button>
              </OverlayTipBottom>
            </ButtonToolbar>
          </Modal.Footer>
        </Modal>
      </Card.Body>
    </Card>
  );
};

interface EditTagButtonProps {
  editing: boolean;
  setEditing: (editing: boolean) => void;
  numberOfChanges: number;
  setShowUpdateModal: (show: boolean) => void;
  resetTags: () => void;
}

const EditTagButton = ({ editing, setEditing, numberOfChanges, setShowUpdateModal, resetTags }: EditTagButtonProps) => {
  return (
    <ButtonToolbar>
      <OverlayTipRight tip={!editing ? 'Click to add or remove tags.' : 'Click to cancel editing tags'}>
        <Button
          className="icon-btn"
          variant=""
          onClick={() => {
            setEditing(!editing);
            if (editing) {
              resetTags();
            }
          }}
        >
          {editing ? <FaBackspace size="24" /> : <FaRegEdit size="24" />}
        </Button>
      </OverlayTipRight>
      {(editing || numberOfChanges > 0) && (
        <OverlayTipRight
          tip={`There are ${numberOfChanges} pending tag changes. Click to review and submit or cancel pending changes.`}
        >
          <Button className="icon-btn" variant="" disabled={numberOfChanges === 0} onClick={() => setShowUpdateModal(true)}>
            <FaSave size="20" /> {numberOfChanges > 0 && `${numberOfChanges}`}
          </Button>
        </OverlayTipRight>
      )}
    </ButtonToolbar>
  );
};

export default EditableRepoTags;
