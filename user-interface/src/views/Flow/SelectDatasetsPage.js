import React, { useRef, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  Box,
  Flex,
  Grid,
  IconButton,
  Tooltip,
  Text,
  useToast,
} from "@chakra-ui/react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import Card from "components/Card/Card.js";
import CardBody from "components/Card/CardBody.js";
import CardHeader from "components/Card/CardHeader.js";
import SelectedDataArea from "components/Card/SelectedDataArea";
import DragAndDropArea from "components/DragAndDropArea/DragAndDropArea";
import ProjectFileRow from "components/Tables/ProjectFileRows";

import { addCsvToFlow, fetchFlowDatasets } from "store/features/flowSlice";
import {
  uploadCsvFile,
  deleteCsvFile,
  fetchCsvFilesByProject,
} from "store/features/projectSlice";
import {
  ArrowBackIcon,
  ArrowForwardIcon,
  AttachmentIcon,
  CheckIcon,
} from "@chakra-ui/icons";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import { fetchFlowProperties } from "store/features/flowSlice";
import { updatePropertyCategory } from "store/features/flowSlice";
import { savePropertyTypes } from "store/features/flowSlice";

const SelectDatasetsPage = () => {
  const { projectId, flowId } = useParams();
  const dispatch = useDispatch();
  const history = useHistory();
  const fileInputRef = useRef(null);
  const toast = useToast();
  const isMounted = useRef(true); // ✅ 컴포넌트 마운트 여부 확인

  const [isLoading, setIsLoading] = useState(true);
  // ✅ 선택된 데이터셋을 로컬 상태에서 관리
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [totalSelectedSize, setTotalSelectedSize] = useState(0);

  const properties = useSelector(
    (state) =>
      state.flows.properties?.[flowId] || {
        numerical: [],
        categorical: [],
        text: [],
        unavailable: [],
      }
  );

  // 로컬 상태로 카테고리별 property 배열을 관리
  const [categoriesState, setCategoriesState] = useState({
    numerical: properties.numerical,
    categorical: properties.categorical,
    text: properties.text,
    unavailable: properties.unavailable,
  });

  // Redux 상태 변경 시 로컬 상태 동기화 (필요하다면)
  useEffect(() => {
    setCategoriesState({
      numerical: properties.numerical,
      categorical: properties.categorical,
      text: properties.text,
      unavailable: properties.unavailable,
    });
  }, [properties]);

  // Redux 상태에서 데이터 가져오기
  const flow = useSelector((state) => state.flows.flows[flowId] || {});

  const projectDatasets = useSelector(
    (state) => state.projects.datasets[projectId] || []
  );

  const flowDatasets = useSelector((state) => {
    return state.flows.flows[flowId]?.csv;
  });

  // ✅ Flow와 프로젝트의 CSV 데이터셋 불러오기
  useEffect(() => {
    let isMounted = true; // ✅ 컴포넌트 마운트 여부 확인

    const fetchData = async () => {
      try {
        await dispatch(fetchCsvFilesByProject(projectId));
        const res = await dispatch(fetchFlowDatasets(flowId)).unwrap();
        await dispatch(fetchFlowProperties(flowId));
        if (isMounted) {
          setSelectedDatasets(res.datasets?.map((d) => d.csvId) || []);

          const selectedDataset = projectDatasets.filter((ds) =>
            flowDatasets?.includes(ds.csvId)
          );

          const SelectedSize = selectedDataset.reduce(
            (acc, ds) => acc + (ds.size || 0),
            0
          );

          setTotalSelectedSize(SelectedSize);
        }
      } catch (error) {
        console.error("❌ Failed to fetch flow datasets:", error);
        if (isMounted) setSelectedDatasets([]);
      }
      if (isMounted) {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false; // ✅ 언마운트 시 상태 업데이트 방지
    };
  }, [dispatch, projectId, flowId, flowDatasets]);

  //  setTotalSelectedSize(SelectedSize);

  const handleNextStep = async () => {
    for (const category of Object.keys(categoriesState)) {
      for (const property of categoriesState[category]) {
        try {
          await dispatch(
            savePropertyTypes({
              flowId,
              update: {
                flow_id: flowId,
                column_name: property,
                column_type: category,
              },
            })
          ).unwrap();
          // 각 업데이트가 성공하면 toast나 console.log로 메시지 표시 가능
          console.log(`Updated ${property} to ${category}`);
        } catch (error) {
          console.error(`Failed to update ${property}:`, error);
        }
      }
    }
    history.push(`/projects/${projectId}/flows/${flowId}/analyze-properties`);
  };

  const handleGoBack = () => {
    history.goBack();
  };

  // ✅ 데이터셋 선택
  const handleDatasetSelect = (csvId) => {
    if (totalSelectedSize >= 1024 * 1024) {
      toast({
        title: "Capacity Error",
        description: `The maximum selectable capacity is 1024MB.`,
        status: "error",
        duration: 3000,
        isClosable: true,
        containerStyle: { marginLeft: "280px" },
      });
      return;
    }

    const dataset = projectDatasets.find((ds) => ds.csvId === csvId);

    // parquet 형식의 파일인 경우, 이미 선택된 데이터셋 중 parquet 형식이 있는지 확인
    if (dataset.format === "application/parquet") {
      const alreadySelectedParquet = selectedDatasets.some((id) => {
        const selectedDs = projectDatasets.find((ds) => ds.csvId === id);
        return selectedDs && selectedDs.format === "application/parquet";
      });

      if (alreadySelectedParquet) {
        toast({
          title: "Selection Error",
          description:
            "A parquet dataset is already selected. Only one parquet dataset can be selected.",
          status: "error",
          duration: 3000,
          isClosable: true,
          containerStyle: { marginLeft: "280px" },
        });
        return;
      }
    }

    setTotalSelectedSize((prev) => prev + dataset.size);
    setSelectedDatasets((prev) => [...prev, csvId]);
    toast({
      title: "Dataset Selected",
      description: `Dataset Selected successfully`,
      status: "success",
      duration: 3000,
      isClosable: true,
      containerStyle: { marginLeft: "280px" },
    });
  };

  // ✅ 데이터셋 선택 해제
  const handleDatasetDeselect = (csvId) => {
    const dataset = projectDatasets.find((ds) => ds.csvId === csvId);
    setTotalSelectedSize((prev) => prev - dataset.size);
    setSelectedDatasets((prev) => prev.filter((id) => id !== csvId));
    toast({
      title: "Dataset DeSelected",
      description: `Dataset DeSelected successfully`,
      status: "success",
      duration: 3000,
      isClosable: true,
      containerStyle: {
        marginLeft: "280px",
      },
    });
  };

  // ✅ 파일 업로드 클릭 핸들러
  const handleHeaderUploadClick = () => {
    fileInputRef.current.click();
  };

  // ✅ 파일 업로드 핸들러
  const handleFilesAdded = async (files) => {
    const allowedFormats = ["text/csv", "application/parquet"];
    const fileArray = Array.from(files);

    const validFiles = fileArray.filter((file) => {
      if (!allowedFormats.includes(file.type)) {
        toast({
          title: "Data types are only csv and parquet.",
          description: `Data types are only csv and parquet.`,
          status: "warning",
          duration: 3000,
          isClosable: true,
          containerStyle: {
            marginLeft: "280px",
          },
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const uploadResults = await Promise.allSettled(
      validFiles.map((file) =>
        dispatch(uploadCsvFile({ projectId, file, writer: "admin" }))
      )
    );

    uploadResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        toast({
          title: "File Upload Event",
          description: `File "${validFiles[index].name}" uploaded successfully.`,
          status: "success",
          duration: 3000,
          isClosable: true,
          containerStyle: {
            marginLeft: "280px",
          },
        });
      } else {
        console.error(
          `Failed to upload file: ${validFiles[index].name}`,
          result.reason
        );
      }
    });

    dispatch(fetchCsvFilesByProject(projectId));
  };

  // ✅ 데이터셋 삭제 핸들러
  const handleFileDelete = async (csvId) => {
    try {
      await dispatch(deleteCsvFile({ projectId, csvId })).unwrap();
      dispatch(fetchCsvFilesByProject(projectId));
    } catch (error) {
      console.error(`Failed to delete dataset ${csvId}:`, error);
    }
  };

  // ✅ Flow에 선택된 데이터셋 저장
  const handleApplySelection = async () => {
    await dispatch(addCsvToFlow({ flowId, csvIds: selectedDatasets }));
    await dispatch(fetchFlowProperties(flowId));

    toast({
      title: "Saved as flow datasets",
      description: `Saved as flow datasets`,
      status: "success",
      duration: 3000,
      isClosable: true,
      containerStyle: {
        marginLeft: "280px",
      },
    });
  };

  if (!flow) {
    return (
      <Flex pt={{ base: "120px", md: "75px" }} justify="center">
        <Text color="red.500">Flow not found</Text>
      </Flex>
    );
  }

  // 예시: 초기 Redux 상태의 properties (numeric, categorical, text, unavailable)
  const DataPropertiesDragAndDrop = () => {
    // onDragEnd 핸들러
    const onDragEnd = (result) => {
      const { source, destination } = result;
      if (!destination) return;

      // 같은 위치면 아무것도 하지 않음
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      )
        return;

      const sourceCategory = source.droppableId;
      const destCategory = destination.droppableId;

      // 같은 카테고리 내 이동 (순서 변경)
      if (sourceCategory === destCategory) {
        const newItems = Array.from(categoriesState[sourceCategory]);
        const [removed] = newItems.splice(source.index, 1);
        newItems.splice(destination.index, 0, removed);
        setCategoriesState({
          ...categoriesState,
          [sourceCategory]: newItems,
        });

        return;
      }

      // 다른 카테고리로 이동
      const sourceItems = Array.from(categoriesState[sourceCategory]);
      const [removed] = sourceItems.splice(source.index, 1);
      const destItems = Array.from(categoriesState[destCategory]);
      // 중복 추가 방지
      if (destItems.includes(removed)) return;
      destItems.splice(destination.index, 0, removed);

      setCategoriesState({
        ...categoriesState,
        [sourceCategory]: sourceItems,
        [destCategory]: destItems,
      });

      // Redux 업데이트: property의 카테고리를 destCategory로 업데이트
      dispatch(
        updatePropertyCategory({
          flowId,
          property: removed,
          newCategory: destCategory,
        })
      );

      // Toast 메시지: 어디서 어디로 이동했는지
      toast({
        title: "Property Updated",
        description: `Moved "${removed}" from ${sourceCategory} to ${destCategory}.`,
        status: "success",
        duration: 3000,
        isClosable: true,
        containerStyle: {
          marginLeft: "280px",
        },
      });
    };

    // Draggable property 컴포넌트
    const DraggableProperty = ({ property, index }) => {
      return (
        <Draggable draggableId={property} index={index}>
          {(provided, snapshot) => {
            const child = (
              <Tooltip label={property} aria-label="Property Tooltip">
                <Card
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  px={2}
                  py={1}
                  ml={1}
                  mb={1}
                  //   borderRadius="md"
                  color="gray.300"
                  fontSize="md"
                  cursor="pointer"
                  width="auto"
                  whiteSpace="nowrap"
                >
                  <Text fontWeight="bold">{property}</Text>
                </Card>
              </Tooltip>
            );
            return snapshot.isDragging
              ? createPortal(child, document.body)
              : child;
          }}
        </Draggable>
      );
    };

    // Droppable 영역 컴포넌트
    const DroppableCategory = ({
      categoryName,
      items,
      headerColor,
      bgColor,
    }) => {
      return (
        <Box>
          <Text
            mb={2}
            fontSize="md"
            fontWeight="bold"
            color={headerColor || "white"}
            textAlign="center"
          >
            {categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}
          </Text>
          <Droppable droppableId={categoryName}>
            {(provided) => (
              <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
                minH="350px"
                bg={bgColor || "transparent"}
                p={2}
                borderRadius="md"
              >
                {items.length > 0 ? (
                  items.map((prop, index) => (
                    <DraggableProperty
                      key={prop}
                      property={prop}
                      index={index}
                    />
                  ))
                ) : (
                  <Text color="gray.500" textAlign="center" fontSize="xs">
                    No {categoryName} properties.
                  </Text>
                )}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </Box>
      );
    };

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Card>
          <CardHeader>
            <Flex flexDirection="column">
              <Text color="#fff" fontSize="lg" fontWeight="bold">
                Data Properties
              </Text>
              <Text color="gray.400" fontSize="md" fontWeight="bold">
                Drag and Drop to change property category
              </Text>
            </Flex>
          </CardHeader>
          <CardBody mt={4}>
            <Grid templateColumns="repeat(4, 1fr)" gap={4} w="100%">
              <DroppableCategory
                categoryName="numerical"
                items={categoriesState.numerical}
                headerColor="rgba(111, 81, 219, 0.77)"
                bgColor="rgba(111, 81, 219, 0.1)"
              />
              <DroppableCategory
                categoryName="categorical"
                items={categoriesState.categorical}
                headerColor="rgba(217, 101, 235, 0.77)"
                bgColor="rgba(217, 101, 235, 0.1)"
              />
              <DroppableCategory
                categoryName="text"
                items={categoriesState.text}
                headerColor="rgba(146, 245, 121, 0.77)"
                bgColor="rgba(146, 245, 121, 0.1)"
              />
              <DroppableCategory
                categoryName="unavailable"
                items={categoriesState.unavailable}
                headerColor="rgba(255, 94, 94, 0.77)"
                bgColor="rgba(255, 94, 94, 0.1)"
              />
            </Grid>
          </CardBody>
        </Card>
      </DragDropContext>
    );
  };

  return (
    <Flex flexDirection="column" pt={{ base: "120px", md: "75px" }} px={6}>
      <Flex justifyContent="space-between" alignItems="center" mb={6} px={6}>
        <IconButton
          icon={<ArrowBackIcon />}
          onClick={handleGoBack}
          colorScheme="blue"
        />
        <Flex direction="column" align="center">
          <Text fontSize="2xl" fontWeight="bold" color="white">
            Select Datasets
          </Text>
          <Text fontSize="md" color="gray.400">
            Please select the datasets you want to analyze. You can upload new
            datasets or choose from the existing ones.
          </Text>
        </Flex>

        <IconButton
          icon={<ArrowForwardIcon />}
          colorScheme="blue"
          aria-label="Next Step"
          onClick={handleNextStep}
        />
      </Flex>
      <Grid templateColumns="1fr 1fr" h="calc(80vh - 80px)" gap={4}>
        <Card w="100%">
          <CardHeader
            display="flex"
            justifyContent="space-between"
            mb="16px"
            alignItems="center"
          >
            <Text color="#fff" fontSize="lg" fontWeight="bold">
              Project Files
            </Text>
            <Flex gap={2}>
              <Tooltip label="Upload Files">
                <IconButton
                  size="sm"
                  bg="brand.100"
                  icon={<AttachmentIcon h="20px" w="20px" color="#fff" />}
                  onClick={handleHeaderUploadClick}
                />
              </Tooltip>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={(e) => handleFilesAdded(e.target.files)}
              />
            </Flex>
          </CardHeader>

          <CardBody h="100%" display="flex" flexDirection="column" gap={4}>
            <Box flex="2" overflowY="auto" w="100%">
              <Grid templateColumns="1fr 1fr" gap={4}>
                {projectDatasets.map((dataset) => (
                  <ProjectFileRow
                    key={dataset.csvId}
                    fileName={dataset.csv}
                    fileType="csv"
                    fileSize={`${(dataset.size / 1024).toFixed(2)} MB`}
                    isSelected={selectedDatasets.includes(dataset.csvId)}
                    onSelect={() =>
                      selectedDatasets.includes(dataset.csvId)
                        ? handleDatasetDeselect(dataset.csvId)
                        : handleDatasetSelect(dataset.csvId)
                    }
                    onDelete={() => handleFileDelete(dataset.csvId)}
                  />
                ))}
              </Grid>
            </Box>
            <Box flex="1" h="200px" mt={4}>
              <DragAndDropArea onFilesAdded={handleFilesAdded} />
            </Box>
          </CardBody>
        </Card>
        {/* Flow Data Columns */}
        <Grid templateRows="3fr 1fr" gap={4}>
          <DataPropertiesDragAndDrop />

          {/* 선택된 데이터셋 카드 */}
          <Card>
            <CardHeader mb="16px" justifyContent="space-between">
              <Text color="#fff" fontSize="lg" fontWeight="bold">
                Selected Data
              </Text>
              <Box>
                <Flex alignItems="center" justifyContent="space-between">
                  <Flex alignItems="center">
                    <Text color="#fff" fontSize="md">
                      Available Capacity:
                    </Text>
                    <Text color="gray.400" fontSize="md" ml={3}>
                      {(parseFloat(totalSelectedSize) / 1024).toFixed(2)}
                    </Text>
                    <Text color="#fff" fontSize="md" ml={2}>
                      / 1024 MB
                    </Text>
                  </Flex>
                  <IconButton
                    size="sm"
                    bg="cyan.200"
                    ml={4}
                    icon={<CheckIcon h="16px" w="16px" color="#fff" />}
                    colorScheme="cyan"
                    aria-label="Apply Selection"
                    onClick={handleApplySelection}
                  />
                </Flex>
              </Box>
            </CardHeader>

            <CardBody>
              <SelectedDataArea
                selectedFiles={selectedDatasets} // ✅ 이제 csvId 배열만 전달
                allDatasets={projectDatasets} // ✅ 전체 프로젝트 데이터셋 전달
                onDeselect={(csvId) => handleDatasetDeselect(csvId)}
              />
            </CardBody>
          </Card>
        </Grid>
      </Grid>
    </Flex>
  );
};

export default SelectDatasetsPage;
