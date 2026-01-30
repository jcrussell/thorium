import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Accordion, Alert, Badge, Button, ButtonToolbar, Card, Col, Form, Modal, Row } from 'react-bootstrap';

// project imports
import {
  ImageFields,
  ImageNetworkPolicies,
  ImageResources,
  ImageArguments,
  ImageOutputCollection,
  ImageDependencies,
  ImageEnvironmentVariables,
  ImageVolumes,
  ImageSecurityContext,
  LoadingSpinner,
  OverlayTipLeft,
  OverlayTipRight,
  OverlayTipBottom,
  Title,
  Page,
  Omnibar,
  parseQueryString,
  filtersToQueryString,
  DEFAULT_FILTER_STATE,
} from '@components';
import { ScalerTypes } from '@components/images/image_fields';
import { getGroupRole, getThoriumRole, fetchGroups, fetchImages, fetchSingleImage, useAuth } from '@utilities';
import { deleteImage, updateImage } from '@thorpi';

const Images = () => {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [groups, setGroups] = useState({});
  const [filters, setFilters] = useState(DEFAULT_FILTER_STATE);
  const [searchParams, setSearchParams] = useSearchParams();
  const { userInfo, checkCookie } = useAuth();
  let cancelUpdate = false;

  // Get current username for @me expansion
  const currentUser = userInfo?.username || '';

  // Initialize filters from URL on mount (or when user becomes available for @me expansion)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      const parsed = parseQueryString(q, currentUser);
      setFilters(parsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // need user's group roles to validate permissions to create/edit/delete images
  useEffect(() => {
    fetchGroups(setGroups, null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // need groups to get list of images
  useEffect(() => {
    // only fetch images once groups has been populated
    if (groups && Object.keys(groups).length) {
      fetchImages(Object.keys(groups), setImages, cancelUpdate, checkCookie, setLoading, true);
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cancelUpdate = true;
    };
  }, [groups]);

  // Filter images based on current filters
  const filteredImages = useMemo(() => {
    return images.filter((image) => {
      // Search filter - matches name or description
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = image.name?.toLowerCase().includes(searchLower);
        const descMatch = image.description?.toLowerCase().includes(searchLower);
        if (!nameMatch && !descMatch) return false;
      }
      // Group inclusion filter
      if (filters.groups.length > 0 && !filters.groups.includes(image.group)) {
        return false;
      }
      // Group exclusion filter
      if (filters.excludeGroups.length > 0 && filters.excludeGroups.includes(image.group)) {
        return false;
      }
      // Scaler inclusion filter
      if (filters.scalers.length > 0 && !filters.scalers.includes(image.scaler)) {
        return false;
      }
      // Scaler exclusion filter
      if (filters.excludeScalers.length > 0 && filters.excludeScalers.includes(image.scaler)) {
        return false;
      }
      // Generator filter
      if (filters.generator !== null && image.generator !== filters.generator) {
        return false;
      }
      // Creator inclusion filter
      if (filters.creators.length > 0 && !filters.creators.includes(image.creator)) {
        return false;
      }
      // Creator exclusion filter
      if (filters.excludeCreators.length > 0 && filters.excludeCreators.includes(image.creator)) {
        return false;
      }
      // Used/Orphan filter (based on used_by field)
      if (filters.used !== null) {
        const isUsed = image.used_by && image.used_by.length > 0;
        if (filters.used && !isUsed) return false; // is:used but not used
        if (!filters.used && isUsed) return false; // is:orphan but is used
      }
      // Pipeline inclusion filter (used_by field)
      if (filters.pipelines.length > 0) {
        const usedByPipelines = image.used_by || [];
        const hasMatchingPipeline = filters.pipelines.some((p) => usedByPipelines.includes(p));
        if (!hasMatchingPipeline) return false;
      }
      // Pipeline exclusion filter
      if (filters.excludePipelines.length > 0) {
        const usedByPipelines = image.used_by || [];
        const hasExcludedPipeline = filters.excludePipelines.some((p) => usedByPipelines.includes(p));
        if (hasExcludedPipeline) return false;
      }
      return true;
    });
  }, [images, filters]);

  // Get unique groups from images for filter options
  const availableGroups = useMemo(() => {
    return [...new Set(images.map((img) => img.group))].sort();
  }, [images]);

  // Get unique creators from images for filter options
  const availableCreators = useMemo(() => {
    return [...new Set(images.map((img) => img.creator).filter(Boolean))].sort();
  }, [images]);

  // Get unique pipelines from images for filter options
  const availablePipelines = useMemo(() => {
    const pipelines = new Set();
    images.forEach((img) => {
      if (img.used_by && Array.isArray(img.used_by)) {
        img.used_by.forEach((p) => pipelines.add(p));
      }
    });
    return [...pipelines].sort();
  }, [images]);

  // Handle filter submission (syncs to URL)
  const handleFilterSubmit = (newFilters, queryString) => {
    setSearchParams(queryString ? { q: queryString } : {});
  };

  const CreateImage = () => {
    const navigate = useNavigate();
    const userCanCreateImage = ['Developer', 'Analyst', 'Admin'].includes(getThoriumRole(userInfo.role));
    const CreateImageMessage = userCanCreateImage
      ? `Create a new Image. You must be a
    Thorium developer, analyst, or admin to create an image.`
      : `You must be a Thorium developer or
    admin to create an image.`;

    return (
      <OverlayTipBottom tip={CreateImageMessage}>
        <Button
          className="ok-btn m-1 d-flex justify-content-center"
          disabled={!userCanCreateImage}
          onClick={() => navigate('/create/image')}
        >
          <b>+</b>
        </Button>
      </OverlayTipBottom>
    );
  };

  const ImageCountTipMessage =
    getThoriumRole(userInfo.role) == 'Admin'
      ? `Showing ${filteredImages.length} of ${images.length} Thorium images.`
      : `Showing ${filteredImages.length} of ${images.length} Thorium images owned by your groups.`;

  return (
    <Page title="Images · Thorium">
      <Row>
        <Col>
          <h2>
            <OverlayTipRight tip={ImageCountTipMessage}>
              <Badge bg="" className="count-badge">
                {filteredImages.length} of {images.length}
              </Badge>
            </OverlayTipRight>
          </h2>
        </Col>
        <Col className="d-flex justify-content-center">
          <Title>Images</Title>
        </Col>
        <Col className="d-flex justify-content-end">
          <CreateImage />
        </Col>
      </Row>
      <Row className="mb-3">
        <Col>
          <Omnibar
            filters={filters}
            onChange={setFilters}
            onSubmit={handleFilterSubmit}
            availableGroups={availableGroups}
            availableScalers={ScalerTypes}
            availableCreators={availableCreators}
            availablePipelines={availablePipelines}
            currentUser={currentUser}
            placeholder="Filter images... group:name scaler:K8s creator:@me pipeline:name is:generator"
          />
        </Col>
      </Row>
      <LoadingSpinner loading={loading}></LoadingSpinner>
      <Accordion alwaysOpen>
        {filteredImages.map((image) => (
          <Accordion.Item key={`${image.name}_${image.group}`} eventKey={`${image.name}_${image.group}`}>
            <Accordion.Header className="d-flex">
              <Col className="accordion-item-name">
                <div className="text">{image.name}</div>
              </Col>
              <Col className="accordion-item-relation" />
              <Col className="accordion-item-ownership">
                <OverlayTipLeft tip={`This image is owned by the ${image.group} group.`}>
                  <small>
                    <i>{image.group}</i>
                  </small>
                </OverlayTipLeft>
              </Col>
            </Accordion.Header>
            <Accordion.Body>
              <ImageInfo images={images} image={image} groups={groups} setImages={setImages} />
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>
    </Page>
  );
};

const ImageInfo = ({ images, image, groups, setImages }) => {
  const [inEditMode, setEditMode] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageFields, setImageFields] = useState({});
  const [stringFieldsError, setStringFieldsError] = useState(false);
  const [resources, setResources] = useState({});
  const [resourceError, setResourceError] = useState(false);
  const [args, setArgs] = useState({});
  const [argError, setArgError] = useState(false);
  const [volumes, setVolumes] = useState([]);
  const [volumesFieldsError, setVolumeFieldsError] = useState(false);
  const [dependencies, setDependencies] = useState({});
  const [dependenciesFieldsError, setDependenciesFieldError] = useState(false);
  const [outputCollection, setOutputCollection] = useState({});
  const [outputCollectionError, setOutputCollectionError] = useState(false);
  const [currentImage, setCurrentImage] = useState(image);
  const [securityContext, setSecurityContext] = useState({}); // optional
  const [environmentVars, setEnvironmentVars] = useState([{ key: '', value: '' }]); // optional
  const [networkPolicies, setNetworkPolicies] = useState([]);
  const { userInfo, checkCookie } = useAuth();

  const thoriumRole = getThoriumRole(userInfo.role);
  // get the users role within the image group
  const groupRole = getGroupRole(groups[image.group], userInfo.username);
  // user can modify if they created the image or have a privileged role in Thorium
  const userCanModify =
    ((image.creator == userInfo.username || ['Manager', 'Owner'].includes(groupRole)) && thoriumRole == 'Developer') ||
    thoriumRole == 'Admin';
  // creators or group managers/owners can delete image even if they are not developers
  const userCanDelete = image.creator == userInfo.username || ['Manager', 'Owner'].includes(groupRole) || thoriumRole == 'Admin';
  const userCanCreateImage = (['User', 'Manager', 'Owner'].includes(groupRole) && thoriumRole == 'Developer') || thoriumRole == 'Admin';

  // clear the create error if all others have been resolved
  useEffect(() => {
    if (!(stringFieldsError || resourceError || argError || volumesFieldsError || dependenciesFieldsError || outputCollectionError)) {
      setUpdateError('');
    }
  }, [stringFieldsError, resourceError, argError, volumesFieldsError, dependenciesFieldsError, outputCollectionError]);

  // patches image fields
  const sendFieldsUpdate = async (image) => {
    let newFields = {};

    // check if there are fields that are missing or invalid
    // this is used to put an alert by the create button
    // so that users aren't confused why their image is not updating
    // when there are errors
    if (stringFieldsError || resourceError || argError || volumesFieldsError || dependenciesFieldsError || outputCollectionError) {
      setUpdateError('Please resolve missing fields or invalid entries');
      return;
    } else setUpdateError('');

    //        STRING FIELDS
    if (Object.keys(imageFields).length) {
      newFields = { ...imageFields };
    }
    //        RESOURCES
    if (Object.keys(resources).length) {
      newFields['resources'] = resources;
    }
    //        ARGUMENTS
    if (Object.keys(args).length) {
      newFields['args'] = args;
    }
    //        VOLUMES
    if (volumes.remove_volumes.length > 0) {
      newFields = { ...newFields, remove_volumes: volumes.remove_volumes };
    }
    if (volumes.add_volumes.length > 0) {
      newFields = { ...newFields, add_volumes: volumes.add_volumes };
    }

    //        DEPENDENCIES
    if (Object.keys(dependencies).length) {
      const tempdepend = { dependencies: dependencies };
      newFields = { ...newFields, ...tempdepend };
    }
    //        OUTPUT COLLECTION
    if (Object.keys(outputCollection).length) {
      const output = { output_collection: outputCollection };
      newFields = { ...newFields, ...output };
    }
    // Only Admins can set security_context values, so don't include request for other roles
    if (Object.keys(securityContext).length && userInfo && userInfo.role == 'Admin') {
      const tempSecContext = { security_context: securityContext };
      newFields = { ...newFields, ...tempSecContext };
    }
    //        ENVIRONMENT VARIABLES
    if (Object.keys(environmentVars).length) {
      newFields = { ...newFields, ...environmentVars };
    }
    //        NETWORK POLICIES
    // if network policies were not modified, they'll still be an array,
    // so only update if network policies are not an array
    if (!Array.isArray(networkPolicies)) {
      newFields['network_policies'] = networkPolicies;
    }

    // if there exists data to patch
    if (Object.keys(newFields).length) {
      // patch the image using API if successful
      if (await updateImage(image.group, image.name, newFields, setUpdateError)) {
        // current image info page with updated image fields
        fetchSingleImage(image, setCurrentImage, setLoading);
        // go back to non editing mode
        setEditMode(false);
        // clear errors when exiting edit mode
        setUpdateError('');
      }
    }
  };

  // Display the delete images button and implement deletion
  const DeleteImageButton = ({ image }) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const handleCloseDeleteModal = () => {
      setShowDeleteModal(false);
      setDeleteError('');
    };
    const handleShowDeleteModal = () => setShowDeleteModal(true);
    return (
      <>
        <OverlayTipLeft
          tip={`Delete this Thorium image. Only admins, group owners/managers, or the image
          creator can delete an image.`}
        >
          <Button className="warning-btn" onClick={handleShowDeleteModal}>
            Delete
          </Button>
        </OverlayTipLeft>
        <Modal show={showDeleteModal} backdrop="static" onHide={handleCloseDeleteModal}>
          <Modal.Header closeButton>
            <Modal.Title>Confirm deletion?</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            Do you really want to delete the <b>{image.name}</b> image?
            {deleteError != '' && (
              <Alert variant="danger" className="mt-4">
                <center>{deleteError}</center>
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer className="d-flex justify-content-center">
            <Button
              className="danger-btn"
              onClick={async () => {
                if (await deleteImage(image.group, image.name, setDeleteError)) {
                  fetchImages(Object.keys(groups), setImages, false, checkCookie, null, true);
                  handleCloseDeleteModal();
                }
              }}
            >
              Confirm
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  };

  const CopyImageButton = ({ image }) => {
    const navigate = useNavigate();
    return (
      <OverlayTipBottom tip={`Click to create a new image using ${image.name} as a template.`}>
        <Button
          className="ok-btn d-flex justify-content-center"
          disabled={!userCanCreateImage}
          onClick={() => navigate('/create/image', { state: image })}
        >
          Copy
        </Button>
      </OverlayTipBottom>
    );
  };

  // image names will be needed for ephemeral dependencies image list options
  const groupImages = images.filter((someImage) => currentImage.group == someImage.group);
  let imageNames = groupImages.map((image) => {
    return image.name;
  });
  imageNames = [...new Set(imageNames)];

  return (
    <Form>
      <ImageFields
        image={currentImage}
        setRequestImageFields={setImageFields}
        showErrors={true}
        setHasErrors={setStringFieldsError}
        mode={inEditMode ? 'Edit' : 'View'}
      />
      <ImageResources
        resources={currentImage.resources ? currentImage.resources : {}}
        setRequestResources={setResources}
        setHasErrors={setResourceError}
        mode={inEditMode ? 'Edit' : 'View'}
      />
      <ImageArguments
        args={currentImage.args ? currentImage.args : {}}
        setRequestArguments={setArgs}
        setHasErrors={setArgError}
        mode={inEditMode ? 'Edit' : 'View'}
      />
      <ImageOutputCollection
        outputCollection={currentImage.output_collection}
        setRequestOutputCollection={setOutputCollection}
        groups={userInfo && userInfo.groups ? userInfo.groups : []}
        mode={inEditMode ? 'Edit' : 'View'}
        setHasErrors={setOutputCollectionError}
        disabled={currentImage.scaler == 'External'}
      />
      <ImageDependencies
        dependencies={currentImage.dependencies ? currentImage.dependencies : {}}
        images={imageNames}
        mode={inEditMode ? 'Edit' : 'View'}
        setRequestDependencies={setDependencies}
        setErrors={setDependenciesFieldError}
        disabled={currentImage.scaler == 'External'}
      />
      <ImageEnvironmentVariables
        environmentVars={currentImage.env ? currentImage.env : {}}
        setRequestEnvironmentVars={setEnvironmentVars}
        mode={inEditMode ? 'Edit' : 'View'}
      />
      <ImageVolumes
        volumes={currentImage.volumes}
        setRequestVolumes={setVolumes}
        mode={inEditMode ? 'Edit' : 'View'}
        setHasErrors={setVolumeFieldsError}
        disabled={currentImage.scaler != 'K8s'}
      />
      {currentImage['scaler'] == 'K8s' && (
        <ImageNetworkPolicies
          policies={currentImage.network_policies ? currentImage.network_policies : []}
          setRequestNetworkPolicies={setNetworkPolicies}
          mode={inEditMode ? 'Edit' : 'View'}
        />
      )}
      <ImageSecurityContext
        securityContext={currentImage.security_context ? currentImage.security_context : {}}
        setRequestSecurityContext={setSecurityContext}
        mode={inEditMode && userInfo.role == 'Admin' ? 'Edit' : 'View'}
        disabled={(Object.keys(imageFields).includes('scaler') && imageFields.scaler == 'External') || userInfo.role != 'Admin'}
      />
      <Row className="d-flex justify-content-center">
        <Col>
          {updateError && (
            <Alert variant="danger" className="m-2">
              <center>{updateError}</center>
            </Alert>
          )}
        </Col>
      </Row>
      <Row>
        <Col>
          <LoadingSpinner loading={loading}></LoadingSpinner>
          <ButtonToolbar className="d-flex justify-content-center">
            {userCanCreateImage && !inEditMode && <CopyImageButton image={currentImage} />}
            {userCanModify && !inEditMode && (
              <OverlayTipRight
                tip={`Update this image. Only Thorium admins or
              developers with group permissions may edit images.`}
              >
                <Button className="secondary-btn" onClick={() => setEditMode(true)}>
                  Edit
                </Button>
              </OverlayTipRight>
            )}
            {userCanDelete && !inEditMode && <DeleteImageButton image={image} />}
            {userCanModify && inEditMode && (
              <OverlayTipLeft tip={`Cancel pending updates.`}>
                <Button
                  className="primary-btn"
                  onClick={() => {
                    setEditMode(false);
                    // clear errors when exiting edit mode
                    setUpdateError('');
                  }}
                >
                  Cancel
                </Button>
              </OverlayTipLeft>
            )}
            {userCanModify && inEditMode && (
              <OverlayTipRight tip={`Submit pending updates.`}>
                <Button className="ok-btn" onClick={() => sendFieldsUpdate(image)}>
                  Update
                </Button>
              </OverlayTipRight>
            )}
          </ButtonToolbar>
        </Col>
      </Row>
    </Form>
  );
};

export default Images;
